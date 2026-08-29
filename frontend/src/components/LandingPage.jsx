import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  CreditCard,
  Clock,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Menu,
  X
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleCTA = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans antialiased flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b border-line">
        <div className="max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-[60px] h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => navigate('/')}>
            <span className="text-xl font-bold tracking-tight">Ledgr</span>
          </div>

          <nav className="hidden md:flex items-center gap-7">
            <button onClick={() => scrollToSection('features')} className="text-[14.5px] font-medium text-ink-soft hover:text-ink transition-colors cursor-pointer">
              How it works
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-[14.5px] font-medium text-ink-soft hover:text-ink transition-colors cursor-pointer">
              Pricing
            </button>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate(user ? '/dashboard' : '/login')}
              className="text-[14.5px] font-semibold border border-line-strong rounded-md px-[18px] py-[9px] hover:bg-line-soft transition-colors cursor-pointer"
            >
              {user ? 'Dashboard' : 'Sign in'}
            </button>
            <button
              onClick={handleCTA}
              className="text-[14.5px] font-semibold bg-ink text-white rounded-md px-[18px] py-[9px] hover:bg-ink-soft transition-colors cursor-pointer"
            >
              Get started
            </button>
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 rounded-lg text-ink-soft hover:bg-line-soft transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-paper border-b border-line px-6 py-6 space-y-4">
            <div className="flex flex-col gap-3 font-medium text-sm text-ink-soft">
              <button onClick={() => scrollToSection('features')} className="text-left py-1">How it works</button>
              <button onClick={() => scrollToSection('pricing')} className="text-left py-1">Pricing</button>
            </div>
            <div className="h-px bg-line my-2" />
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => { setIsMobileMenuOpen(false); navigate(user ? '/dashboard' : '/login'); }}
                className="w-full text-center py-2.5 text-sm font-semibold border border-line-strong rounded-md"
              >
                {user ? 'Dashboard' : 'Sign in'}
              </button>
              <button
                onClick={() => { setIsMobileMenuOpen(false); handleCTA(); }}
                className="w-full text-center py-2.5 text-sm font-semibold bg-ink text-white rounded-md"
              >
                Get started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-[60px] py-16 lg:py-[90px] grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-[60px] items-center">
        <div>
          <p className="m-0 mb-4 text-[13.5px] font-bold tracking-[0.08em] uppercase text-accent">For Indian freelancers</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[56px] font-medium tracking-[-0.01em] leading-[1.1]">
            An invoicing agent that chases the money so you don't have to.
          </h1>
          <p className="mt-6 text-[17px] leading-[1.65] text-ink-soft max-w-[46ch]">
            Ledgr sends the reminders, retries the failed payments, and keeps the GST math straight. It only interrupts you when a client actually needs a human — a dispute, a promise, a silence that's gone on too long.
          </p>
          <div className="flex flex-col sm:flex-row gap-3.5 mt-8">
            <button
              onClick={handleCTA}
              className="text-[15.5px] font-semibold bg-ink text-white rounded-md px-[26px] py-3.5 hover:bg-ink-soft transition-colors cursor-pointer"
            >
              Start invoicing free
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-[15.5px] font-semibold border border-line-strong rounded-md px-[26px] py-3.5 hover:bg-line-soft transition-colors cursor-pointer"
            >
              See how it works
            </button>
          </div>
          <p className="mt-5 text-[13.5px] text-muted">No card required. Built for INR and GST from the ground up.</p>
        </div>

        <div className="bg-white border border-line rounded-lg p-7">
          <p className="m-0 text-xs font-bold tracking-[0.06em] uppercase text-muted">What the agent did last night</p>
          <div className="mt-4.5 flex flex-col gap-4">
            <div className="border-l-2 border-good pl-3.5">
              <p className="m-0 text-[15px] leading-[1.55]">Sent a second reminder to <strong>TechSolutions</strong> — no reply yet.</p>
            </div>
            <div className="border-l-2 border-warn pl-3.5">
              <p className="m-0 text-[15px] leading-[1.55]">Retried a failed card for <strong>Nilesh Patra</strong> and sent a fresh link.</p>
            </div>
            <div className="border-l-2 border-bad pl-3.5">
              <p className="m-0 text-[15px] leading-[1.55]">Stopped chasing <strong>Karan Mehta</strong> after 3 silent reminders — flagged for you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-t border-line bg-white">
        <div className="max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-[60px] py-14 lg:py-[70px] grid grid-cols-1 sm:grid-cols-3 gap-10 lg:gap-12">
          <div>
            <p className="m-0 text-3xl font-bold tracking-[-0.02em]">3 minutes</p>
            <p className="mt-2.5 text-[15px] text-ink-soft leading-[1.6]">From line items to a sent invoice, GST calculated automatically.</p>
          </div>
          <div>
            <p className="m-0 text-3xl font-bold tracking-[-0.02em]">Human veto</p>
            <p className="mt-2.5 text-[15px] text-ink-soft leading-[1.6]">The agent stops on disputes and silence. You decide what happens next.</p>
          </div>
          <div>
            <p className="m-0 text-3xl font-bold tracking-[-0.02em]">Full log</p>
            <p className="mt-2.5 text-[15px] text-ink-soft leading-[1.6]">Every email, retry and reply is on record — nothing happens quietly.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-paper">
        <div className="max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-[60px]">
          <div className="max-w-2xl mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-[-0.01em]">Everything the agent needs to run collections for you</h2>
            <p className="mt-3 text-[15.5px] text-ink-soft leading-relaxed">Built specifically for freelancers who value speed, simplicity, and local compliance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FileText, title: 'GST-compliant invoicing', body: 'CGST, SGST and IGST calculated automatically from client location, with HSN/SAC codes.' },
              { icon: CreditCard, title: 'Razorpay checkout', body: 'Every invoice carries a secure payment link — UPI, cards, net banking or wallets.' },
              { icon: Clock, title: 'Automated reminders', body: 'The agent nudges clients before and after the due date, and retries failed payments.' },
              { icon: TrendingUp, title: 'A full paper trail', body: 'Every reminder, retry and reply is logged — you can see exactly what happened.' },
            ].map((f, i) => (
              <div key={i} className="border border-line rounded-lg p-6 bg-white flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-md bg-accent-soft text-accent-dark flex items-center justify-center mb-5">
                    <f.icon className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-[15.5px] font-bold tracking-tight">{f.title}</h3>
                  <p className="text-muted text-[13.5px] leading-relaxed mt-2">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-white border-t border-b border-line">
        <div className="max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-[60px]">
          <div className="max-w-2xl mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-[-0.01em]">Get paid in three simple steps</h2>
            <p className="mt-3 text-[15.5px] text-ink-soft leading-relaxed">Set up your invoicing pipeline in under five minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { n: '1', title: 'Add your client & bill', body: 'Add client profiles with GST details, then list your project milestones or hourly logs.' },
              { n: '2', title: 'Send with a payment link', body: 'Your client gets a clean email with a PDF invoice and a direct Razorpay link to settle up.' },
              { n: '3', title: 'The agent takes over', body: 'If the due date passes, Ledgr sends a reminder and updates your dashboard once paid.' },
            ].map((s) => (
              <div key={s.n} className="text-center space-y-3.5">
                <div className="w-11 h-11 rounded-full border border-ink flex items-center justify-center font-bold text-base mx-auto">{s.n}</div>
                <h3 className="text-[15.5px] font-bold tracking-tight">{s.title}</h3>
                <p className="text-muted text-[13.5px] max-w-xs mx-auto leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA */}
      <section id="pricing" className="py-20 bg-paper">
        <div className="max-w-[860px] mx-auto px-6 sm:px-10">
          <div className="bg-ink rounded-lg p-10 sm:p-14 text-white text-center space-y-6">
            <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-[-0.01em]">Simple, transparent, built for freelancers</h2>
            <p className="text-white/70 text-[15px] max-w-xl mx-auto leading-relaxed">We're in public beta — 100% free, unlimited invoicing, clients and automated reminders while we build.</p>

            <div className="bg-white/5 border border-white/15 rounded-lg p-6 max-w-xs mx-auto">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/60">Public beta pass</span>
              <div className="text-3xl font-bold mt-1">₹0 <span className="text-xs font-semibold text-white/60">/ forever</span></div>
              <div className="text-[11px] font-medium text-white/50 mt-2">No card required · Unlimited access</div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCTA}
                className="bg-white hover:bg-white/90 text-ink px-7 py-3.5 rounded-md font-semibold text-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Get started for free</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-4 text-[11px] font-semibold text-white/50">
              <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> DPDP compliant</span>
              <span>·</span>
              <span>Razorpay-powered</span>
              <span>·</span>
              <span>Made in India</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-[1240px] mx-auto w-full px-6 sm:px-10 lg:px-[60px] py-10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[13.5px] text-muted mt-auto">
        <span>© {new Date().getFullYear()} Ledgr</span>
        <div className="flex gap-5">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#contact">Contact</a>
        </div>
      </footer>
    </div>
  );
}
