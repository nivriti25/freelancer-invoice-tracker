/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Loader2, AlertCircle } from 'lucide-react';

const inputClass = "w-full px-3.5 py-2.5 border border-line-strong rounded-md text-ink placeholder-muted text-sm focus:outline-none focus:border-ink transition-colors bg-white";

export default function ClientForm({ isOpen, onClose, onSuccess, clientToEdit }) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (clientToEdit) {
      setName(clientToEdit.name || '');
      setEmail(clientToEdit.email || '');
      setPhone(clientToEdit.phone || '');
      setGstNumber(clientToEdit.gst_number || '');
      setAddress(clientToEdit.address || '');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setGstNumber('');
      setAddress('');
    }
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Simple client-side validation
    if (gstNumber && gstNumber.trim().length !== 15) {
      setError('GST Number must be exactly 15 characters.');
      setLoading(false);
      return;
    }

    try {
      const url = clientToEdit
        ? `${import.meta.env.VITE_API_URL}/clients/${clientToEdit.id}`
        : `${import.meta.env.VITE_API_URL}/clients`;
      const method = clientToEdit ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          gst_number: gstNumber.trim().toUpperCase() || null,
          address: address.trim() || null
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        const details = errData.detail;
        const errMsg = typeof details === 'string'
          ? details
          : Array.isArray(details)
            ? details.map(d => d.msg).join(', ')
            : `Failed to ${clientToEdit ? 'update' : 'create'} client.`;
        throw new Error(errMsg);
      }

      const newClient = await response.json();
      onSuccess(newClient);
      onClose();
      // Reset form
      setName('');
      setEmail('');
      setPhone('');
      setGstNumber('');
      setAddress('');
    } catch (err) {
      setError(err.message || `An error occurred while ${clientToEdit ? 'updating' : 'creating'} client.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/45" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="bg-white border border-line w-full max-w-md rounded-lg overflow-hidden shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
          <h3 className="font-bold text-[19px] text-ink m-0">{clientToEdit ? 'Edit client' : 'Add new client'}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-muted hover:text-ink hover:bg-line-soft transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-7 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3.5 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-soft">Client name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-soft">Email address</label>
            <input
              type="email"
              placeholder="e.g. billing@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-soft">Phone number</label>
            <input
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-soft">GST number (optional)</label>
            <input
              type="text"
              placeholder="15-character GSTIN"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-soft">Billing address</label>
            <textarea
              rows="3"
              placeholder="Corporate billing address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-md border border-line-strong hover:bg-line-soft text-ink-soft font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-ink hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                clientToEdit ? 'Update client' : 'Save client'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
