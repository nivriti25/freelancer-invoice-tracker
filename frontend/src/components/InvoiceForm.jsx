import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Plus, Trash2, Calculator, Loader2, AlertCircle } from 'lucide-react';

const formatRupee = (value) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(num);
};

export default function InvoiceForm({ isOpen, onClose, onSuccess, clients }) {
  const { session } = useAuth();
  
  // Set default dates
  const todayStr = new Date().toISOString().substring(0, 10);
  const defaultDueStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(defaultDueStr);
  const [status, setStatus] = useState('Draft');
  
  // Dynamic items list state
  const [items, setItems] = useState([
    { description: '', quantity: '1', rate: '0', gst_rate: '18.00' }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-generate invoice number format (e.g., INV-YYMM-XXX) on open
  useEffect(() => {
    if (isOpen) {
      const randomId = Math.floor(100 + Math.random() * 900);
      const dateCode = new Date().toISOString().substring(2, 7).replace('-', '');
      setInvoiceNumber(`INV-${dateCode}-${randomId}`);
      if (clients && clients.length > 0) {
        setClientId(clients[0].id);
      } else {
        setClientId('');
      }
    }
  }, [isOpen, clients]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: '1', rate: '0', gst_rate: '18.00' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return; // Keep at least one item
    const newItems = items.filter((_, idx) => idx !== index);
    setItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  // Math Calculations (Real-Time Preview)
  const calculateTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;

    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gst = parseFloat(item.gst_rate) || 0;
      
      const itemSub = qty * rate;
      const itemTax = itemSub * (gst / 100);
      
      subtotal += itemSub;
      taxTotal += itemTax;
    });

    const grandTotal = subtotal + taxTotal;
    return {
      subtotal: subtotal.toFixed(2),
      tax: taxTotal.toFixed(2),
      total: grandTotal.toFixed(2)
    };
  };

  const totals = calculateTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Dynamic field validation
    if (!clientId) {
      setError('Please select a client.');
      setLoading(false);
      return;
    }

    const hasEmptyItem = items.some(item => !item.description.trim() || parseFloat(item.quantity) <= 0 || parseFloat(item.rate) < 0);
    if (hasEmptyItem) {
      setError('Please ensure all items have descriptions, positive quantities, and valid rates.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        client_id: clientId,
        invoice_number: invoiceNumber.trim(),
        issue_date: issueDate,
        due_date: dueDate,
        status: status,
        items: items.map(item => ({
          description: item.description.trim(),
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.rate),
          gst_rate: parseFloat(item.gst_rate)
        }))
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        const details = errData.detail;
        const errMsg = typeof details === 'string' 
          ? details 
          : Array.isArray(details) 
            ? details.map(d => d.msg).join(', ') 
            : 'Failed to create invoice.';
        throw new Error(errMsg);
      }

      const newInvoice = await response.json();
      onSuccess(newInvoice);
      onClose();
      // Reset items list
      setItems([{ description: '', quantity: '1', rate: '0', gst_rate: '18.00' }]);
    } catch (err) {
      setError(err.message || 'An error occurred while creating invoice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800 font-sans">Draft New Invoice</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 bg-white">
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Invoice Header Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Select Client *</label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              >
                <option value="" disabled>-- Select Client --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Invoice Number *</label>
              <input
                type="text"
                required
                placeholder="INV-XXXX"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Issue Date *</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Due Date *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Invoice Items Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            {/* List of Items */}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl items-start md:items-center">
                  <div className="flex-1 w-full space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="Item Description (e.g. Design Consulting)"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                    <div className="space-y-0.5">
                      <input
                        type="number"
                        required
                        min="1"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm text-center focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        placeholder="Rate"
                        value={item.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm text-center focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-0.5 relative">
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        placeholder="GST %"
                        value={item.gst_rate}
                        onChange={(e) => handleItemChange(idx, 'gst_rate', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm text-center focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length === 1}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors self-end md:self-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Math Calculations Summary Drawer */}
          <div className="border border-slate-200 pt-4 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Calculator className="w-4.5 h-4.5 text-indigo-650" />
              <span>GST calculations are previewed automatically</span>
            </div>
            
            <div className="w-full md:w-64 space-y-1.5 text-sm font-semibold">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Subtotal:</span>
                <span>{formatRupee(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-medium">
                <span>GST Tax (calculated):</span>
                <span>{formatRupee(totals.tax)}</span>
              </div>
              <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1.5 text-base font-bold">
                <span>Grand Total:</span>
                <span className="text-indigo-600">{formatRupee(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-550 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Invoice...
                </>
              ) : (
                'Save Invoice'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
