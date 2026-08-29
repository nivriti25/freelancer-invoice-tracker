import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  Loader2, AlertCircle, AlertTriangle, CheckCircle, Trash2, Landmark, Mail, MapPin, Phone,
  Search, Eye, Download, Send, ChevronDown, ChevronUp, Edit, ArrowRight, Menu, X,
  CreditCard, MessageSquare, ShieldAlert, LogOut
} from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import ProtectedRoute from './components/ProtectedRoute';
import ClientForm from './components/ClientForm';
import InvoiceForm from './components/InvoiceForm';
import ProfileSettings from './components/ProfileSettings';
import LandingPage from './components/LandingPage';
import AuthScreen from './components/AuthScreen';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const NAV_ITEMS = [
  { key: 'today', label: 'Today' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'clients', label: 'Clients' },
  { key: 'agent', label: 'Agent log' },
  { key: 'settings', label: 'Settings' },
];

const AGENT_PERMISSIONS = [
  { label: 'Send reminder emails', on: true },
  { label: 'Retry failed card payments', on: true },
  { label: 'Offer a payment plan up to ₹10,000', on: false },
  { label: 'Escalate tone after 3 reminders', on: false },
];

const formatRupee = (value) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(num);
};

const formatSentDate = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return isoString;
  }
};

const formatShortDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch (e) {
    return value;
  }
};

const formatDateTime = (isoString) => {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
};

const statusTextColor = (status) => {
  switch (status) {
    case 'Paid': return 'text-good';
    case 'Sent': return 'text-accent-dark';
    case 'Overdue': return 'text-bad';
    default: return 'text-muted';
  }
};

// --- AI Collections Agent: shared display metadata --- //
// These map the raw backend vocabulary (AgentAction enum values / classifier
// labels) onto human-readable badges and copy, so the UI never needs to show
// a raw enum string like "escalate_to_human" to the user.

const AI_ACTION_META = {
  send_reminder: { label: 'Reminder sent', icon: Mail, className: 'bg-accent-soft text-accent-dark border-line' },
  retry_payment: { label: 'Retrying payment', icon: CreditCard, className: 'bg-[#f7f0dc] text-warn-soft border-line' },
  escalate_to_human: { label: 'Needs your attention', icon: AlertTriangle, className: 'bg-[#f8e9e4] text-bad border-line' },
  mark_disputed: { label: 'Disputed — review', icon: AlertCircle, className: 'bg-[#f3e6e2] text-bad-soft border-line' },
  do_nothing: { label: 'No action needed', icon: CheckCircle, className: 'bg-line-soft text-muted border-line' },
};

const AI_CLASSIFICATION_LABELS = {
  forgot: 'client likely forgot',
  disputed: 'client is disputing the invoice',
  payment_failed: 'a payment attempt failed',
  gone_silent: 'client has gone silent',
};

// Small badge shown next to an invoice's status, sourced from the account-wide
// agent summary map so no per-row API call is needed.
function AiActivityBadge({ invoiceId, agentSummary }) {
  if (!agentSummary) return null;

  const promiseDate = agentSummary.active_promises?.[invoiceId];
  if (promiseDate) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border select-none bg-[#eaf5f0] text-good border-line">
        <MessageSquare className="w-2.5 h-2.5" />
        Promised by {formatShortDate(promiseDate)}
      </span>
    );
  }

  const action = agentSummary.latest_actions?.[invoiceId];
  const meta = action && AI_ACTION_META[action];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border select-none ${meta.className}`}>
      <Icon className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}

// Merges an invoice's decisions/overrides/promises into one chronological feed.
// A decision and its override share the exact same created_at timestamp
// (both are written inside the same DB transaction in check_overdue.py), so
// they can be paired by timestamp equality.
function buildAgentTimeline(activity) {
  if (!activity) return [];

  const overrideByTimestamp = {};
  (activity.overrides || []).forEach((o) => {
    overrideByTimestamp[o.created_at] = o;
  });

  const decisionEvents = (activity.decisions || []).map((d) => ({
    type: 'decision',
    created_at: d.created_at,
    classification: d.classification,
    decided_action: d.decided_action,
    raw_llm_output: d.raw_llm_output,
    override: overrideByTimestamp[d.created_at] || null,
  }));

  const promiseEvents = (activity.promises || []).map((p) => ({
    type: 'promise',
    created_at: p.created_at,
    promised_date: p.promised_date,
    resolved: p.resolved,
  }));

  return [...decisionEvents, ...promiseEvents].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}

function AgentTimeline({ activity }) {
  const events = buildAgentTimeline(activity);

  if (events.length === 0) {
    return (
      <div className="text-xs text-muted py-1 select-none">
        The AI agent hasn't taken any action on this invoice yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, idx) => {
        if (event.type === 'promise') {
          return (
            <div key={`promise-${idx}`} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#eaf5f0] border border-line text-good flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">
                  Client promised to pay by {formatShortDate(event.promised_date)}
                  {event.resolved && <span className="text-good font-semibold"> — kept</span>}
                </p>
                <p className="text-[10px] text-muted font-semibold mt-0.5">{formatDateTime(event.created_at)}</p>
              </div>
            </div>
          );
        }

        const meta = AI_ACTION_META[event.decided_action] || AI_ACTION_META.do_nothing;
        const Icon = meta.icon;
        const classificationLabel = AI_CLASSIFICATION_LABELS[event.classification] || event.classification;

        return (
          <div key={`decision-${idx}`} className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${meta.className}`}>
              <Icon className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink">{meta.label}</p>
              {classificationLabel && (
                <p className="text-[10px] text-muted font-semibold mt-0.5">Reason: {classificationLabel}</p>
              )}
              {event.override && (
                <div className="flex items-start gap-1.5 mt-1.5 p-2 bg-[#f8f3e6] border border-line rounded-md">
                  <ShieldAlert className="w-3 h-3 text-warn-soft shrink-0 mt-0.5" />
                  <p className="text-[10px] text-warn-soft font-semibold leading-relaxed">
                    AI suggested "{AI_ACTION_META[event.raw_llm_output]?.label || event.raw_llm_output}", but was overridden: {event.override.override_reason}
                  </p>
                </div>
              )}
              <p className="text-[10px] text-muted font-semibold mt-0.5">{formatDateTime(event.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { user, session, signOut } = useAuth();
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [agentSummary, setAgentSummary] = useState(null);
  const [agentActivity, setAgentActivity] = useState({});
  const [agentActivityLoading, setAgentActivityLoading] = useState({});

  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentView, setCurrentView] = useState('today'); // 'today', 'invoices', 'clients', 'agent', 'settings'
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('All');
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null);
  const [sendSuccessMsg, setSendSuccessMsg] = useState(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [confirmSendInvoiceId, setConfirmSendInvoiceId] = useState(null);
  const [paySuccessMsg, setPaySuccessMsg] = useState(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);
  const [clientToEdit, setClientToEdit] = useState(null);
  const [profileName, setProfileName] = useState('Freelancer');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleDeleteClient = async (clientId, clientName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${clientName}? This will permanently remove the client and ALL of their associated invoices.`
    );
    if (!confirmDelete) return;

    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.detail || 'Failed to delete client';
        throw new Error(errMsg);
      }

      await fetchData();
    } catch (err) {
      setError(err.message || 'Error deleting client.');
    }
  };

  const handleDeleteInvoice = async (invoiceId, invoiceNumber) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete Invoice ${invoiceNumber}? This will permanently remove it from the database.`
    );
    if (!confirmDelete) return;

    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.detail || 'Failed to delete invoice';
        throw new Error(errMsg);
      }

      await fetchData();
    } catch (err) {
      setError(err.message || 'Error deleting invoice.');
    }
  };

  const handleSendInvoice = async (invoiceId, invoiceNumber) => {
    setConfirmSendInvoiceId(null);
    setSendingInvoiceId(invoiceId);
    setSendSuccessMsg(null);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_API_URL}/invoices/${invoiceId}/send`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send invoice email');
      }

      // Mark as sent in localStorage
      const inv = invoices.find(i => String(i.id) === String(invoiceId));
      if (inv && (inv.status === 'Paid' || inv.status === 'Overdue')) {
        localStorage.setItem(`sent_invoice_status_${String(invoiceId)}`, inv.status);
      }

      setSendSuccessMsg(data.message || `Invoice ${invoiceNumber} emailed successfully ✓`);
      await fetchData();
      setTimeout(() => setSendSuccessMsg(null), 6000);
    } catch (err) {
      setError(err.message || 'Error sending invoice email.');
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handlePayInvoice = async (invoice) => {
    setPayingInvoiceId(invoice.id);
    setPaySuccessMsg(null);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/payments/create-order/${invoice.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to initiate payment');
      }

      // Check if we are running in Mock Payment Mode (placeholder keys/mock order)
      if (
        data.order_id.startsWith("order_mock_") ||
        data.key_id === "rzp_test_placeholder" ||
        !data.key_id
      ) {
        const confirmMockPay = window.confirm(
          `[Mock Payment Mode]\n\nInvoice: ${data.invoice_number}\nAmount: ${formatRupee(invoice.total_amount)}\n\nNo real Razorpay key is configured. Would you like to simulate a successful payment?`
        );
        if (confirmMockPay) {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/payments/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                invoice_id: invoice.id,
                razorpay_order_id: data.order_id,
                razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(2, 10)}`,
                razorpay_signature: "mock_signature_value"
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.detail || 'Mock signature verification failed');
            }

            setPaySuccessMsg(`Mock payment of ${formatRupee(invoice.total_amount)} for Invoice ${invoice.invoice_number} processed successfully! ✓`);
            await fetchData();
            setTimeout(() => setPaySuccessMsg(null), 6000);
          } catch (err) {
            setError(err.message || 'Error processing mock payment.');
          } finally {
            setPayingInvoiceId(null);
          }
        } else {
          setPayingInvoiceId(null);
        }
        return;
      }

      const client = clients.find(c => c.id === invoice.client_id) || {};

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Ledgr Invoicing",
        description: `Payment for Invoice ${data.invoice_number}`,
        order_id: data.order_id,
        handler: async function (checkoutResponse) {
          setPayingInvoiceId(invoice.id);
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/payments/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                invoice_id: invoice.id,
                razorpay_order_id: checkoutResponse.razorpay_order_id,
                razorpay_payment_id: checkoutResponse.razorpay_payment_id,
                razorpay_signature: checkoutResponse.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.detail || 'Signature verification failed');
            }

            setPaySuccessMsg(`Payment of ${formatRupee(invoice.total_amount)} for Invoice ${invoice.invoice_number} verified successfully! ✓`);
            await fetchData();
            setTimeout(() => setPaySuccessMsg(null), 6000);
          } catch (err) {
            setError(err.message || 'Error verifying payment signature.');
          } finally {
            setPayingInvoiceId(null);
          }
        },
        prefill: {
          name: client.name || '',
          email: client.email || '',
          contact: client.phone || ''
        },
        theme: {
          color: "#12161c"
        },
        modal: {
          ondismiss: function () {
            setPayingInvoiceId(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.message || 'Error processing payment checkout.');
      setPayingInvoiceId(null);
    }
  };

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${invoiceId}/download`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.detail || 'Failed to download PDF';
        throw new Error(errMsg);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoiceNumber.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Error downloading PDF.');
    }
  };

  const handlePreviewHTML = async (invoiceId) => {
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${invoiceId}/preview`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.detail || 'Failed to load preview';
        throw new Error(errMsg);
      }
      const html = await response.text();
      const win = window.open();
      if (win) {
        win.document.write(html);
        win.document.close();
      } else {
        setError('Please allow popups to view the invoice preview.');
      }
    } catch (err) {
      setError(err.message || 'Error loading preview.');
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId, newStatus) => {
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.detail || 'Failed to update status';
        throw new Error(errMsg);
      }

      await fetchData();
    } catch (err) {
      setError(err.message || 'Error updating status.');
    }
  };

  const hasSentInCurrentStatus = (inv) => {
    if (inv.status === 'Draft' || inv.status === 'Sent') return false;
    return localStorage.getItem(`sent_invoice_status_${inv.id}`) === inv.status || !!inv.sent_at;
  };

  const fetchData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Clients
      const clientsRes = await fetch(`${import.meta.env.VITE_API_URL}/clients`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!clientsRes.ok) throw new Error('Failed to fetch clients');
      const clientsData = await clientsRes.json();
      setClients(clientsData);

      // 2. Fetch Invoices
      const invoicesRes = await fetch(`${import.meta.env.VITE_API_URL}/invoices`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!invoicesRes.ok) throw new Error('Failed to fetch invoices');
      const invoicesData = await invoicesRes.json();
      setInvoices(invoicesData);

    } catch (err) {
      setError(err.message || 'Error loading dashboard data.');
    } finally {
      setLoading(false);
    }

    // 3. Fetch AI collections agent summary. Kept outside the try/catch above
    // so a hiccup here never blocks the core clients/invoices dashboard data.
    try {
      const agentRes = await fetch(`${import.meta.env.VITE_API_URL}/agent/summary`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (agentRes.ok) {
        setAgentSummary(await agentRes.json());
      }
    } catch (err) {
      console.error('Error fetching AI agent summary:', err);
    }
  };

  const fetchAgentActivity = async (invoiceId) => {
    if (agentActivity[invoiceId] || agentActivityLoading[invoiceId]) return;
    setAgentActivityLoading(prev => ({ ...prev, [invoiceId]: true }));
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/agent/invoices/${invoiceId}/activity`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAgentActivity(prev => ({ ...prev, [invoiceId]: data }));
      }
    } catch (err) {
      console.error('Error fetching invoice AI agent activity:', err);
    } finally {
      setAgentActivityLoading(prev => ({ ...prev, [invoiceId]: false }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [session]);

  useEffect(() => {
    async function loadProfileName() {
      if (!session?.user?.id) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, business_name')
          .eq('id', session.user.id)
          .single();
        if (data) {
          const nameToUse = data.full_name || data.business_name || 'Freelancer';
          setProfileName(nameToUse);
        }
      } catch (err) {
        console.error('Error fetching profile name for dashboard:', err);
      }
    }
    loadProfileName();
  }, [session, currentView]);

  // Once the account-wide agent summary is in, fetch per-invoice activity for
  // every invoice the agent has touched so the Agent log view can render one
  // combined timeline without extra endpoints.
  useEffect(() => {
    if (currentView !== 'agent' || !agentSummary) return;
    Object.keys(agentSummary.latest_actions || {}).forEach((id) => fetchAgentActivity(id));
  }, [currentView, agentSummary]);

  // Aggregate Calculations
  const getStats = () => {
    const now = new Date();
    let totalEarned = 0; // Total of Paid invoices
    let totalOutstanding = 0; // Total of Sent or Draft invoices
    let outstandingCount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let maxOverdueDays = 0;
    let totalBilled = 0;
    let collectedThisMonth = 0;
    let paidThisMonthCount = 0;

    invoices.forEach(inv => {
      const amt = parseFloat(inv.total_amount) || 0;
      totalBilled += amt;
      if (inv.status === 'Paid') {
        totalEarned += amt;
        const issue = new Date(inv.issue_date);
        if (issue.getMonth() === now.getMonth() && issue.getFullYear() === now.getFullYear()) {
          collectedThisMonth += amt;
          paidThisMonthCount++;
        }
      } else if (inv.status === 'Sent' || inv.status === 'Draft') {
        totalOutstanding += amt;
        outstandingCount++;
      } else if (inv.status === 'Overdue') {
        overdueCount++;
        overdueAmount += amt;
        const days = Math.floor((now - new Date(inv.due_date)) / 86400000);
        if (days > maxOverdueDays) maxOverdueDays = days;
      }
    });

    const collectionPercentage = totalBilled > 0
      ? Math.round((totalEarned / totalBilled) * 100)
      : 0;

    return {
      totalEarned: totalEarned.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      outstandingCount,
      overdueCount,
      overdueAmount: overdueAmount.toFixed(2),
      maxOverdueDays,
      totalBilled: totalBilled.toFixed(2),
      collectionPercentage,
      activeClientsCount: clients.length,
      collectedThisMonth: collectedThisMonth.toFixed(2),
      paidThisMonthCount
    };
  };

  const stats = getStats();

  // Aggregate monthly data for chart
  const getMonthlyData = () => {
    const monthlyTotals = {};
    months.forEach(m => { monthlyTotals[m] = 0; });

    invoices.forEach(inv => {
      try {
        const dateObj = new Date(inv.issue_date);
        const mName = months[dateObj.getMonth()];
        const amt = parseFloat(inv.total_amount) || 0;
        monthlyTotals[mName] = (monthlyTotals[mName] || 0) + amt;
      } catch (e) {
        // ignore
      }
    });

    const currentMonthIdx = new Date().getMonth();
    return months.map(m => ({
      month: m,
      revenue: monthlyTotals[m]
    })).slice(0, Math.max(6, currentMonthIdx + 1)); // Show at least 6 months
  };

  const chartData = getMonthlyData();

  const getClientName = (clientId) => {
    const matched = clients.find(c => c.id === clientId);
    return matched ? matched.name : 'Unknown Client';
  };

  // Invoices the agent has flagged for a human decision.
  const needsAttentionItems = agentSummary?.needs_attention || [];
  const needsAttentionIds = new Set(needsAttentionItems.map(a => a.invoice_id));

  // Invoices the agent is actively chasing (reminders/retries/promises) that
  // don't need a human decision.
  const handlingInvoices = invoices.filter(inv => {
    if (needsAttentionIds.has(inv.id)) return false;
    if (inv.status === 'Paid' || inv.status === 'Draft') return false;
    const hasAction = !!agentSummary?.latest_actions?.[inv.id];
    const hasPromise = !!agentSummary?.active_promises?.[inv.id];
    return hasAction || hasPromise;
  });

  const chasingCount = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue').length;
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const openInvoiceDetails = (invoiceId) => {
    setCurrentView('invoices');
    setInvoiceSearchQuery('');
    setInvoiceStatusFilter('All');
    setExpandedInvoiceId(invoiceId);
    if (agentSummary?.latest_actions?.[invoiceId]) fetchAgentActivity(invoiceId);
  };

  const jumpToClientInvoices = (client) => {
    setInvoiceSearchQuery(client.name);
    setInvoiceStatusFilter('All');
    setCurrentView('invoices');
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans antialiased flex">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[228px] shrink-0 bg-paper border-r border-line py-7 flex-col justify-between">
        <div className="flex flex-col gap-8">
          <div className="px-6 flex items-baseline gap-2 cursor-pointer select-none" onClick={() => setCurrentView('today')}>
            <span className="text-[21px] font-bold tracking-tight">Ledgr</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
          </div>
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => setCurrentView(item.key)}
                className={`text-left flex items-center justify-between px-3 py-2.5 rounded-md text-[14.5px] transition-colors cursor-pointer ${currentView === item.key ? 'bg-accent-soft text-accent-dark font-semibold' : 'text-ink-soft font-medium hover:bg-line-soft'
                  }`}
              >
                <span>{item.label}</span>
                {item.key === 'today' && needsAttentionItems.length > 0 && (
                  <span className="text-[11px] font-bold bg-bad text-white px-[7px] py-[1px] rounded-full">{needsAttentionItems.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="mx-6 pt-4 border-t border-line">
            <p className="m-0 text-[12.5px] text-muted">Agent status</p>
            <p className="mt-2 text-[14.5px] font-semibold leading-[1.45]">
              {chasingCount > 0 ? `Chasing ${chasingCount} invoice${chasingCount === 1 ? '' : 's'}` : 'All caught up'}
              <br />
              <span className="text-muted font-normal">Next run tonight, 12:00 AM UTC</span>
            </p>
          </div>
        </div>
        <div className="px-6 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center text-[12.5px] font-semibold shrink-0 select-none">
            {profileName.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13.5px] font-semibold truncate">{profileName}</p>
            <p className="m-0 text-xs text-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={async () => { await signOut(); navigate('/', { replace: true }); }}
            title="Sign out"
            className="p-1.5 rounded-md text-muted hover:text-bad hover:bg-line-soft transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-md border-b border-line">
        <div className="flex items-center justify-between px-5 h-14">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">Ledgr</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md text-ink-soft hover:bg-line-soft transition-colors cursor-pointer">
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {isMobileMenuOpen && (
          <div className="border-t border-line bg-paper px-5 py-4 space-y-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => { setCurrentView(item.key); setIsMobileMenuOpen(false); }}
                className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-md text-sm cursor-pointer ${currentView === item.key ? 'bg-accent-soft text-accent-dark font-semibold' : 'text-ink-soft font-medium'
                  }`}
              >
                <span>{item.label}</span>
                {item.key === 'today' && needsAttentionItems.length > 0 && (
                  <span className="text-[11px] font-bold bg-bad text-white px-[7px] py-[1px] rounded-full">{needsAttentionItems.length}</span>
                )}
              </button>
            ))}
            <div className="pt-3 mt-2 border-t border-line flex items-center gap-2.5 px-3">
              <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center text-[12px] font-semibold shrink-0 select-none">
                {profileName.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[13px] font-semibold truncate">{profileName}</p>
                <p className="m-0 text-[11px] text-muted truncate">{user?.email}</p>
              </div>
              <button
                onClick={async () => { await signOut(); setIsMobileMenuOpen(false); navigate('/', { replace: true }); }}
                className="p-1.5 rounded-md text-muted hover:text-bad transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col pt-14 lg:pt-0">
        <main className="flex-1 px-5 sm:px-8 lg:px-[52px] pt-7 lg:pt-11 pb-16 w-full">
          {error && (
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-sm p-4 rounded-md mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading && invoices.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-ink" />
              <p className="text-muted text-sm font-medium">Loading your numbers...</p>
            </div>
          ) : currentView === 'today' ? (

            /* ── Today ─────────────────────────────────────────────── */
            <div className="max-w-[1080px]">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="m-0 text-[34px] font-bold tracking-[-0.025em]">Today</h1>
                  <p className="mt-2 text-[15.5px] text-muted">
                    {todayLabel}. {needsAttentionItems.length === 0
                      ? 'Nothing needs a decision from you.'
                      : `${needsAttentionItems.length} invoice${needsAttentionItems.length === 1 ? '' : 's'} need${needsAttentionItems.length === 1 ? 's' : ''} a decision from you.`}
                  </p>
                </div>
                <button
                  onClick={() => { setClientToEdit(null); setIsInvoiceFormOpen(true); }}
                  className="text-[14.5px] font-semibold text-white bg-ink rounded-md px-5 py-[11px] hover:bg-ink-soft transition-colors cursor-pointer shrink-0"
                >
                  New invoice
                </button>
              </div>

              {/* Stats row */}
              <div className="flex flex-col sm:flex-row mt-10 border-t border-b border-line">
                <div className="flex-1 py-6 sm:pr-7 border-b sm:border-b-0 border-line">
                  <p className="m-0 text-[13px] text-muted tracking-[0.03em]">Outstanding</p>
                  <p className="mt-2.5 text-[32px] font-semibold tracking-[-0.02em] tabular-nums">{formatRupee(stats.totalOutstanding)}</p>
                  <p className="mt-1.5 text-[13.5px] text-muted">across {stats.outstandingCount} invoice{stats.outstandingCount === 1 ? '' : 's'}</p>
                </div>
                <div className="flex-1 py-6 sm:px-7 border-b sm:border-b-0 sm:border-l border-line">
                  <p className="m-0 text-[13px] text-bad tracking-[0.03em]">Overdue</p>
                  <p className="mt-2.5 text-[32px] font-semibold tracking-[-0.02em] text-bad tabular-nums">{formatRupee(stats.overdueAmount)}</p>
                  <p className="mt-1.5 text-[13.5px] text-muted">
                    {stats.overdueCount === 0
                      ? 'nothing overdue'
                      : `${stats.overdueCount} invoice${stats.overdueCount === 1 ? '' : 's'}${stats.maxOverdueDays > 0 ? `, ${stats.maxOverdueDays} days late` : ''}`}
                  </p>
                </div>
                <div className="flex-1 py-6 sm:pl-7 sm:border-l border-line">
                  <p className="m-0 text-[13px] text-muted tracking-[0.03em]">Collected in {currentMonthName}</p>
                  <p className="mt-2.5 text-[32px] font-semibold tracking-[-0.02em] tabular-nums">{formatRupee(stats.collectedThisMonth)}</p>
                  <p className="mt-1.5 text-[13.5px] text-good">{stats.paidThisMonthCount} invoice{stats.paidThisMonthCount === 1 ? '' : 's'} paid</p>
                </div>
              </div>

              {/* Needs you */}
              <h2 className="mt-11 mb-1 text-[19px] font-bold tracking-[-0.015em]">Needs you</h2>
              <p className="mb-4.5 text-[14.5px] text-muted">The agent stopped here on purpose. These need a person.</p>
              {needsAttentionItems.length === 0 ? (
                <div className="border border-line rounded-md py-10 px-6 text-center text-[14px] text-muted">
                  Nothing needs a decision right now — the agent is handling everything on its own.
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {needsAttentionItems.map(item => (
                    <div key={item.invoice_id} className="border border-line border-l-[3px] border-l-bad rounded-md p-5 sm:p-6">
                      <div className="flex justify-between gap-6 items-start flex-wrap">
                        <div className="min-w-0">
                          <p className="m-0 text-[16.5px] font-semibold">{item.client_name}<span className="text-muted font-normal"> · {item.invoice_number}</span></p>
                          <p className="mt-2.5 text-[15px] leading-[1.6] max-w-[52ch] text-ink-soft">{item.reason}</p>
                        </div>
                        <p className="m-0 text-2xl font-semibold tabular-nums whitespace-nowrap">{formatRupee(item.total_amount)}</p>
                      </div>
                      <div className="flex gap-2.5 mt-5 flex-wrap">
                        <button
                          onClick={() => openInvoiceDetails(item.invoice_id)}
                          className="text-[14px] font-semibold bg-ink text-white rounded-md px-[18px] py-2.5 hover:bg-ink-soft transition-colors cursor-pointer"
                        >
                          Review invoice
                        </button>
                        <button
                          onClick={() => handlePreviewHTML(item.invoice_id)}
                          className="text-[14px] font-semibold bg-white text-ink border border-line-strong rounded-md px-[18px] py-2.5 hover:bg-line-soft transition-colors cursor-pointer"
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* The agent is handling */}
              <h2 className="mt-11 mb-1 text-[19px] font-bold tracking-[-0.015em]">The agent is handling</h2>
              <p className="mb-4.5 text-[14.5px] text-muted">No action needed. Anything here can be taken back at any point.</p>
              {handlingInvoices.length === 0 ? (
                <div className="border border-line rounded-md py-10 px-6 text-center text-[14px] text-muted">
                  The agent isn't actively chasing anything right now.
                </div>
              ) : (
                <div className="border border-line rounded-md overflow-hidden">
                  {handlingInvoices.map((inv, idx) => {
                    const promiseDate = agentSummary?.active_promises?.[inv.id];
                    const action = agentSummary?.latest_actions?.[inv.id];
                    const meta = AI_ACTION_META[action] || AI_ACTION_META.do_nothing;
                    return (
                      <div
                        key={inv.id}
                        className={`grid grid-cols-1 sm:grid-cols-[1fr_150px_130px] gap-1.5 sm:gap-5 px-5 sm:px-6 py-4 sm:items-center cursor-pointer hover:bg-line-soft/40 transition-colors ${idx < handlingInvoices.length - 1 ? 'border-b border-line-soft' : ''}`}
                        onClick={() => openInvoiceDetails(inv.id)}
                      >
                        <div className="min-w-0">
                          <p className="m-0 text-[15.5px] font-semibold">{getClientName(inv.client_id)}<span className="text-muted font-normal"> · {inv.invoice_number}</span></p>
                          <p className="mt-1 text-[14px] text-ink-soft">
                            {promiseDate ? `Promised to pay by ${formatShortDate(promiseDate)}` : meta.label}
                          </p>
                        </div>
                        <p className={`m-0 text-[13.5px] font-semibold ${statusTextColor(inv.status)}`}>{inv.status}</p>
                        <p className="m-0 text-[16.5px] font-semibold sm:text-right tabular-nums">{formatRupee(inv.total_amount)}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Monthly revenue (compact) */}
              {chartData.some(d => d.revenue > 0) && (
                <div className="mt-14">
                  <h2 className="mb-1 text-[19px] font-bold tracking-[-0.015em]">Monthly revenue</h2>
                  <p className="mb-4.5 text-[14.5px] text-muted">Billed totals across active periods.</p>
                  <div className="h-[200px] border border-line rounded-md p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" vertical={false} />
                        <XAxis dataKey="month" stroke="#8b93a0" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          stroke="#8b93a0"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={64}
                          tickFormatter={(value) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
                        />
                        <Tooltip
                          cursor={{ fill: '#f0f0ec' }}
                          contentStyle={{ backgroundColor: '#fff', borderColor: '#e6e6e2', borderRadius: '6px', fontSize: '12px' }}
                          formatter={(value) => formatRupee(value)}
                        />
                        <Bar dataKey="revenue" fill="#12161c" radius={[3, 3, 0, 0]} barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

          ) : currentView === 'invoices' ? (

            /* ── Invoices ──────────────────────────────────────────── */
            <div>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="m-0 text-[34px] font-bold tracking-[-0.025em]">Invoices</h1>
                  <p className="mt-2 text-[15.5px] text-muted">Worst first — each row shows what the agent last did.</p>
                </div>
                <button
                  onClick={() => setIsInvoiceFormOpen(true)}
                  className="text-[14.5px] font-semibold text-white bg-ink rounded-md px-5 py-[11px] hover:bg-ink-soft transition-colors cursor-pointer shrink-0"
                >
                  New invoice
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-7">
                <div className="flex gap-1.5 flex-wrap">
                  {['All', 'Draft', 'Sent', 'Overdue', 'Paid'].map(status => {
                    const isActive = invoiceStatusFilter === status;
                    return (
                      <button
                        key={status}
                        onClick={() => setInvoiceStatusFilter(status)}
                        className={`text-[13.5px] font-semibold rounded-md px-3.5 py-2 border transition-colors cursor-pointer ${isActive ? 'bg-ink border-ink text-white' : 'bg-transparent border-line-strong text-ink-soft hover:bg-line-soft'
                          }`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
                <div className="relative sm:ml-auto sm:w-64">
                  <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search number or client..."
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-line-strong rounded-md text-[13.5px] focus:outline-none focus:border-ink transition-colors"
                  />
                </div>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-20 border-t border-line mt-6">
                  <h3 className="m-0 text-[17px] font-bold">No invoices yet</h3>
                  <p className="mt-2 mx-auto text-[14.5px] text-muted max-w-[38ch] leading-relaxed">
                    Draft your first invoice and the agent will start tracking it — reminders, GST math, and payment retries included.
                  </p>
                  <button
                    onClick={() => setIsInvoiceFormOpen(true)}
                    className="mt-5 text-[14.5px] font-semibold text-white bg-ink rounded-md px-[22px] py-[11px] hover:bg-ink-soft transition-colors cursor-pointer"
                  >
                    Draft invoice
                  </button>
                </div>
              ) : (() => {
                const statusRank = { Overdue: 0, Sent: 1, Draft: 2, Paid: 3 };
                const filtered = invoices
                  .filter(inv => {
                    const clientName = getClientName(inv.client_id).toLowerCase();
                    const matchesSearch = inv.invoice_number.toLowerCase().includes(invoiceSearchQuery.toLowerCase()) ||
                      clientName.includes(invoiceSearchQuery.toLowerCase());
                    const matchesStatus = invoiceStatusFilter === 'All' || inv.status === invoiceStatusFilter;
                    return matchesSearch && matchesStatus;
                  })
                  .sort((a, b) => {
                    const rankDiff = (statusRank[a.status] ?? 4) - (statusRank[b.status] ?? 4);
                    if (rankDiff !== 0) return rankDiff;
                    if (a.status === 'Paid') return new Date(b.issue_date) - new Date(a.issue_date);
                    return new Date(a.due_date) - new Date(b.due_date);
                  });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-20 border-t border-line mt-6">
                      <h3 className="m-0 text-[17px] font-bold">No matching invoices</h3>
                      <p className="mt-2 text-[14.5px] text-muted">Try adjusting your filters or search terms.</p>
                      <button
                        onClick={() => { setInvoiceSearchQuery(''); setInvoiceStatusFilter('All'); }}
                        className="mt-4 text-accent-dark hover:underline text-[13.5px] font-semibold cursor-pointer"
                      >
                        Clear filters
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="border-t border-line mt-6">
                    {filtered.map((inv) => {
                      const isOverdue = inv.status === 'Overdue';
                      const isExpanded = expandedInvoiceId === inv.id;

                      return (
                        <div key={inv.id} className="border-b border-line-soft py-5">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-[16px]">{inv.invoice_number}</span>
                                <span className={`text-[13.5px] font-semibold ${statusTextColor(inv.status)}`}>{inv.status}</span>
                                <AiActivityBadge invoiceId={inv.id} agentSummary={agentSummary} />
                              </div>
                              <p className="mt-1.5 text-[14.5px] text-ink-soft">
                                {getClientName(inv.client_id)} · issued {inv.issue_date} · due {inv.due_date}
                                {isOverdue && <span className="text-bad font-semibold"> · overdue</span>}
                              </p>
                            </div>

                            <div className="flex items-center gap-5 lg:gap-6 shrink-0">
                              <p className="m-0 text-[19px] font-semibold tabular-nums">{formatRupee(inv.total_amount)}</p>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handlePreviewHTML(inv.id)}
                                  className="p-2 rounded-md text-muted hover:text-ink hover:bg-line-soft transition-colors cursor-pointer"
                                  title="Preview invoice"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)}
                                  className="p-2 rounded-md text-muted hover:text-ink hover:bg-line-soft transition-colors cursor-pointer"
                                  title="Download PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                {inv.status !== 'Sent' && !hasSentInCurrentStatus(inv) && (
                                  <button
                                    onClick={() => handleSendInvoice(inv.id, inv.invoice_number)}
                                    disabled={sendingInvoiceId === inv.id}
                                    className="p-2 rounded-md text-muted hover:text-accent-dark hover:bg-line-soft disabled:opacity-50 transition-colors cursor-pointer"
                                    title="Email invoice to client"
                                  >
                                    {sendingInvoiceId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                                  className="p-2 rounded-md text-muted hover:text-bad hover:bg-line-soft transition-colors cursor-pointer"
                                  title="Delete invoice"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    const nextId = isExpanded ? null : inv.id;
                                    setExpandedInvoiceId(nextId);
                                    if (nextId && agentSummary?.latest_actions?.[inv.id]) fetchAgentActivity(inv.id);
                                  }}
                                  className="flex items-center gap-0.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink border border-line-strong rounded-md px-2.5 py-1.5 ml-1 transition-colors cursor-pointer"
                                >
                                  <span>Details</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-5 pt-5 border-t border-line-soft flex flex-col gap-4">
                              {hasSentInCurrentStatus(inv) && (
                                <div className="p-4 border border-line rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div>
                                    <p className="m-0 text-[13.5px] font-semibold">
                                      {inv.status === 'Paid' ? 'Payment acknowledgment sent' : 'Overdue reminder sent'}
                                    </p>
                                    <p className="mt-0.5 text-[12.5px] text-muted">
                                      {inv.status === 'Paid'
                                        ? 'You have already emailed the payment acknowledgment to the client.'
                                        : 'You have already emailed the overdue payment reminder to the client.'}
                                    </p>
                                  </div>
                                  {confirmSendInvoiceId === inv.id ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleSendInvoice(inv.id, inv.invoice_number)}
                                        disabled={sendingInvoiceId === inv.id}
                                        className="px-3 py-1.5 bg-bad text-white rounded-md text-[12px] font-semibold disabled:opacity-60 cursor-pointer"
                                      >
                                        {sendingInvoiceId === inv.id ? 'Sending...' : 'Confirm send'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmSendInvoiceId(null)}
                                        disabled={sendingInvoiceId === inv.id}
                                        className="px-3 py-1.5 border border-line-strong rounded-md text-[12px] font-semibold cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmSendInvoiceId(inv.id)}
                                      disabled={sendingInvoiceId === inv.id}
                                      className="px-3.5 py-1.5 bg-ink text-white rounded-md text-[12px] font-semibold shrink-0 cursor-pointer"
                                    >
                                      Send again
                                    </button>
                                  )}
                                </div>
                              )}

                              {inv.razorpay_link_url && (inv.status === 'Sent' || inv.status === 'Overdue') && (
                                <div className="p-4 border border-line rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div>
                                    <p className="m-0 text-[13.5px] font-semibold">Razorpay payment link</p>
                                    <p className="mt-0.5 text-[12.5px] text-muted">Share this secure payment link with your client.</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(inv.razorpay_link_url); alert('Payment link copied to clipboard!'); }}
                                      className="px-3 py-1.5 border border-line-strong rounded-md text-[12px] font-semibold cursor-pointer"
                                    >
                                      Copy link
                                    </button>
                                    <a
                                      href={inv.razorpay_link_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-ink text-white rounded-md text-[12px] font-semibold flex items-center gap-1"
                                    >
                                      Open <ArrowRight className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              )}

                              {inv.status === 'Paid' && (
                                <div className="p-4 border border-line rounded-md flex items-center gap-3">
                                  <CheckCircle className="w-4 h-4 text-good shrink-0" />
                                  <p className="m-0 text-[13px] text-ink-soft">
                                    This invoice has been fully paid.{inv.razorpay_payment_id && ` Payment ID: ${inv.razorpay_payment_id}`}
                                  </p>
                                </div>
                              )}

                              {agentSummary?.latest_actions?.[inv.id] && (
                                <div>
                                  <div className="text-[11px] uppercase font-bold text-muted tracking-wider mb-2.5">Agent activity</div>
                                  <div className="border border-line rounded-md p-4">
                                    {agentActivityLoading[inv.id] ? (
                                      <div className="flex items-center gap-2 text-xs text-muted py-1">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading activity...
                                      </div>
                                    ) : (
                                      <AgentTimeline activity={agentActivity[inv.id]} />
                                    )}
                                  </div>
                                </div>
                              )}

                              <div>
                                <div className="text-[11px] uppercase font-bold text-muted tracking-wider mb-2.5">Line items</div>
                                <div className="overflow-x-auto border border-line rounded-md">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-line bg-line-soft/60 text-muted font-bold">
                                        <th className="py-2.5 px-4 font-semibold">Description</th>
                                        <th className="py-2.5 px-4 text-center font-semibold w-16">Qty</th>
                                        <th className="py-2.5 px-4 text-right font-semibold w-28">Rate</th>
                                        <th className="py-2.5 px-4 text-right font-semibold w-28">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft">
                                      {inv.items && inv.items.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                          <td className="py-2.5 px-4 font-medium">{item.description}</td>
                                          <td className="py-2.5 px-4 text-center text-muted font-mono">{item.quantity}</td>
                                          <td className="py-2.5 px-4 text-right text-muted font-mono">{formatRupee(item.rate)}</td>
                                          <td className="py-2.5 px-4 text-right font-semibold font-mono">{formatRupee(item.quantity * item.rate)}</td>
                                        </tr>
                                      ))}
                                      <tr className="border-t border-line">
                                        <td colSpan="2"></td>
                                        <td className="py-2 px-4 text-right text-muted">Subtotal</td>
                                        <td className="py-2 px-4 text-right font-semibold font-mono">{formatRupee(inv.subtotal)}</td>
                                      </tr>
                                      {parseFloat(inv.gst_amount) > 0 && (
                                        <tr>
                                          <td colSpan="2"></td>
                                          <td className="py-2 px-4 text-right text-muted">GST ({inv.gst_rate}%)</td>
                                          <td className="py-2 px-4 text-right font-semibold font-mono">{formatRupee(inv.gst_amount)}</td>
                                        </tr>
                                      )}
                                      <tr className="border-t border-line font-bold">
                                        <td colSpan="2"></td>
                                        <td className="py-2.5 px-4 text-right">Total</td>
                                        <td className="py-2.5 px-4 text-right font-mono">{formatRupee(inv.total_amount)}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          ) : currentView === 'clients' ? (

            /* ── Clients ───────────────────────────────────────────── */
            <div>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="m-0 text-[34px] font-bold tracking-[-0.025em]">Clients</h1>
                  <p className="mt-2 text-[15.5px] text-muted">Who actually pays, and how much you've billed them.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative sm:w-56">
                    <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search name or email..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-line-strong rounded-md text-[13.5px] focus:outline-none focus:border-ink transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => { setClientToEdit(null); setIsClientFormOpen(true); }}
                    className="text-[14.5px] font-semibold text-white bg-ink rounded-md px-5 py-[11px] hover:bg-ink-soft transition-colors cursor-pointer shrink-0"
                  >
                    Add client
                  </button>
                </div>
              </div>

              {clients.length === 0 ? (
                <div className="text-center py-20 border-t border-line mt-8">
                  <h3 className="m-0 text-[17px] font-bold">No clients added yet</h3>
                  <p className="mt-2 text-[14.5px] text-muted max-w-sm mx-auto">Add your first client to start drafting invoices.</p>
                  <button
                    onClick={() => { setClientToEdit(null); setIsClientFormOpen(true); }}
                    className="mt-5 text-[14.5px] font-semibold text-white bg-ink rounded-md px-[22px] py-[11px] hover:bg-ink-soft transition-colors cursor-pointer"
                  >
                    Add client
                  </button>
                </div>
              ) : (() => {
                const filteredClients = clients.filter(c =>
                  c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                  (c.email && c.email.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                );

                if (filteredClients.length === 0) {
                  return (
                    <div className="text-center py-20 border-t border-line mt-8">
                      <h3 className="m-0 text-[17px] font-bold">No matching clients</h3>
                      <p className="mt-2 text-[14.5px] text-muted">Try adjusting your search.</p>
                      <button onClick={() => setClientSearchQuery('')} className="mt-4 text-accent-dark hover:underline text-[13.5px] font-semibold cursor-pointer">
                        Clear search
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-9">
                    {filteredClients.map((client) => {
                      const clientInvoices = invoices.filter(inv => inv.client_id === client.id);
                      const totalBilled = clientInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
                      const initials = client.name.substring(0, 2).toUpperCase();

                      const billingStatus = (() => {
                        if (clientInvoices.length === 0) return { label: 'No history', color: 'text-muted' };
                        if (clientInvoices.some(inv => inv.status === 'Overdue')) return { label: 'Overdue', color: 'text-bad' };
                        if (clientInvoices.some(inv => inv.status === 'Sent' || inv.status === 'Draft')) return { label: 'Pending', color: 'text-warn-soft' };
                        return { label: 'Paid in full', color: 'text-good' };
                      })();

                      return (
                        <div key={client.id} className="border border-line rounded-md p-6 flex flex-col">
                          <div className="flex items-start gap-3.5">
                            <div className="w-11 h-11 rounded-full bg-accent-soft text-accent-dark flex items-center justify-center font-bold text-[13px] shrink-0 select-none">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="m-0 text-[16px] font-semibold truncate">{client.name}</p>
                              {client.email ? (
                                <a href={`mailto:${client.email}`} className="text-[13.5px] truncate block">{client.email}</a>
                              ) : (
                                <span className="text-muted text-[13px] italic">No email listed</span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => { setClientToEdit(client); setIsClientFormOpen(true); }}
                                className="p-1.5 rounded-md text-muted hover:text-accent-dark hover:bg-line-soft transition-colors cursor-pointer"
                                title="Edit client"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClient(client.id, client.name)}
                                className="p-1.5 rounded-md text-muted hover:text-bad hover:bg-line-soft transition-colors cursor-pointer"
                                title="Remove client"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-4.5 pt-4 border-t border-line-soft flex flex-col gap-2 text-[13.5px] text-ink-soft">
                            {client.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
                                <span>{client.phone}</span>
                              </div>
                            )}
                            {client.gst_number && (
                              <div className="flex items-center gap-2">
                                <Landmark className="w-3.5 h-3.5 text-muted shrink-0" />
                                <span className="font-mono text-[11px] text-muted">GSTIN {client.gst_number}</span>
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                                <span className="leading-relaxed text-muted line-clamp-2" title={client.address}>{client.address}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4.5 flex justify-between items-baseline">
                            <p className="m-0 text-[13px] text-muted">Status</p>
                            <p className={`m-0 text-[13.5px] font-semibold ${billingStatus.color}`}>{billingStatus.label}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-line-soft">
                            <div>
                              <p className="m-0 text-[11px] uppercase text-muted tracking-wide">Total billed</p>
                              <p className="mt-1 text-[17px] font-semibold">{formatRupee(totalBilled)}</p>
                            </div>
                            <div>
                              <p className="m-0 text-[11px] uppercase text-muted tracking-wide">Invoices</p>
                              <p className="mt-1 text-[17px] font-semibold font-mono">{clientInvoices.length}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => jumpToClientInvoices(client)}
                            className="mt-4 text-left text-[13px] font-semibold text-accent-dark hover:underline cursor-pointer"
                          >
                            View invoices →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          ) : currentView === 'agent' ? (

            /* ── Agent log ─────────────────────────────────────────── */
            (() => {
              const ids = Object.keys(agentSummary?.latest_actions || {});
              const feed = [];
              ids.forEach(id => {
                const activity = agentActivity[id];
                if (!activity) return;
                const inv = invoices.find(i => String(i.id) === String(id));
                buildAgentTimeline(activity).forEach(ev => feed.push({
                  ...ev,
                  invoiceId: id,
                  clientName: inv ? getClientName(inv.client_id) : 'Unknown client',
                  invoiceNumber: inv ? inv.invoice_number : '',
                  amount: inv ? inv.total_amount : null,
                }));
              });
              feed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

              const dotColorFor = (ev) => {
                if (ev.type === 'promise') return 'bg-good';
                switch (ev.decided_action) {
                  case 'send_reminder': return 'bg-accent';
                  case 'retry_payment': return 'bg-warn';
                  case 'escalate_to_human': return 'bg-bad';
                  case 'mark_disputed': return 'bg-bad-soft';
                  default: return 'bg-line-strong';
                }
              };

              return (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-14 items-start">
                  <div>
                    <h1 className="m-0 font-serif text-[32px] sm:text-[36px] font-normal tracking-[-0.01em] leading-[1.2]">What I did about your money</h1>
                    <p className="mt-3 text-[15.5px] text-muted max-w-[58ch] leading-relaxed">
                      {formatRupee(parseFloat(stats.totalOutstanding) + parseFloat(stats.overdueAmount))} outstanding, {formatRupee(stats.overdueAmount)} of it late.{' '}
                      {needsAttentionItems.length > 0
                        ? `${needsAttentionItems.length} thing${needsAttentionItems.length === 1 ? '' : 's'} waiting on you above in Today; everything else is on record.`
                        : 'Everything is on record.'}
                    </p>

                    <div className="flex flex-wrap gap-8 mt-7 pb-7 border-b border-line">
                      <div>
                        <p className="m-0 text-[22px] font-bold tabular-nums">{agentSummary?.reminders_sent ?? 0}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted font-semibold">Reminders sent</p>
                      </div>
                      <div>
                        <p className="m-0 text-[22px] font-bold tabular-nums">{agentSummary?.retried_payment ?? 0}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted font-semibold">Payments retried</p>
                      </div>
                      <div>
                        <p className="m-0 text-[22px] font-bold tabular-nums">{agentSummary?.disputed ?? 0}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted font-semibold">Disputed</p>
                      </div>
                      <div>
                        <p className="m-0 text-[22px] font-bold tabular-nums">{agentSummary?.escalated ?? 0}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted font-semibold">Escalated to you</p>
                      </div>
                    </div>

                    <div className="border-l border-line pl-6 mt-8 flex flex-col gap-6">
                      {feed.length === 0 ? (
                        <p className="text-muted text-[14px]">No agent activity on record yet.</p>
                      ) : feed.map((ev, idx) => (
                        <div key={idx} className="relative">
                          <span className={`absolute -left-[27px] top-[7px] w-2 h-2 rounded-full ${dotColorFor(ev)}`} />
                          {ev.type === 'promise' ? (
                            <p className="m-0 text-[15.5px] leading-[1.6] max-w-[62ch]">
                              <strong className="font-semibold">{ev.clientName} · {ev.invoiceNumber}.</strong> Promised to pay by {formatShortDate(ev.promised_date)}
                              {ev.resolved && <span className="text-good"> — kept</span>}.
                            </p>
                          ) : (
                            <>
                              <p className="m-0 text-[15.5px] leading-[1.6] max-w-[62ch]">
                                <strong className="font-semibold">{ev.clientName} · {ev.invoiceNumber}.</strong>{' '}
                                {(AI_ACTION_META[ev.decided_action] || AI_ACTION_META.do_nothing).label}
                                {ev.classification && ` — ${AI_CLASSIFICATION_LABELS[ev.classification] || ev.classification}.`}
                              </p>
                              {ev.override && (
                                <p className="mt-1.5 text-[12.5px] text-warn-soft bg-[#f8f3e6] border border-line rounded-md px-2.5 py-1.5 max-w-[62ch]">
                                  Overridden: {ev.override.override_reason}
                                </p>
                              )}
                            </>
                          )}
                          <p className="mt-1.5 text-[13.5px] text-muted">
                            {formatDateTime(ev.created_at)}{ev.amount != null ? ` · ${formatRupee(ev.amount)}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <aside className="border-l border-line pl-8">
                    <p className="m-0 text-[12.5px] font-bold tracking-[0.09em] uppercase text-muted">What I may do alone</p>
                    <div className="mt-5 flex flex-col">
                      {AGENT_PERMISSIONS.map((p) => (
                        <div key={p.label} className="flex justify-between items-center gap-4 py-[15px] border-b border-line-soft">
                          <p className="m-0 text-[14.5px] leading-[1.45]">{p.label}</p>
                          <span className={`w-[38px] h-[22px] rounded-full relative shrink-0 inline-block ${p.on ? 'bg-good' : 'bg-line-strong'}`}>
                            <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white block ${p.on ? 'right-[3px]' : 'left-[3px]'}`} />
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
                      Anything switched off comes to you as a decision instead. The agent never changes an invoice amount on its own.
                    </p>
                  </aside>
                </div>
              );
            })()

          ) : currentView === 'settings' ? (
            <ProfileSettings />
          ) : null}
        </main>

        {/* Footer */}
        <footer className="border-t border-line px-5 sm:px-8 lg:px-[52px] py-6 mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-muted">
            <span>Ledgr · © {new Date().getFullYear()} Ledgr App. All rights reserved.</span>
            <div className="flex items-center gap-5">
              <a
                href="#feedback"
                onClick={(e) => { e.preventDefault(); alert('Thank you for using Ledgr! Send feedback to support@ledgr.app'); }}
                className="font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
              >
                Send feedback
              </a>
              <span className="font-semibold">v1.1.0</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Forms Modals */}
      <ClientForm
        isOpen={isClientFormOpen}
        onClose={() => {
          setIsClientFormOpen(false);
          setClientToEdit(null);
        }}
        onSuccess={fetchData}
        clientToEdit={clientToEdit}
      />

      <InvoiceForm
        isOpen={isInvoiceFormOpen}
        onClose={() => setIsInvoiceFormOpen(false)}
        onSuccess={fetchData}
        clients={clients}
      />

      {/* Floating success toast notification for sent emails */}
      {sendSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-toast-in max-w-sm w-full">
          <div className="bg-white border border-line shadow-2xl rounded-lg p-4 flex items-start gap-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-good" />
            <div className="p-2 bg-[#eaf5f0] text-good rounded-md shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <h4 className="text-xs font-bold text-ink m-0">Email sent</h4>
              <p className="text-[11.5px] text-muted mt-1 leading-normal">{sendSuccessMsg}</p>
            </div>
            <button
              onClick={() => setSendSuccessMsg(null)}
              className="absolute top-3.5 right-3.5 p-1 rounded-md text-muted hover:text-ink hover:bg-line-soft transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 h-0.5 bg-good animate-toast-progress" style={{ animationDuration: '6000ms' }} />
          </div>
        </div>
      )}

      {/* Floating success toast notification for verified payments */}
      {paySuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-toast-in max-w-sm w-full">
          <div className="bg-white border border-line shadow-2xl rounded-lg p-4 flex items-start gap-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-good" />
            <div className="p-2 bg-[#eaf5f0] text-good rounded-md shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <h4 className="text-xs font-bold text-ink m-0">Payment received</h4>
              <p className="text-[11.5px] text-muted mt-1 leading-normal">{paySuccessMsg}</p>
            </div>
            <button
              onClick={() => setPaySuccessMsg(null)}
              className="absolute top-3.5 right-3.5 p-1 rounded-md text-muted hover:text-ink hover:bg-line-soft transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 h-0.5 bg-good animate-toast-progress" style={{ animationDuration: '6000ms' }} />
          </div>
        </div>
      )}
    </div>
  );
}

function AuthScreenWrapper() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-ink" />
        <p className="text-sm font-medium text-muted">Verifying session...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AuthScreen />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthScreenWrapper />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
