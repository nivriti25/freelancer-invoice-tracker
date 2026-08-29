import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

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
    <div className="min-h-screen flex flex-wrap font-sans antialiased">
      {/* Left panel */}
      <div className="w-full lg:w-1/2 min-w-[340px] flex-1 bg-ink text-white p-9 sm:p-14 flex flex-col justify-between min-h-[420px] lg:min-h-screen">
        <span className="text-xl font-bold tracking-tight">Ledgr</span>

        <div className="max-w-md my-10 lg:my-0">
          <p className="m-0 mb-4 text-[13.5px] font-bold tracking-[0.08em] uppercase text-muted-2">While you're away</p>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-[34px] font-medium leading-[1.25]">
            "The agent chases every reminder, retries every failed card, and only wakes you when a client actually needs you."
          </h2>
          <p className="mt-4 text-[14.5px] text-white/60">Sign in to see what it's been doing.</p>
        </div>

        <p className="m-0 text-[13px] text-muted-2">Built for Indian freelancers. Razorpay-powered, GST-aware.</p>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 min-w-[340px] flex-1 bg-white p-9 sm:p-14 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div>
            <h1 className="m-0 text-2xl font-bold tracking-[-0.02em] text-ink">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="mt-1.5 text-muted text-[14.5px]">
              {isLogin ? "Sign in to see what the agent's been doing." : 'Set up your invoicing agent in a couple of minutes.'}
            </p>
          </div>

          <div className="flex gap-0.5 bg-line-soft p-1 rounded-md">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
              className={`flex-1 py-1.5 text-[13px] font-semibold rounded transition-colors cursor-pointer ${isLogin ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
              className={`flex-1 py-1.5 text-[13px] font-semibold rounded transition-colors cursor-pointer ${!isLogin ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3.5 rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3.5 rounded-md">
                <span>{success}</span>
              </div>
            )}

            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-ink-soft">Full name</label>
                <input
                  type="text"
                  required
                  placeholder="Ananya Rao"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="px-3.5 py-2.5 border border-line-strong rounded-md text-[14.5px] text-ink focus:outline-none focus:border-ink transition-colors"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink-soft">Email address</label>
              <input
                type="email"
                required
                placeholder="you@studio.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3.5 py-2.5 border border-line-strong rounded-md text-[14.5px] text-ink focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink-soft">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-3.5 py-2.5 border border-line-strong rounded-md text-[14.5px] text-ink focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            {isLogin && (
              <div className="flex justify-end">
                <a href="#forgot" className="text-[13px] font-semibold text-ink hover:text-accent transition-colors">
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink hover:bg-ink-soft disabled:opacity-60 text-white py-3 rounded-md font-semibold text-[14.5px] transition-colors flex items-center justify-center gap-2 mt-1 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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

          <p className="text-center text-[13.5px] text-muted">
            {isLogin ? (
              <>New here? <button type="button" onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }} className="text-ink font-semibold hover:text-accent">Create an account</button></>
            ) : (
              <>Already have an account? <button type="button" onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }} className="text-ink font-semibold hover:text-accent">Sign in</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
