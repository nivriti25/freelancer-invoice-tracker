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

const inputClass = "w-full px-3 py-2.5 border border-line-strong rounded-md text-ink placeholder-muted text-sm focus:outline-none focus:border-ink transition-colors bg-white";

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
      <div className="absolute inset-0 bg-ink/45" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="bg-white border border-line w-full max-w-3xl rounded-lg overflow-hidden shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-line">
          <h3 className="font-bold text-[19px] text-ink m-0">New invoice</h3>
          <button onClick={onClose} className="p-1 rounded-md text-muted hover:text-ink hover:bg-line-soft transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-7 flex flex-col gap-5.5 flex-1 bg-white">
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3.5 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Invoice Header Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink-soft">Client *</label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>-- Select client --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink-soft">Invoice number *</label>
              <input
                type="text"
                required
                placeholder="INV-XXXX"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink-soft">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink-soft">Issue date *</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink-soft">Due date *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Invoice Items Section */}
          <div className="flex flex-col gap-3.5">
            <div className="flex justify-between items-center border-b border-line pb-2.5">
              <label className="text-[13px] font-bold uppercase tracking-wider text-muted">Line items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-[13.5px] font-semibold text-accent hover:text-accent-dark transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>

            {/* List of Items */}
            <div className="flex flex-col gap-3 md:gap-1.5">
              {/* Header for Desktop */}
              <div className="hidden md:grid md:grid-cols-[1fr_70px_120px_80px_110px_36px] gap-3 px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                <div>Description</div>
                <div className="text-center">Qty</div>
                <div>Rate (₹)</div>
                <div>GST %</div>
                <div className="text-right">Total</div>
                <div></div>
              </div>

              {items.map((item, idx) => {
                const qty = parseFloat(item.quantity) || 0;
                const rate = parseFloat(item.rate) || 0;
                const gst = parseFloat(item.gst_rate) || 0;
                const rowTotal = qty * rate * (1 + gst / 100);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-2 md:grid-cols-[1fr_70px_120px_80px_110px_36px] gap-3 border border-line-soft md:border-0 md:border-b md:border-line-soft p-3.5 md:p-1.5 rounded-md md:rounded-none items-start md:items-center animate-in fade-in-50 duration-200"
                  >
                    {/* Description */}
                    <div className="col-span-2 md:col-span-1 w-full">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted md:hidden">Description</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Design consulting"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className={`${inputClass} py-2`}
                      />
                    </div>

                    {/* Qty */}
                    <div className="w-full">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted md:hidden">Qty</label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className={`${inputClass} py-2 text-center`}
                      />
                    </div>

                    {/* Rate */}
                    <div className="w-full">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted md:hidden">Rate (₹)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={item.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        className={`${inputClass} py-2`}
                      />
                    </div>

                    {/* GST % */}
                    <div className="w-full">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted md:hidden">GST %</label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        placeholder="18"
                        value={item.gst_rate}
                        onChange={(e) => handleItemChange(idx, 'gst_rate', e.target.value)}
                        className={`${inputClass} py-2`}
                      />
                    </div>

                    {/* Total Amount Preview */}
                    <div className="w-full md:text-right">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted md:hidden">Amount</label>
                      <div className="py-2 text-sm font-semibold text-ink flex items-center md:justify-end h-[38px] md:h-auto">
                        {formatRupee(rowTotal)}
                      </div>
                    </div>

                    {/* Delete Action */}
                    <div className="col-span-2 md:col-span-1 w-full flex justify-end md:justify-center items-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                        className="p-2 rounded-md text-muted hover:text-bad hover:bg-line-soft disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5 md:mr-0" />
                        <span className="text-xs font-semibold md:hidden">Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Math Calculations Summary Drawer */}
          <div className="border border-line flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 p-5 rounded-md">
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <Calculator className="w-4.5 h-4.5 text-accent" />
              <span>GST calculations are previewed automatically</span>
            </div>

            <div className="w-full md:w-64 flex flex-col gap-1.5 text-[14.5px]">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatRupee(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>GST</span>
                <span>{formatRupee(totals.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 text-[17px] font-bold">
                <span>Total</span>
                <span>{formatRupee(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-md border border-line-strong hover:bg-line-soft text-ink-soft font-semibold text-[14.5px] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-ink hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-md font-semibold text-[14.5px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving invoice...
                </>
              ) : (
                'Save invoice'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
