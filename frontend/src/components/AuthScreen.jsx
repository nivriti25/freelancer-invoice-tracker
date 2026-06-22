import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, AlertCircle, FileText, Loader2, Shield, CheckCircle2, CreditCard } from 'lucide-react';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (isLogin) {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
      }
    } else {
      const { error: signUpError } = await signUp(email, password, {
        data: {
          name: fullName
        }
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
      } else {
        setSuccess('Account created! Please check your email to verify or sign in directly if email confirmation is disabled.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased overflow-hidden">
      
      {/* Left Panel: Fintech Branding & Feature Showcases (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-100 border-r border-slate-200/80 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative subtle ambient light */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2"></div>

        {/* Header Logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="bg-indigo-600 p-2 rounded-xl text-white">
            <FileText className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-800">
            InvoiceFlow
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-600/10 px-2 py-0.5 rounded-full">
            Fintech API
          </span>
        </div>

        {/* Content Showcase */}
        <div className="max-w-md my-auto space-y-8 relative z-10">
          <div className="space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight leading-[115%] text-slate-800">
              The modern billing infrastructure for freelancers.
            </h2>
            <p className="text-slate-555 text-base leading-relaxed">
              Automate invoice creation, manage dynamic clients, and track GST compliance in real-time on our secure transactional platform.
            </p>
          </div>

          {/* Fintech Value Propositions */}
          <div className="space-y-4 pt-2">
            <div className="flex gap-4 items-start">
              <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-700">Secure Database Sandboxing</h4>
                <p className="text-xs text-slate-500 mt-0.5">Row Level Security (RLS) policies isolate your data at the database layer.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="p-2 bg-purple-500/10 text-purple-650 rounded-lg shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-700">18% GST Automated Calculation</h4>
                <p className="text-xs text-slate-500 mt-0.5">Transactional math handles decimal calculations correctly with no precision leaks.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="p-2 bg-emerald-500/10 text-emerald-650 rounded-lg shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-700">Razorpay Order Creation</h4>
                <p className="text-xs text-slate-500 mt-0.5">Ready to bind with leading payment processors for instant settlements.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-xs text-slate-400 relative z-10 font-semibold">
          © {new Date().getFullYear()} InvoiceFlow Inc. All rights reserved. Secure transactions powered by Supabase.
        </div>
      </div>

      {/* Right Panel: Minimalist Fintech Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
        <div className="w-full max-w-sm space-y-8">
          
          {/* Header (visible on mobile only) */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8 text-center">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-2xl tracking-tight text-slate-800">
              InvoiceFlow
            </h1>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold tracking-tight text-slate-800">
              {isLogin ? 'Sign in to dashboard' : 'Create billing account'}
            </h3>
            <p className="text-slate-500 text-sm">
              {isLogin ? 'Enter your credentials to manage invoices' : 'Fill in the form to set up your profile'}
            </p>
          </div>

          {/* Form */}
          <form 
            onSubmit={handleSubmit} 
            autoComplete="off" 
            className="space-y-4"
          >
            {error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3.5 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3.5 rounded-xl">
                <span>{success}</span>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Mail className="w-4.5 h-4.5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="new-email"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-500">Password</label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Lock className="w-4.5 h-4.5" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-550 disabled:bg-indigo-650/50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Toggle Tab Footer */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); }}
              className="text-xs text-indigo-600 hover:text-indigo-500 font-semibold transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
