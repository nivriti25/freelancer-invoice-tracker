import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Coins, ArrowRight, FileText, AlertCircle, Loader2 } from 'lucide-react';

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

    try {
      if (isLogin) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await signUp(email, password, {
          data: {
            name: fullName
          }
        });
        if (signUpError) throw signUpError;
        setSuccess('Account created! Please check your email to verify or sign in directly if email confirmation is disabled.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-white text-[#042C53] flex flex-col lg:flex-row font-sans antialiased overflow-y-auto">
      
      {/* Left Panel: Navy Background */}
      <div className="w-full lg:w-1/2 bg-[#042C53] text-white p-12 flex flex-col justify-between min-h-[500px] lg:min-h-screen">
        {/* Top brand logo area */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#378ADD] flex items-center justify-center text-white">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-[#85B7EB] font-medium text-lg">Ledgr</span>
        </div>

        {/* Headline */}
        <h2 className="text-3xl lg:text-4xl font-medium tracking-tight text-white max-w-md my-auto leading-tight">
          Invoice smarter. <span className="text-[#85B7EB]">Get paid</span> faster.
        </h2>

        {/* Stats Grid & Footnote container */}
        <div className="space-y-6">
          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-[#378ADD]/10 border border-[#B5D4F4]/20 flex flex-col justify-between min-h-[90px]">
              <span className="text-xl lg:text-2xl font-medium text-white">3 min</span>
              <span className="text-xs text-[#85B7EB] mt-1 font-normal">To send an invoice</span>
            </div>
            <div className="p-4 rounded-lg bg-[#378ADD]/10 border border-[#B5D4F4]/20 flex flex-col justify-between min-h-[90px]">
              <span className="text-xl lg:text-2xl font-medium text-white">18%</span>
              <span className="text-xs text-[#85B7EB] mt-1 font-normal">GST auto-applied</span>
            </div>
            <div className="p-4 rounded-lg bg-[#378ADD]/10 border border-[#B5D4F4]/20 flex flex-col justify-between min-h-[90px]">
              <span className="text-xl lg:text-2xl font-medium text-white">Zero</span>
              <span className="text-xs text-[#85B7EB] mt-1 font-normal">Overdue surprises</span>
            </div>
            <div className="p-4 rounded-lg bg-[#378ADD]/10 border border-[#B5D4F4]/20 flex flex-col justify-between min-h-[90px]">
              <span className="text-xl lg:text-2xl font-medium text-white">INR</span>
              <span className="text-xs text-[#85B7EB] mt-1 font-normal">Native currency</span>
            </div>
          </div>

          {/* Footnote */}
          <div className="text-xs text-[#85B7EB]/70 font-normal">
            Built for Indian freelancers. Razorpay-powered.
          </div>
        </div>
      </div>

      {/* Right Panel: White Background */}
      <div className="w-full lg:w-1/2 bg-white p-12 flex flex-col justify-between min-h-[600px] lg:min-h-screen">
        {/* Mobile brand header (hidden on desktop) */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#378ADD] flex items-center justify-center text-white">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-[#042C53] font-medium text-lg">Ledgr</span>
        </div>
        <div className="hidden lg:block"></div>

        {/* Form Container */}
        <div className="w-full max-w-sm mx-auto my-auto space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium text-[#042C53] tracking-tight">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-[#888780] text-sm font-normal">
              {isLogin ? 'Enter your credentials to access your account' : 'Fill in the details to register your profile'}
            </p>
          </div>

          {/* Tabs */}
          <div className="inline-flex p-1 bg-[#D3D1C7]/30 rounded-full w-full">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-colors ${
                isLogin ? 'bg-[#042C53] text-white' : 'text-[#042C53] hover:text-[#042C53]/80'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-colors ${
                !isLogin ? 'bg-[#042C53] text-white' : 'text-[#042C53] hover:text-[#042C53]/80'
              }`}
            >
              Create account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3.5 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-normal">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3.5 rounded-lg">
                <span className="font-normal">{success}</span>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#888780]">Full name</label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#B5D4F4] rounded-lg text-sm text-[#042C53] placeholder-[#888780]/40 focus:outline-none focus:ring-1 focus:ring-[#378ADD] focus:border-[#378ADD] transition-colors font-normal"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#888780]">Email address</label>
              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#B5D4F4] rounded-lg text-sm text-[#042C53] placeholder-[#888780]/40 focus:outline-none focus:ring-1 focus:ring-[#378ADD] focus:border-[#378ADD] transition-colors font-normal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#888780]">Password</label>
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#B5D4F4] rounded-lg text-sm text-[#042C53] placeholder-[#888780]/40 focus:outline-none focus:ring-1 focus:ring-[#378ADD] focus:border-[#378ADD] transition-colors font-normal"
              />
            </div>

            {isLogin && (
              <div className="flex justify-end">
                <a href="#forgot" className="text-xs font-medium text-[#378ADD] hover:text-[#378ADD]/80 transition-colors">
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#042C53] hover:bg-[#042C53]/95 text-white py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Badges Footer */}
        <div className="flex flex-wrap justify-center items-center gap-2 text-xs text-[#888780] pt-6 border-t border-[#D3D1C7]/30">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#378ADD]" />
            <span>Bank-grade security</span>
          </span>
          <span className="text-[#D3D1C7] font-normal">•</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-[#378ADD]" />
            <span>DPDP compliant</span>
          </span>
          <span className="text-[#D3D1C7] font-normal">•</span>
          <span className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-[#378ADD]" />
            <span>INR only</span>
          </span>
        </div>
      </div>

    </div>
  );
}
