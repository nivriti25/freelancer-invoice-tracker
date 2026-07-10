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
  ArrowUpRight, 
  ShieldCheck, 
  Sparkles,
  ChevronRight,
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
    <div className="min-h-screen bg-slate-50 text-[#042C53] font-sans antialiased flex flex-col">
      {/* Sticky Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#042C53] to-[#378ADD] flex items-center justify-center text-white shadow-sm">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <span className="font-extrabold text-lg text-slate-800 tracking-tight">
              Ledgr<span className="text-[#378ADD]">.</span>
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 font-semibold text-xs text-slate-600">
            <button 
              onClick={() => scrollToSection('features')} 
              className="hover:text-[#042C53] transition-colors cursor-pointer text-left"
            >
              Features
            </button>
            <button 
              onClick={() => scrollToSection('how-it-works')} 
              className="hover:text-[#042C53] transition-colors cursor-pointer text-left"
            >
              How It Works
            </button>
            <button 
              onClick={() => scrollToSection('pricing')} 
              className="hover:text-[#042C53] transition-colors cursor-pointer text-left"
            >
              Pricing
            </button>
          </nav>

          {/* Nav Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => navigate(user ? '/dashboard' : '/login')} 
              className="text-xs font-bold text-slate-700 hover:text-[#042C53] transition-colors cursor-pointer"
            >
              {user ? 'Go to Dashboard' : 'Log In'}
            </button>
            <button 
              onClick={handleCTA}
              className="bg-[#042C53] hover:bg-[#042C53]/95 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200/80 px-4 py-6 space-y-4 animate-fade-in">
            <div className="flex flex-col gap-3 font-semibold text-sm text-slate-600">
              <button 
                onClick={() => scrollToSection('features')} 
                className="text-left py-1 hover:text-[#042C53] transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')} 
                className="text-left py-1 hover:text-[#042C53] transition-colors"
              >
                How It Works
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="text-left py-1 hover:text-[#042C53] transition-colors"
              >
                Pricing
              </button>
            </div>
            <div className="h-px bg-slate-100 my-4" />
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); navigate(user ? '/dashboard' : '/login'); }}
                className="w-full text-center py-2 text-sm font-bold text-slate-700 hover:text-[#042C53] border border-slate-200 rounded-xl"
              >
                {user ? 'Go to Dashboard' : 'Log In'}
              </button>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); handleCTA(); }}
                className="w-full text-center py-2.5 text-sm font-bold bg-[#042C53] text-white rounded-xl shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-24 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-[#042C53]/5 border border-[#042C53]/10 px-3 py-1 rounded-full text-xs font-bold text-[#042C53]">
                <Sparkles className="w-3.5 h-3.5 text-[#378ADD]" />
                <span>GST-Compliant Invoicing for Indian Freelancers</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-800 leading-tight">
                Get paid <span className="bg-gradient-to-r from-[#042C53] to-[#378ADD] bg-clip-text text-transparent">on time, every time</span>. No chase needed.
              </h1>

              {/* Subheadline */}
              <p className="text-slate-600 font-semibold text-base sm:text-lg max-w-2xl leading-relaxed">
                Create professional GST invoices, embed Razorpay links, and let Ledgr automatically nudge clients with friendly reminders. Save 4+ hours of manual follow-ups every week.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  onClick={handleCTA}
                  className="bg-[#042C53] hover:bg-[#042C53]/95 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Start Free Invoicing</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollToSection('features')}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>See How It Works</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Checklist */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Free during Beta
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> No credit card required
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Razorpay integrated
                </span>
              </div>
            </div>

            {/* Right Mockup Dashboard Preview */}
            <div className="lg:col-span-5 relative w-full max-w-lg mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#042C53] to-[#378ADD] rounded-3xl blur-3xl opacity-15" />
              
              {/* Premium Dashboard Frame */}
              <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-white font-sans overflow-hidden aspect-[4/3] flex flex-col">
                {/* Header bar */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 select-none">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-500 ml-2">ledgr.in/dashboard</span>
                  </div>
                  <div className="w-20 h-4 bg-slate-800 rounded-lg flex items-center px-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#378ADD]/80" />
                    <div className="w-10 h-1 bg-slate-700 rounded-full ml-1" />
                  </div>
                </div>

                {/* Main panel content */}
                <div className="flex-1 pt-4 space-y-4 select-none">
                  {/* Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700/80 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Received</span>
                      <span className="text-sm font-extrabold text-emerald-400 mt-1">₹1,82,450</span>
                    </div>
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700/80 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</span>
                      <span className="text-sm font-extrabold text-[#378ADD] mt-1">₹45,200</span>
                    </div>
                  </div>

                  {/* Active Invoices List Mockup */}
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-3 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 pb-1.5 border-b border-slate-800">
                      <span>CLIENT</span>
                      <span>AMOUNT</span>
                      <span>STATUS</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-300">
                      <span className="font-bold truncate max-w-[120px]">Acme Corp</span>
                      <span>₹25,000</span>
                      <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">Paid</span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-300">
                      <span className="font-bold truncate max-w-[120px]">TechSolutions</span>
                      <span>₹12,000</span>
                      <span className="bg-[#378ADD]/10 text-[#378ADD] px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">Sent</span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-300">
                      <span className="font-bold truncate max-w-[120px]">Karan Mehta</span>
                      <span>₹8,200</span>
                      <span className="bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">Overdue</span>
                    </div>
                  </div>

                  {/* Mini-Chart Representation */}
                  <div className="h-12 flex items-end justify-between px-4 pt-1">
                    <div className="w-6 bg-slate-800 rounded-t-sm h-6" />
                    <div className="w-6 bg-slate-800 rounded-t-sm h-8" />
                    <div className="w-6 bg-gradient-to-t from-[#042C53] to-[#378ADD] rounded-t-sm h-12 relative">
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-[#378ADD]">₹1.8L</span>
                    </div>
                    <div className="w-6 bg-slate-800 rounded-t-sm h-10" />
                    <div className="w-6 bg-slate-800 rounded-t-sm h-7" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">
              Everything you need to manage your invoicing
            </h2>
            <p className="text-slate-500 font-semibold text-sm sm:text-base">
              Say goodbye to complicated accounting software. Ledgr is built specifically for freelancers who value speed, simplicity, and local compliance.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Card 1 */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 hover:border-slate-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="p-3 bg-gradient-to-br from-[#042C53] to-[#378ADD] text-white rounded-xl w-fit shadow-sm mb-5">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">GST-Compliant Invoicing</h3>
                <p className="text-slate-500 text-xs font-semibold leading-relaxed mt-2.5">
                  Easily calculate CGST, SGST, and IGST based on client location. Set up professional invoices with native HSN/SAC code configurations.
                </p>
              </div>
              <div className="text-[10px] text-[#378ADD] font-bold uppercase tracking-wider mt-5 select-none flex items-center gap-1">
                Tax ready <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 hover:border-slate-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="p-3 bg-gradient-to-br from-[#042C53] to-[#378ADD] text-white rounded-xl w-fit shadow-sm mb-5">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Razorpay Integration</h3>
                <p className="text-slate-500 text-xs font-semibold leading-relaxed mt-2.5">
                  Embed secure payment links inside your invoices. Give clients the freedom to pay via UPI, cards, net banking, or wallets directly.
                </p>
              </div>
              <div className="text-[10px] text-[#378ADD] font-bold uppercase tracking-wider mt-5 select-none flex items-center gap-1">
                Instant checkout <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 hover:border-slate-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="p-3 bg-gradient-to-br from-[#042C53] to-[#378ADD] text-white rounded-xl w-fit shadow-sm mb-5">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Automated Reminders</h3>
                <p className="text-slate-500 text-xs font-semibold leading-relaxed mt-2.5">
                  Schedule friendly follow-ups that automatically alert your clients before, on, or after the due date. No more awkward follow-up emails.
                </p>
              </div>
              <div className="text-[10px] text-[#378ADD] font-bold uppercase tracking-wider mt-5 select-none flex items-center gap-1">
                No awkward follow-ups <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 hover:border-slate-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="p-3 bg-gradient-to-br from-[#042C53] to-[#378ADD] text-white rounded-xl w-fit shadow-sm mb-5">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Earnings Dashboard</h3>
                <p className="text-slate-500 text-xs font-semibold leading-relaxed mt-2.5">
                  Track total revenue, outstanding balances, and cashflow charts. Get visual insights so you know exactly where your business stands.
                </p>
              </div>
              <div className="text-[10px] text-[#378ADD] font-bold uppercase tracking-wider mt-5 select-none flex items-center gap-1">
                Real-time metrics <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-50 border-t border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">
              Get paid in 3 simple steps
            </h2>
            <p className="text-slate-500 font-semibold text-sm sm:text-base">
              Set up your invoicing pipeline in under 5 minutes and see the results instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Connecting line (Desktop only) */}
            <div className="hidden md:block absolute top-10 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-[#042C53]/15 via-[#378ADD]/20 to-[#042C53]/15 z-0" />

            {/* Step 1 */}
            <div className="relative z-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-white border-2 border-[#042C53] flex items-center justify-center font-extrabold text-lg text-[#042C53] mx-auto shadow-sm">
                1
              </div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Add Your Client & Bill</h3>
              <p className="text-slate-500 text-xs font-semibold max-w-xs mx-auto leading-relaxed">
                Add your client profiles, set up optional local GST details, and list your project milestones or hourly logs.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-white border-2 border-[#378ADD] flex items-center justify-center font-extrabold text-lg text-[#378ADD] mx-auto shadow-sm">
                2
              </div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Embed Razorpay Link</h3>
              <p className="text-slate-500 text-xs font-semibold max-w-xs mx-auto leading-relaxed">
                Generate secure checkouts automatically. Your client gets a clean email with a PDF and a direct link to settle up.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center font-extrabold text-lg text-emerald-500 mx-auto shadow-sm">
                3
              </div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Automatic Follow-ups</h3>
              <p className="text-slate-500 text-xs font-semibold max-w-xs mx-auto leading-relaxed">
                If the client misses the due date, Ledgr sends a gentle nudge. Your dashboard updates automatically once paid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing / CTA Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-[#042C53] to-[#378ADD] rounded-3xl p-8 sm:p-12 text-white text-center space-y-6 relative overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-radial-gradient from-white/10 to-transparent pointer-events-none" />
            
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Simple, transparent, built for freelancers
            </h2>
            <p className="text-slate-200 font-semibold text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              We are currently in public beta. Enjoy 100% free unlimited invoicing, clients, and automated reminders while we build!
            </p>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-xs mx-auto text-center select-none shadow-inner">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">Public Beta Pass</span>
              <div className="text-3xl font-extrabold mt-1">₹0 <span className="text-xs font-bold text-slate-200">/ forever</span></div>
              <div className="text-[10px] font-semibold text-slate-200 mt-2">No Credit Card • Unlimited access</div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleCTA}
                className="bg-white hover:bg-slate-50 text-[#042C53] px-8 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Get Started for Free</span>
                <ArrowRight className="w-4 h-4 text-[#042C53]" />
              </button>
            </div>

            {/* Trusted footer items */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-6 text-[10px] font-bold text-slate-250 uppercase tracking-widest">
              <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> DPDP Compliant</span>
              <span>•</span>
              <span>100% Secure SSL</span>
              <span>•</span>
              <span>Made in India</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-left">
            <div className="space-y-4">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#042C53] to-[#378ADD] flex items-center justify-center text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-sm text-white tracking-tight">Ledgr.</span>
              </div>
              <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                Streamlined GST invoicing, Razorpay payments, and automated overdue email follow-ups for Indian freelancers.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-white text-xs font-bold uppercase tracking-wider">Product</h4>
              <ul className="space-y-2 text-xs font-semibold">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">Features</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors cursor-pointer">Pricing</button></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-white text-xs font-bold uppercase tracking-wider">Resources</h4>
              <ul className="space-y-2 text-xs font-semibold">
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors cursor-pointer">How It Works</button></li>
                <li><a href="https://supabase.com/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Supabase Auth</a></li>
                <li><a href="https://razorpay.com/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Razorpay API</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-white text-xs font-bold uppercase tracking-wider">Legal</h4>
              <ul className="space-y-2 text-xs font-semibold">
                <li><a href="#terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="h-px bg-slate-800 my-6" />

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-semibold">
            <span>&copy; {new Date().getFullYear()} Ledgr Invoicing. All rights reserved.</span>
            <span>Made with &hearts; for freelancers in India.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
