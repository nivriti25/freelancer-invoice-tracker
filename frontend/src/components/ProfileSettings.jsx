import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { User, MapPin, Landmark, CreditCard, Hash, Save, Loader2, AlertCircle, CheckCircle, Mail } from 'lucide-react';

export default function ProfileSettings() {
  const { user } = useAuth();

  // Form State
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (data) {
          setFullName(data.full_name || '');
          setBusinessName(data.business_name || '');
          setAddress(data.address || '');
          setGstNumber(data.gst_number || '');
          if (data.bank_details) {
            setBankName(data.bank_details.bank_name || '');
            setAccountNumber(data.bank_details.account_number || '');
            setIfscCode(data.bank_details.ifsc_code || '');
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to fetch profile settings.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    if (fullName.trim() === '') {
      setError('Full Name is required.');
      setSaving(false);
      return;
    }

    if (gstNumber.trim() !== '') {
      if (gstNumber.trim().length !== 15) {
        setError('GST Number must be exactly 15 characters.');
        setSaving(false);
        return;
      }
      if (!GST_REGEX.test(gstNumber.trim())) {
        setError('Invalid GST Number format. Standard format: 22AAAAA1111A1Z1');
        setSaving(false);
        return;
      }
    }

    if (ifscCode.trim() !== '') {
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
      if (!ifscRegex.test(ifscCode.trim())) {
        setError('Invalid IFSC Code format. E.g. SBIN0001234');
        setSaving(false);
        return;
      }
    }

    try {
      const profileUpdates = {
        id: user.id,
        full_name: fullName.trim(),
        business_name: businessName.trim() || null,
        address: address.trim() || null,
        gst_number: gstNumber.trim().toUpperCase() || null,
        bank_details: {
          bank_name: bankName.trim() || null,
          account_number: accountNumber.trim() || null,
          ifsc_code: ifscCode.trim().toUpperCase() || null,
          account_holder_name: fullName.trim() || null,
        },
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(profileUpdates);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'An error occurred while saving profile settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-80 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#042C53]" />
        <p className="text-slate-500 text-sm font-semibold">Loading profile settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm px-5 py-3.5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">Profile Settings</h2>
          <p className="text-slate-500 text-[11px] font-semibold mt-0.5">
            Business details &amp; banking info used across your invoices.
          </p>
        </div>

        {/* Email badge */}
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-medium shrink-0">
          <Mail className="w-3.5 h-3.5 text-slate-400" />
          {user?.email}
        </span>
      </div>

      {/* ── Notifications ───────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold p-3 rounded-xl shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold p-3 rounded-xl shadow-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Profile saved! Your details will reflect on all invoices.</span>
        </div>
      )}

      {/* ── Two-column form grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Card 1: Business Identity */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3">
          <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100 pb-2">
            Business Information
          </h3>

          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Full Name *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                placeholder="e.g. Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          {/* Business Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Business Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. Acme Consulting Services"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          {/* GST Number */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">GSTIN / Tax Number</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Landmark className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. 29AAAAA1111A1Z1"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          {/* Business Address */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Business Address</label>
            <div className="relative">
              <span className="absolute top-2.5 left-3 text-slate-400">
                <MapPin className="w-4 h-4" />
              </span>
              <textarea
                rows={2}
                placeholder="Street, City, State, Zip Code"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Bank Details */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3">
          <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100 pb-2">
            Bank Transfer Details
          </h3>

          {/* Bank Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Bank Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Landmark className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. HDFC Bank, ICICI Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          {/* Account Number */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Account Number</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <CreditCard className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. 50100234567890"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          {/* IFSC Code */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">IFSC Code</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Hash className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. HDFC0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]/25 transition-all"
              />
            </div>
          </div>

          {/* Note */}
          <div className="bg-[#378ADD]/5 border border-[#378ADD]/15 rounded-xl p-3 text-[11px] text-slate-500 leading-relaxed">
            💡 Bank details are embedded into invoice PDFs &amp; HTML previews for wire transfers.
          </div>

          {/* Save Button — lives inside the bank card to avoid extra scroll */}
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-[#042C53] to-[#378ADD] hover:from-[#042C53] hover:to-[#042C53] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-[#042C53]/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile Details
              </>
            )}
          </button>
        </div>

      </div>
    </form>
  );
}
