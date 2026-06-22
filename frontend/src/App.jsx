import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { IndianRupee, FileText, Users, CheckCircle, Clock, Plus, TrendingUp, LogOut, Loader2, PlusCircle, AlertCircle, AlertTriangle, Trash2, Landmark, Mail, MapPin, Search, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ClientForm from './components/ClientForm';
import InvoiceForm from './components/InvoiceForm';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatRupee = (value) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(num);
};

function Dashboard() {
  const { user, session, signOut } = useAuth();
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'clients'
  const [clientSearchQuery, setClientSearchQuery] = useState('');

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

  // Aggregate Calculations
  const getStats = () => {
    let totalEarned = 0; // Total of Paid invoices
    let totalOutstanding = 0; // Total of Sent or Draft invoices
    let overdueCount = 0;

    invoices.forEach(inv => {
      const amt = parseFloat(inv.total_amount) || 0;
      if (inv.status === 'Paid') {
        totalEarned += amt;
      } else if (inv.status === 'Sent' || inv.status === 'Draft') {
        totalOutstanding += amt;
      } else if (inv.status === 'Overdue') {
        overdueCount++;
      }
    });

    return {
      totalEarned: totalEarned.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      overdueCount,
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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-600 p-2 rounded-lg text-white">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  InvoiceFlow
                </span>
              </div>
              
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    currentView === 'dashboard'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/20'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('clients')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    currentView === 'clients'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/20'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Clients
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-slate-600 text-xs hidden lg:inline-block bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-medium">
                {user?.email}
              </span>
              <button 
                onClick={() => setIsClientFormOpen(true)}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm"
              >
                <PlusCircle className="w-4 h-4 text-slate-500" />
                Add Client
              </button>
              <button 
                onClick={() => setIsInvoiceFormOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md shadow-indigo-600/10"
              >
                <Plus className="w-4 h-4" />
                New Invoice
              </button>
              <button 
                onClick={signOut}
                title="Sign Out"
                className="flex items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-sm p-4 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && invoices.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-slate-500 text-sm font-semibold">Loading metrics...</p>
          </div>
        ) : currentView === 'dashboard' ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 transition-all hover:border-slate-300 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl">
                    <IndianRupee className="w-6 h-6" />
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" /> +12%
                  </span>
                </div>
                <p className="text-slate-500 text-sm font-semibold">Total Earned</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{formatRupee(stats.totalEarned)}</h3>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 transition-all hover:border-slate-300 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-slate-500 text-sm font-semibold">Total Outstanding</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{formatRupee(stats.totalOutstanding)}</h3>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 transition-all hover:border-slate-300 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-slate-500 text-sm font-semibold">Overdue Invoices</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.overdueCount} Invoices</h3>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 transition-all hover:border-slate-300 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-purple-500/10 text-purple-650 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-slate-500 text-sm font-semibold">Active Clients</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.activeClientsCount} Clients</h3>
              </div>
            </div>

            {/* Charts & Table Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Revenue Chart */}
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold mb-6 text-slate-850 font-sans">Monthly Income Totals</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBarRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.95}/>
                          <stop offset="100%" stopColor="#818cf8" stopOpacity={0.7}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        labelStyle={{ color: '#64748b', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="revenue" fill="url(#colorBarRevenue)" radius={[6, 6, 0, 0]} barSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Invoices List */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col max-h-[390px] shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-slate-850">Recent Invoices</h3>
                
                <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                  {invoices.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                      <FileText className="w-8 h-8 opacity-40" />
                      <p className="text-xs">No invoices created yet</p>
                    </div>
                  ) : (
                    invoices.map((inv) => (
                      <div key={inv.id} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                        <div>
                          <h4 className="font-bold text-sm text-slate-700">{getClientName(inv.client_id)}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{inv.invoice_number} • {inv.issue_date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-800">{formatRupee(inv.total_amount)}</p>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${getStatusColor(inv.status)}`}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Clients Directory View */
          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-sans">Client Directory</h2>
                <p className="text-slate-550 text-xs font-semibold mt-0.5">Manage billing details and view client accounts</p>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Search className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-all"
                  />
                </div>
                
                <button
                  onClick={() => setIsClientFormOpen(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-indigo-600/10 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add Client
                </button>
              </div>
            </div>

            {/* Clients Grid */}
            {clients.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
                <div className="mx-auto w-12 h-12 bg-slate-100 text-slate-450 rounded-xl flex items-center justify-center mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">No clients added yet</h3>
                <p className="text-slate-550 text-xs mt-1">Get started by creating your first client profile.</p>
                <button
                  onClick={() => setIsClientFormOpen(true)}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-550 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
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
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700">No matching clients found</h3>
                    <p className="text-slate-550 text-xs mt-1">Try adjusting your search criteria.</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClients.map((client) => {
                    const clientInvoices = invoices.filter(inv => inv.client_id === client.id);
                    const totalBilled = clientInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
                    const initials = client.name.substring(0, 2).toUpperCase();

                    return (
                      <div key={client.id} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden">
                        {/* Card Body */}
                        <div className="p-6 space-y-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm select-none">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-base text-slate-800 truncate font-sans">{client.name}</h4>
                              {client.email ? (
                                <a href={`mailto:${client.email}`} className="text-indigo-600 hover:text-indigo-550 text-xs font-semibold flex items-center gap-1 truncate mt-0.5">
                                  <Mail className="w-3.5 h-3.5 shrink-0" />
                                  {client.email}
                                </a>
                              ) : (
                                <span className="text-slate-400 text-xs italic mt-0.5 block">No email listed</span>
                              )}
                            </div>
                          </div>

                          {/* Details fields */}
                          <div className="space-y-2 border-t border-slate-100 pt-3.5 text-xs text-slate-650">
                            {client.gst_number && (
                              <div className="flex items-center gap-2">
                                <Landmark className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-700">GSTIN: {client.gst_number}</span>
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                <span className="leading-relaxed line-clamp-2">{client.address}</span>
                              </div>
                            )}
                          </div>

                          {/* Summary Stats Grid */}
                          <div className="grid grid-cols-2 gap-3.5 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <div className="text-center sm:text-left">
                              <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Total Billed</p>
                              <p className="text-sm font-extrabold text-slate-800 mt-0.5">{formatRupee(totalBilled)}</p>
                            </div>
                            <div className="text-center sm:text-left border-l border-slate-200/60 pl-3.5">
                              <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Invoices</p>
                              <p className="text-sm font-extrabold text-slate-800 mt-0.5">{clientInvoices.length}</p>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-3.5 flex justify-end">
                          <button
                            onClick={() => handleDeleteClient(client.id, client.name)}
                            className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 px-3 py-1.5 rounded-xl transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove Client
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* Forms Modals */}
      <ClientForm 
        isOpen={isClientFormOpen} 
        onClose={() => setIsClientFormOpen(false)} 
        onSuccess={fetchData} 
      />

      <InvoiceForm 
        isOpen={isInvoiceFormOpen} 
        onClose={() => setIsInvoiceFormOpen(false)} 
        onSuccess={fetchData} 
        clients={clients}
      />
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
