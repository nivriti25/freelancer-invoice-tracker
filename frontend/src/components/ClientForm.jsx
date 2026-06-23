import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Mail, Phone, Landmark, MapPin, Loader2, AlertCircle } from 'lucide-react';

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
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">{clientToEdit ? 'Edit Client Details' : 'Add New Client'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Client Name *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                required
                placeholder="e.g. Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Mail className="w-4.5 h-4.5" />
              </span>
              <input
                type="email"
                placeholder="e.g. billing@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Phone Number</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Phone className="w-4.5 h-4.5" />
              </span>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">GST Number (Optional)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Landmark className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                placeholder="15-character GSTIN"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Billing Address</label>
            <div className="relative">
              <span className="absolute top-3 left-3.5 text-slate-400">
                <MapPin className="w-4.5 h-4.5" />
              </span>
              <textarea
                rows="3"
                placeholder="Corporate billing address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#042C53] hover:bg-[#378ADD] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                clientToEdit ? 'Update Client' : 'Save Client'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
