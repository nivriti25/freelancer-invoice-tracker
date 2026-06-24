import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { IndianRupee, FileText, Users, CheckCircle, Clock, Plus, TrendingUp, LogOut, Loader2, PlusCircle, AlertCircle, AlertTriangle, Trash2, Landmark, Mail, MapPin, Search, User, Phone, Eye, Download, Send, ChevronDown, ChevronUp, Edit, Calendar, ArrowRight, Menu, X, Settings, CreditCard } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import ProtectedRoute from './components/ProtectedRoute';
import ClientForm from './components/ClientForm';
import InvoiceForm from './components/InvoiceForm';
import ProfileSettings from './components/ProfileSettings';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function Dashboard() {
  const { user, session, signOut } = useAuth();
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'clients', or 'invoices'
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('All');
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null);
  const [sendSuccessMsg, setSendSuccessMsg] = useState(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [paySuccessMsg, setPaySuccessMsg] = useState(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);
  const [clientToEdit, setClientToEdit] = useState(null);
  const [profileName, setProfileName] = useState('Freelancer');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
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
    setSendingInvoiceId(invoiceId);
    setSendSuccessMsg(null);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send invoice email');
      }
      setSendSuccessMsg(`Invoice ${invoiceNumber} emailed to ${data.recipient_email} ✓`);
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
          color: "#042C53"
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

  useEffect(() => {
    if (!isProfileDropdownOpen) return;
    const handleOutsideClick = (event) => {
      const dropdownElement = document.getElementById('user-profile-menu-container');
      if (dropdownElement && !dropdownElement.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isProfileDropdownOpen]);

  // Aggregate Calculations
  const getStats = () => {
    let totalEarned = 0; // Total of Paid invoices
    let totalOutstanding = 0; // Total of Sent or Draft invoices
    let overdueCount = 0;
    let overdueAmount = 0;
    let totalBilled = 0;

    invoices.forEach(inv => {
      const amt = parseFloat(inv.total_amount) || 0;
      totalBilled += amt;
      if (inv.status === 'Paid') {
        totalEarned += amt;
      } else if (inv.status === 'Sent' || inv.status === 'Draft') {
        totalOutstanding += amt;
      } else if (inv.status === 'Overdue') {
        overdueCount++;
        overdueAmount += amt;
      }
    });

    const collectionPercentage = totalBilled > 0
      ? Math.round((totalEarned / totalBilled) * 100)
      : 0;

    return {
      totalEarned: totalEarned.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      overdueCount,
      overdueAmount: overdueAmount.toFixed(2),
      totalBilled: totalBilled.toFixed(2),
      collectionPercentage,
      activeClientsCount: clients.length
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
      case 'Sent': return 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
      case 'Overdue': return 'bg-rose-500/10 text-rose-600 border border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border border-slate-500/20';
    }
  };

  const getClientName = (clientId) => {
    const matched = clients.find(c => c.id === clientId);
    return matched ? matched.name : 'Unknown Client';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              {/* Branding */}
              <div 
                className="flex items-center gap-2.5 cursor-pointer select-none group"
                onClick={() => setCurrentView('dashboard')}
              >
                <div className="bg-gradient-to-tr from-[#042C53] to-[#378ADD] p-2.5 rounded-xl text-white shadow-md shadow-[#042C53]/10 group-hover:scale-105 transition-transform duration-200">
                  <FileText className="w-5.5 h-5.5" />
                </div>
                <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-[#042C53] to-[#378ADD] bg-clip-text text-transparent font-sans">
                  Ledgr
                </span>
              </div>

              {/* Desktop Navigation Link Tabs */}
              <div className="hidden md:flex items-center gap-8 ml-8">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`relative py-5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    currentView === 'dashboard'
                      ? 'text-[#042C53]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Dashboard
                  {currentView === 'dashboard' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#042C53] to-[#378ADD] rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('clients');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`relative py-5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    currentView === 'clients'
                      ? 'text-[#042C53]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Clients
                  {currentView === 'clients' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#042C53] to-[#378ADD] rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('invoices');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`relative py-5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    currentView === 'invoices'
                      ? 'text-[#042C53]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Invoices
                  {currentView === 'invoices' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#042C53] to-[#378ADD] rounded-full" />
                  )}
                </button>
              </div>
            </div>

            {/* Desktop Right Nav (unified profile dropdown) */}
            <div className="hidden md:flex items-center gap-4">
              <div className="relative" id="user-profile-menu-container">
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 transition-all duration-205 text-left cursor-pointer focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#042C53] to-[#378ADD] text-white flex items-center justify-center font-bold text-xs shadow-sm select-none">
                    {profileName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden lg:block select-none">
                    <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">{profileName}</p>
                    <p className="text-[10px] text-slate-400 leading-tight font-medium truncate max-w-[120px]">{user?.email}</p>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2.5 w-60 bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-100/80 p-2 z-50">
                    <div className="px-3.5 py-3 border-b border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">Logged In As</p>
                      <p className="text-xs font-extrabold text-slate-800 truncate mt-1 select-all">{profileName}</p>
                      <p className="text-xs text-slate-400 truncate font-semibold mt-0.5 select-all">{user?.email}</p>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setCurrentView('profile');
                          setIsProfileDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                          currentView === 'profile'
                            ? 'bg-[#042C53]/5 text-[#042C53]'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-850'
                        }`}
                      >
                        <User className="w-4 h-4 text-slate-450" />
                        <span>My Profile Settings</span>
                      </button>

                      <button
                        onClick={() => {
                          signOut();
                          setIsProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-750 rounded-xl transition-all duration-200 cursor-pointer mt-0.5"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Hamburger Trigger */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors focus:outline-none cursor-pointer"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown Panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white p-4 space-y-4 shadow-inner">
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'dashboard'
                    ? 'bg-[#042C53]/5 text-[#042C53]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('clients');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'clients'
                    ? 'bg-[#042C53]/5 text-[#042C53]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                Clients
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('invoices');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'invoices'
                    ? 'bg-[#042C53]/5 text-[#042C53]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                Invoices
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="px-4 py-2.5 bg-slate-50 rounded-xl mb-3 select-none">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Account</p>
                <p className="text-xs font-extrabold text-slate-800 truncate mt-0.5">{profileName}</p>
                <p className="text-xs text-slate-450 truncate font-semibold">{user?.email}</p>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setCurrentView('profile');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    currentView === 'profile'
                      ? 'bg-[#042C53]/5 text-[#042C53]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <User className="w-4 h-4 text-slate-450" />
                  <span>My Profile Settings</span>
                </button>
                <button
                  onClick={() => {
                    signOut();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-650 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {error && (
          <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-sm p-4 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}


        {loading && invoices.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#042C53]" />
            <p className="text-slate-500 text-sm font-semibold">Loading metrics...</p>
          </div>
        ) : currentView === 'dashboard' ? (
          <>
            {/* Welcome Greeting Header Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm mb-8">
              <div className="space-y-1">
                <h1 className="text-xl font-extrabold text-slate-800 font-sans tracking-tight">
                  {(() => {
                    const hour = new Date().getHours();
                    if (hour < 12) return 'Good morning';
                    if (hour < 18) return 'Good afternoon';
                    return 'Good evening';
                  })()}, {profileName}
                </h1>
                <p className="text-slate-450 text-xs font-semibold">Here is what is happening with your business today.</p>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 select-none shadow-inner">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Card 1: Total Earned */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-350 hover:shadow-md transition-all duration-300 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50 shadow-sm">
                      <IndianRupee className="w-5 h-5" />
                    </div>
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full select-none">
                      <TrendingUp className="w-2.5 h-2.5" /> PAID
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs font-semibold select-none">Total Earned</p>
                  <h3 className="text-xl font-extrabold mt-1 text-slate-800 tracking-tight font-sans select-all">{formatRupee(stats.totalEarned)}</h3>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold mt-3 pt-3 border-t border-slate-100 select-none">
                  Accumulated revenue from paid receipts.
                </div>
              </div>

              {/* Card 2: Total Outstanding */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all duration-300 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50 shadow-sm">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs font-semibold select-none">Total Outstanding</p>
                  <h3 className="text-xl font-extrabold mt-1 text-slate-800 tracking-tight font-sans select-all">{formatRupee(stats.totalOutstanding)}</h3>
                </div>
                <div>
                  {/* Dynamic Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1 mt-3 select-none">
                    <div
                      className="bg-indigo-500 h-1 rounded-full transition-all duration-500"
                      style={{ width: `${stats.collectionPercentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mt-1.5 select-none">
                    <span>COLLECTED: {stats.collectionPercentage}%</span>
                    <span>PENDING: {100 - stats.collectionPercentage}%</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Overdue Amount */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all duration-300 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/50 shadow-sm">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    {stats.overdueCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full select-none">
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs font-semibold select-none">Total Overdue</p>
                  <h3 className="text-xl font-extrabold mt-1 text-rose-600 tracking-tight font-sans select-all">{formatRupee(stats.overdueAmount)}</h3>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold mt-3 pt-3 border-t border-slate-100 select-none">
                  Outstanding on {stats.overdueCount} overdue statements.
                </div>
              </div>

              {/* Card 4: Active Clients */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all duration-300 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50 shadow-sm">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs font-semibold select-none">Client Contacts</p>
                  <h3 className="text-xl font-extrabold mt-1 text-slate-800 tracking-tight font-sans select-all">{stats.activeClientsCount} Clients</h3>
                </div>
                <div className="flex justify-between items-center text-[10px] text-indigo-650 font-bold mt-3 pt-3 border-t border-slate-100 select-none font-sans">
                  <button onClick={() => setCurrentView('clients')} className="hover:underline flex items-center gap-0.5">
                    <span>Manage directory</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Main Row: Monthly Chart + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

              {/* Income totals Bar Chart */}
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight">Monthly Revenue</h3>
                  <p className="text-slate-450 text-[11px] font-semibold mt-0.5">Summary of billing totals across active periods.</p>
                </div>

                <div className="h-[280px] w-full mt-6 select-none">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBarRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#818CF8" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        labelStyle={{ color: '#64748b', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="revenue" fill="url(#colorBarRevenue)" radius={[6, 6, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Actions Shortcuts Hub Panel */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight">Quick Actions</h3>
                  <p className="text-slate-450 text-[11px] font-semibold mt-0.5">Shortcuts to manage billing operations.</p>
                </div>

                <div className="space-y-3 mt-6 flex-1 flex flex-col justify-center">
                  <button
                    onClick={() => {
                      setClientToEdit(null);
                      setIsInvoiceFormOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-100 rounded-xl transition-all group text-left font-sans"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 group-hover:bg-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Draft New Invoice</p>
                        <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Add line items and tax details.</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => {
                      setClientToEdit(null);
                      setIsClientFormOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-emerald-50/30 border border-slate-100 hover:border-emerald-100 rounded-xl transition-all group text-left font-sans"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 group-hover:bg-white transition-colors">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Add Client Profile</p>
                        <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Record business address & GSTIN.</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => setCurrentView('profile')}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50/40 border border-slate-100 hover:border-blue-100 rounded-xl transition-all group text-left font-sans"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600 group-hover:bg-white transition-colors">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Configure Bank Details</p>
                        <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Used automatically on PDF headers.</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Second Row: Recent Invoices + Overdue Invoices Alert */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Recent Invoices Widget */}
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight">Recent Invoices</h3>
                      <p className="text-slate-450 text-[11px] font-semibold mt-0.5">The latest generated billing statements.</p>
                    </div>
                    <button
                      onClick={() => setCurrentView('invoices')}
                      className="text-xs font-bold text-indigo-650 hover:text-indigo-850 hover:underline select-none font-sans"
                    >
                      View All
                    </button>
                  </div>

                  <div className="space-y-3 mt-6">
                    {(() => {
                      const recentInvoices = [...invoices]
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                        .slice(0, 4);

                      if (recentInvoices.length === 0) {
                        return (
                          <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs select-none">
                            No invoices generated yet.
                          </div>
                        );
                      }

                      const statusColors = {
                        Paid: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
                        Sent: 'border-blue-200/80 bg-blue-50 text-blue-700',
                        Overdue: 'border-rose-200/80 bg-rose-50 text-rose-700',
                        Draft: 'border-slate-200 bg-slate-50 text-slate-600'
                      };

                      return recentInvoices.map((inv) => {
                        const initials = getClientName(inv.client_id).substring(0, 2).toUpperCase();
                        return (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between p-3.5 bg-slate-50/50 border border-slate-100 hover:border-slate-250/60 rounded-xl transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0 select-none">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-slate-800 tracking-tight leading-tight">{getClientName(inv.client_id)}</h4>
                                <p className="text-[10px] text-slate-450 font-semibold mt-0.5">{inv.invoice_number} • Issued: {inv.issue_date}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 font-sans">
                              <span className="font-bold text-xs text-slate-705 font-mono select-all">
                                {formatRupee(inv.total_amount)}
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border select-none ${statusColors[inv.status] || statusColors.Draft}`}>
                                {inv.status}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Overdue Invoices Alert Widget */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between max-h-[380px]">
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight">Overdue Balances</h3>
                  <p className="text-slate-450 text-[11px] font-semibold mt-0.5">Actions required for delayed collections.</p>
                </div>

                <div className="space-y-3 mt-6 overflow-y-auto pr-1 flex-1">
                  {(() => {
                    const overdueInvoices = invoices.filter(inv => inv.status === 'Overdue');
                    if (overdueInvoices.length === 0) {
                      return (
                        <div className="h-44 flex flex-col items-center justify-center gap-2 text-slate-400 select-none text-center">
                          <CheckCircle className="w-6 h-6 text-emerald-500 opacity-80" />
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">All Paid In Full</p>
                          <p className="text-[11px] text-slate-400 max-w-[150px] leading-relaxed font-sans">There are no overdue collections today.</p>
                        </div>
                      );
                    }
                    return overdueInvoices.map((inv) => (
                      <div key={inv.id} className="flex justify-between items-center p-3.5 bg-rose-50/20 rounded-xl border border-rose-100/50 hover:border-rose-100 transition-colors font-sans">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-750 truncate tracking-tight">{getClientName(inv.client_id)}</h4>
                          <p className="text-[9px] text-slate-450 font-semibold mt-0.5">{inv.invoice_number} • Due: {inv.due_date}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-rose-650 font-mono select-all">{formatRupee(inv.total_amount)}</p>
                          <span className="inline-block text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 mt-1 select-none">
                            Overdue
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </>
        ) : currentView === 'clients' ? (
          /* Clients Directory View */
          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200/60 text-slate-700 hidden sm:block">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-800 font-sans tracking-tight">Client Directory</h2>
                    <span className="bg-slate-100 border border-slate-200 text-slate-650 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {clients.length} Total
                    </span>
                  </div>
                  <p className="text-slate-450 text-[11px] font-semibold mt-0.5">Manage details and invoice history for all clients.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
                  />
                </div>

                <button
                  onClick={() => {
                    setClientToEdit(null);
                    setIsClientFormOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 bg-[#042C53] hover:bg-[#378ADD] text-white px-4.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-md shadow-[#042C53]/15 hover:shadow-lg hover:-translate-y-[1px] shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add Client
                </button>
              </div>
            </div>

            {/* Clients Grid */}
            {clients.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
                <div className="mx-auto w-12 h-12 bg-slate-50 text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">No clients added yet</h3>
                <p className="text-slate-450 text-xs mt-1 max-w-sm mx-auto">Get started by creating your first client profile to draft invoices and dispatch payment requests.</p>
                <button
                  onClick={() => {
                    setClientToEdit(null);
                    setIsClientFormOpen(true);
                  }}
                  className="mt-5 bg-[#042C53] hover:bg-[#378ADD] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Create Client
                </button>
              </div>
            ) : (() => {
              const filteredClients = clients.filter(c =>
                c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                (c.email && c.email.toLowerCase().includes(clientSearchQuery.toLowerCase()))
              );

              if (filteredClients.length === 0) {
                return (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
                    <div className="mx-auto w-12 h-12 bg-slate-50 text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                      <Search className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">No matching clients found</h3>
                    <p className="text-slate-450 text-xs mt-1">Try adjusting your search query.</p>
                    <button
                      onClick={() => setClientSearchQuery('')}
                      className="mt-4 text-[#378ADD] hover:underline text-xs font-bold font-sans"
                    >
                      Clear search
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClients.map((client) => {
                    const clientInvoices = invoices.filter(inv => inv.client_id === client.id);
                    const totalBilled = clientInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
                    const initials = client.name.substring(0, 2).toUpperCase();

                    // Calculate client billing status badge dynamically
                    const clientStatusBadge = (() => {
                      if (clientInvoices.length === 0) {
                        return {
                          label: 'No History',
                          styles: 'border-slate-200 bg-slate-50 text-slate-500'
                        };
                      }
                      const hasOverdue = clientInvoices.some(inv => inv.status === 'Overdue');
                      if (hasOverdue) {
                        return {
                          label: 'Overdue Pay',
                          styles: 'border-rose-200 bg-rose-50 text-rose-700'
                        };
                      }
                      const hasUnpaid = clientInvoices.some(inv => inv.status === 'Sent' || inv.status === 'Draft');
                      if (hasUnpaid) {
                        return {
                          label: 'Pending Pay',
                          styles: 'border-amber-250 bg-amber-50 text-amber-700'
                        };
                      }
                      return {
                        label: 'Paid In Full ✓',
                        styles: 'border-emerald-250 bg-emerald-50 text-emerald-700 font-bold'
                      };
                    })();

                    return (
                      <div key={client.id} className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-350 hover:-translate-y-[2px] transition-all duration-300 flex flex-col justify-between overflow-hidden">
                        {/* Card Body */}
                        <div className="p-6 space-y-4 flex-1">

                          {/* Title & Avatar */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-sm select-none shadow-sm shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-base text-slate-800 truncate font-sans tracking-tight leading-tight">{client.name}</h4>
                                {client.email ? (
                                  <a href={`mailto:${client.email}`} className="text-indigo-650 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1.5 truncate mt-1">
                                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-450" />
                                    <span className="truncate">{client.email}</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-xs italic mt-1 block">No email listed</span>
                                )}
                              </div>
                            </div>

                            {/* Billing tag */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 select-none ${clientStatusBadge.styles}`}>
                              {clientStatusBadge.label}
                            </span>
                          </div>

                          {/* Contact Details fields */}
                          <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-650">
                            {client.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-slate-650 font-medium">{client.phone}</span>
                              </div>
                            )}
                            {client.gst_number && (
                              <div className="flex items-center gap-2">
                                <Landmark className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="font-mono text-[10px] bg-slate-50 border border-slate-200/60 text-slate-600 px-2 py-0.5 rounded-lg select-all">
                                  GSTIN: {client.gst_number}
                                </span>
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                <span className="leading-relaxed text-slate-500 font-medium line-clamp-2" title={client.address}>{client.address}</span>
                              </div>
                            )}
                          </div>

                          {/* Summary Stats Split Grid */}
                          <div className="grid grid-cols-2 gap-4 bg-slate-50/50 border border-slate-200/50 p-3.5 rounded-2xl select-none">
                            <div>
                              <p className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Total Billed</p>
                              <p className="text-base font-extrabold text-slate-800 mt-1 font-sans">{formatRupee(totalBilled)}</p>
                            </div>
                            <div className="border-l border-slate-200 pl-4">
                              <p className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Invoices Count</p>
                              <p className="text-base font-extrabold text-slate-800 mt-1 font-mono">{clientInvoices.length}</p>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="bg-slate-50/50 border-t border-slate-100/70 px-6 py-3.5 flex items-center justify-between">

                          {/* navigation link */}
                          <button
                            onClick={() => {
                              setInvoiceSearchQuery(client.name);
                              setInvoiceStatusFilter('All');
                              setCurrentView('invoices');
                            }}
                            className="text-xs font-bold text-indigo-655 hover:text-indigo-800 hover:underline transition-colors flex items-center gap-0.5 select-none"
                          >
                            <span>View Invoices</span>
                            <span>→</span>
                          </button>

                          {/* actions (Edit + Delete) */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setClientToEdit(client);
                                setIsClientFormOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-650 hover:bg-indigo-50 border border-transparent hover:border-indigo-100/60 transition-all select-none"
                              title="Edit Client"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client.id, client.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100/60 transition-all select-none"
                              title="Remove Client"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : currentView === 'invoices' ? (
          /* Invoices View */
          <div className="space-y-6">

            {/* Header Control Row */}
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200/60 text-slate-700 hidden sm:block">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 font-sans tracking-tight">Invoice Manager</h2>
                  <p className="text-slate-450 text-[11px] font-semibold mt-0.5">Track, edit, and dispatch invoices.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search query */}
                <div className="relative min-w-[220px] flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search number or client..."
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
                  />
                </div>

                {/* Segmented Status Selector */}
                <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60 overflow-x-auto scrollbar-none">
                  {['All', 'Draft', 'Sent', 'Paid', 'Overdue'].map((status) => {
                    const isActive = invoiceStatusFilter === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setInvoiceStatusFilter(status)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${isActive
                            ? 'bg-white text-[#042C53] shadow-sm font-bold border border-slate-200/10'
                            : 'text-slate-500 hover:text-slate-850'
                          }`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>

                {/* Create Invoice button */}
                <button
                  onClick={() => setIsInvoiceFormOpen(true)}
                  className="flex items-center justify-center gap-1.5 bg-[#042C53] hover:bg-[#378ADD] text-white px-4.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-md shadow-[#042C53]/15 hover:shadow-lg hover:-translate-y-[1px] shrink-0"
                >
                  <Plus className="w-4 h-4" /> New Invoice
                </button>
              </div>
            </div>

            {/* Invoices List / Table structure */}
            {invoices.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
                <div className="mx-auto w-12 h-12 bg-slate-50 text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">No invoices drafted yet</h3>
                <p className="text-slate-450 text-xs mt-1 max-w-sm mx-auto">Generate billing statements, calculate automated taxes, and email PDF receipts to your clients.</p>
                <button
                  onClick={() => setIsInvoiceFormOpen(true)}
                  className="mt-5 bg-[#042C53] hover:bg-[#378ADD] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Draft Invoice
                </button>
              </div>
            ) : (() => {
              const filteredInvoices = invoices.filter(inv => {
                const clientName = getClientName(inv.client_id).toLowerCase();
                const matchesSearch = inv.invoice_number.toLowerCase().includes(invoiceSearchQuery.toLowerCase()) ||
                  clientName.includes(invoiceSearchQuery.toLowerCase());
                const matchesStatus = invoiceStatusFilter === 'All' || inv.status === invoiceStatusFilter;
                return matchesSearch && matchesStatus;
              });

              if (filteredInvoices.length === 0) {
                return (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
                    <div className="mx-auto w-12 h-12 bg-slate-50 text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                      <Search className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">No matching invoices found</h3>
                    <p className="text-slate-450 text-xs mt-1">Try adjusting your filters or search terms.</p>
                    <button
                      onClick={() => {
                        setInvoiceSearchQuery('');
                        setInvoiceStatusFilter('All');
                      }}
                      className="mt-4 text-[#378ADD] hover:underline text-xs font-bold"
                    >
                      Clear search filters
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Table headers (Visible on Desktop) */}
                  <div className="hidden lg:grid grid-cols-12 gap-4 px-6 text-[10px] uppercase font-bold text-slate-450 tracking-wider select-none">
                    <div className="col-span-4">Invoice & Client</div>
                    <div className="col-span-3">Billing Timeline</div>
                    <div className="col-span-2 text-right">Invoice Amount</div>
                    <div className="col-span-3 text-right">Actions</div>
                  </div>

                  {filteredInvoices.map((inv) => {
                    const statusColors = {
                      Paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                      Sent: 'border-blue-200 bg-blue-50 text-blue-700',
                      Overdue: 'border-rose-200 bg-rose-50 text-rose-700',
                      Draft: 'border-slate-250 bg-slate-100 text-slate-750'
                    };

                    const isOverdue = inv.status === 'Overdue';
                    const initials = getClientName(inv.client_id).substring(0, 2).toUpperCase();

                    return (
                      <div key={inv.id} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-250 overflow-hidden flex flex-col">

                        {/* Core Details Grid */}
                        <div className="p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">

                          {/* Invoice # / Badge dropdown & client initials stack */}
                          <div className="col-span-12 lg:col-span-4 flex items-start gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm mt-0.5">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-sm text-slate-800 tracking-tight font-sans">{inv.invoice_number}</span>

                                {/* Read-only status badge */}
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border select-none ${statusColors[inv.status] || statusColors.Draft}`}>
                                  {inv.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="w-4.5 h-4.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-[9px] font-bold shrink-0 select-none">
                                  {initials}
                                </div>
                                <span className="text-xs font-semibold text-slate-650 truncate">{getClientName(inv.client_id)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Billing dates timeline */}
                          <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-1 text-xs font-semibold">
                            <div className="flex items-center gap-2 text-slate-500">
                              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wide w-12">Issued</span>
                              <span>{inv.issue_date}</span>
                            </div>
                            <div className={`flex items-center gap-2 ${isOverdue ? 'text-rose-600 font-bold animate-pulse-once' : 'text-slate-500'}`}>
                              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wide w-12">Due</span>
                              <span className="flex items-center gap-1">
                                {inv.due_date}
                                {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                              </span>
                            </div>
                            {inv.sent_at && (
                              <div className="flex items-center gap-2 text-slate-500 font-medium">
                                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wide w-12">Sent</span>
                                <span>{formatSentDate(inv.sent_at)}</span>
                              </div>
                            )}
                          </div>

                          {/* Amount total & collapse toggle */}
                          <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-row lg:flex-col justify-between lg:justify-center items-center lg:items-end gap-2">
                            <div className="text-left lg:text-right space-y-0.5">
                              <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block lg:hidden font-semibold">Amount</span>
                              <div className="text-base font-extrabold text-slate-800 tracking-tight font-sans">{formatRupee(inv.total_amount)}</div>
                              <span className="text-[10px] text-slate-450 font-semibold block">
                                {parseFloat(inv.gst_amount) > 0 ? `Includes GST` : 'No GST'}
                              </span>
                            </div>

                            {/* Toggle Items Drawer button */}
                            <button
                              onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                              className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-650 hover:text-indigo-800 transition-colors bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/20 px-2 py-0.5 rounded-lg select-none"
                            >
                              <span>{expandedInvoiceId === inv.id ? 'Hide Details' : 'Details'}</span>
                              {expandedInvoiceId === inv.id ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Actions Buttons Group */}
                          <div className="col-span-12 lg:col-span-3 border-t lg:border-t-0 border-slate-100 pt-4 lg:pt-0 flex flex-wrap items-center justify-start lg:justify-end gap-2 shrink-0">

                            {/* HTML Web Preview */}
                            <button
                              onClick={() => handlePreviewHTML(inv.id)}
                              className="p-2 rounded-xl text-slate-500 hover:text-slate-850 hover:bg-slate-100 border border-slate-200/60 transition-all select-none"
                              title="Preview Receipt"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Download PDF file */}
                            <button
                              onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)}
                              className="p-2 rounded-xl text-slate-500 hover:text-slate-850 hover:bg-slate-100 border border-slate-200/60 transition-all select-none"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* Email Dispatch PDF */}
                            <button
                              onClick={() => handleSendInvoice(inv.id, inv.invoice_number)}
                              disabled={sendingInvoiceId === inv.id}
                              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-750 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/10 hover:shadow-md select-none"
                              title="Email invoice PDF to client"
                            >
                              {sendingInvoiceId === inv.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>{sendingInvoiceId === inv.id ? 'Sending...' : 'Send'}</span>
                            </button>

                            {/* Pay Now button */}
                            {inv.status !== 'Paid' && inv.status !== 'Draft' && (
                              <button
                                onClick={() => handlePayInvoice(inv)}
                                disabled={payingInvoiceId === inv.id}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-750 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/10 hover:shadow-md select-none"
                                title="Pay Invoice via Razorpay"
                              >
                                {payingInvoiceId === inv.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CreditCard className="w-3.5 h-3.5" />
                                )}
                                <span>{payingInvoiceId === inv.id ? 'Paying...' : 'Pay'}</span>
                              </button>
                            )}

                            {/* Delete button (glows soft red on hover) */}
                            <button
                              onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100/60 transition-all select-none"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Line Items Drawer details table */}
                        {expandedInvoiceId === inv.id && (
                          <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4 sm:px-6 transition-all duration-300">
                            {inv.razorpay_link_url && (inv.status === 'Sent' || inv.status === 'Overdue') && (
                              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
                                    <CreditCard className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-800">Razorpay Payment Link</p>
                                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Share this secure payment link with your client to collect payment instantly.</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(inv.razorpay_link_url);
                                      alert('Payment link copied to clipboard!');
                                    }}
                                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer select-none"
                                  >
                                    Copy Link
                                  </button>
                                  <a
                                    href={inv.razorpay_link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm hover:shadow flex items-center gap-1 select-none"
                                  >
                                    <span>Open Link</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            )}
                            {inv.status === 'Paid' && (
                              <div className="mb-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3 shadow-sm">
                                <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
                                  <CheckCircle className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">Invoice Paid</p>
                                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                    This invoice has been fully paid.
                                    {inv.razorpay_payment_id && ` Payment ID: ${inv.razorpay_payment_id}`}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2.5">
                              Line Items & Taxation Details
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-200/50 bg-white shadow-sm">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-150 bg-slate-50/80 text-slate-450 font-bold select-none">
                                    <th className="py-2.5 px-4 font-semibold">Description</th>
                                    <th className="py-2.5 px-4 text-center font-semibold w-16">Qty</th>
                                    <th className="py-2.5 px-4 text-right font-semibold w-28">Rate</th>
                                    <th className="py-2.5 px-4 text-right font-semibold w-28">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {inv.items && inv.items.map((item, idx) => (
                                    <tr key={item.id || idx} className="text-slate-605 hover:bg-slate-50/30">
                                      <td className="py-2.5 px-4 font-medium">{item.description}</td>
                                      <td className="py-2.5 px-4 text-center text-slate-450 font-mono font-medium">{item.quantity}</td>
                                      <td className="py-2.5 px-4 text-right text-slate-450 font-medium font-mono">{formatRupee(item.rate)}</td>
                                      <td className="py-2.5 px-4 text-right font-bold text-slate-700 font-mono">
                                        {formatRupee(item.quantity * item.rate)}
                                      </td>
                                    </tr>
                                  ))}
                                  {/* Subtotal & tax calculations */}
                                  <tr className="border-t border-slate-200/60 bg-slate-50/10">
                                    <td colSpan="2"></td>
                                    <td className="py-2 px-4 text-right text-slate-450 font-medium">Subtotal</td>
                                    <td className="py-2 px-4 text-right font-semibold text-slate-700 font-mono">{formatRupee(inv.subtotal)}</td>
                                  </tr>
                                  {parseFloat(inv.gst_amount) > 0 && (
                                    <tr className="bg-slate-50/10">
                                      <td colSpan="2"></td>
                                      <td className="py-2 px-4 text-right text-slate-450 font-medium">GST ({inv.gst_rate}%)</td>
                                      <td className="py-2 px-4 text-right font-semibold text-slate-700 font-mono">{formatRupee(inv.gst_amount)}</td>
                                    </tr>
                                  )}
                                  <tr className="border-t border-slate-200 bg-slate-50/30 font-bold">
                                    <td colSpan="2"></td>
                                    <td className="py-2.5 px-4 text-right text-slate-700 font-semibold">Total Amount</td>
                                    <td className="py-2.5 px-4 text-right text-[#042C53] text-xs font-extrabold font-mono">{formatRupee(inv.total_amount)}</td>
                                  </tr>
                                </tbody>
                              </table>
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
        ) : currentView === 'profile' ? (
          <ProfileSettings />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-400 select-none">
              <FileText className="w-4 h-4 text-slate-350" />
              <span className="text-xs font-bold text-slate-500 tracking-tight font-sans">
                Ledgr
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-semibold text-slate-400">
                © {new Date().getFullYear()} Ledgr App. All rights reserved.
              </span>
            </div>

            <div className="flex items-center gap-6">
              <a 
                href="#feedback"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Thank you for using Ledgr! Send feedback to support@ledgr.app');
                }}
                className="text-[11px] font-bold text-slate-450 hover:text-[#042C53] transition-colors cursor-pointer select-none"
              >
                Send Feedback
              </a>
              <span className="text-slate-200 select-none">•</span>
              <span className="text-[11px] font-bold text-slate-450 select-none">
                v1.1.0
              </span>
            </div>
          </div>
        </div>
      </footer>

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
          <div className="bg-white/90 backdrop-blur-md border border-emerald-100/85 shadow-2xl shadow-emerald-500/10 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden">
            {/* Top decorative line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
            
            {/* Success icon container */}
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <h4 className="text-xs font-bold text-slate-800">Email Sent</h4>
              <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-normal">
                {sendSuccessMsg}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={() => setSendSuccessMsg(null)}
              className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Linear auto-dismiss progress bar indicator */}
            <div 
              className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 animate-toast-progress" 
              style={{ animationDuration: '6000ms' }} 
            />
          </div>
        </div>
      )}

      {/* Floating success toast notification for verified payments */}
      {paySuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-toast-in max-w-sm w-full">
          <div className="bg-white/90 backdrop-blur-md border border-emerald-100/85 shadow-2xl shadow-emerald-500/10 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden">
            {/* Top decorative line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
            
            {/* Success icon container */}
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <h4 className="text-xs font-bold text-slate-800">Payment Received</h4>
              <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-normal">
                {paySuccessMsg}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={() => setPaySuccessMsg(null)}
              className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Linear auto-dismiss progress bar indicator */}
            <div 
              className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 animate-toast-progress" 
              style={{ animationDuration: '6000ms' }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    </AuthProvider>
  );
}
