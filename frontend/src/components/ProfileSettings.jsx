import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle, CheckCircle, Mail } from 'lucide-react';

const AGENT_PERMISSIONS = [
  { label: 'Send reminder emails', on: true },
  { label: 'Retry failed card payments', on: true },
  { label: 'Offer a payment plan up to ₹10,000', on: false },
  { label: 'Escalate tone after 3 reminders', on: false },
];

function PermissionToggle({ on }) {
  return (
    <span className={`w-[38px] h-[22px] rounded-full relative shrink-0 inline-block ${on ? 'bg-good' : 'bg-line-strong'}`}>
      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white block transition-all ${on ? 'right-[3px]' : 'left-[3px]'}`} />
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full px-3.5 py-2.5 border border-line-strong rounded-md text-ink text-[14.5px] placeholder-muted focus:outline-none focus:border-ink transition-colors bg-white";

export default function ProfileSettings() {
  const { user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

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
        <Loader2 className="w-6 h-6 animate-spin text-ink" />
        <p className="text-muted text-sm font-medium">Loading profile settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <h1 className="m-0 text-[34px] font-bold tracking-[-0.025em]">Settings</h1>
      <p className="mt-2 text-[15.5px] text-muted">Your details, your bank, and what the agent's allowed to do.</p>

      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-[13px] font-medium p-3.5 rounded-md mt-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[13px] font-medium p-3.5 rounded-md mt-6">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Profile saved! Your details will reflect on all invoices.</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-9 mb-4 pb-2 border-b border-line">
        <h2 className="m-0 text-base font-bold">Profile</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted font-medium">
          <Mail className="w-3.5 h-3.5" />
          {user?.email}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        <Field label="Full name *">
          <input type="text" required placeholder="e.g. Ananya Rao" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Business name">
          <input type="text" placeholder="e.g. Studio Ananya" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="GSTIN / Tax number">
          <input type="text" placeholder="e.g. 29AAAAA1111A1Z1" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Business address">
          <textarea rows={2} placeholder="Street, city, state, zip code" value={address} onChange={(e) => setAddress(e.target.value)} className={`${inputClass} resize-none`} />
        </Field>
      </div>

      <h2 className="mt-9 mb-4 pb-2 border-b border-line text-base font-bold">Bank details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Bank name">
          <input type="text" placeholder="e.g. HDFC Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Account holder">
          <input type="text" value={fullName || ''} disabled className={`${inputClass} bg-line-soft text-muted cursor-not-allowed`} />
        </Field>
        <Field label="Account number">
          <input type="text" placeholder="e.g. 50100234567890" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputClass} />
        </Field>
        <Field label="IFSC">
          <input type="text" placeholder="e.g. HDFC0001234" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <p className="mt-3 text-[12.5px] text-muted leading-relaxed">Bank details are embedded into invoice PDFs &amp; previews for wire transfers.</p>

      <h2 className="mt-9 mb-1 text-base font-bold">Agent permissions</h2>
      <p className="mb-2 text-[13.5px] text-muted">What the agent is allowed to do without asking you first.</p>
      <div className="border-t border-line">
        {AGENT_PERMISSIONS.map((p) => (
          <div key={p.label} className="flex justify-between items-center gap-4 py-[15px] border-b border-line-soft">
            <p className="m-0 text-[14.5px] leading-[1.45]">{p.label}</p>
            <PermissionToggle on={p.on} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted leading-relaxed">Anything switched off comes to you as a decision instead. The agent never changes an invoice amount on its own.</p>

      <button
        type="submit"
        disabled={saving}
        className="mt-7 flex items-center justify-center gap-2 bg-ink hover:bg-ink-soft disabled:opacity-60 text-white px-6 py-3 rounded-md text-[14.5px] font-semibold transition-colors cursor-pointer"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving changes...
          </>
        ) : (
          'Save changes'
        )}
      </button>
    </form>
  );
}
