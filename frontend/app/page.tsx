"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Brain, Code2, Users, Star, Zap, ChevronRight, Check } from "lucide-react";

const AGENTS = [
  { icon: "🎯", name: "HR Interview", desc: "Behavioral & STAR method questions", color: "from-violet-600 to-purple-600" },
  { icon: "⚙️", name: "Technical", desc: "Deep domain-specific Q&A", color: "from-blue-600 to-cyan-500" },
  { icon: "💻", name: "Coding", desc: "Algorithms & data structures", color: "from-emerald-600 to-teal-500" },
  { icon: "🏗️", name: "System Design", desc: "Architecture & scalability", color: "from-orange-600 to-amber-500" },
  { icon: "📄", name: "Resume Review", desc: "ATS scoring & rewrites", color: "from-rose-600 to-pink-500" },
];

const COMPANIES = ["Google","Amazon","Microsoft","Meta","Apple","Netflix","Uber","Airbnb","Stripe","Salesforce"];

const STEPS = [
  { n: "01", title: "Pick your role & company", desc: "Choose from 50+ roles and target any company." },
  { n: "02", title: "Start the AI interview", desc: "Your AI interviewer asks tailored questions step by step." },
  { n: "03", title: "Get instant feedback", desc: "Scored answers, model responses, and improvement tips." },
  { n: "04", title: "Track & improve", desc: "Watch your scores rise across sessions over time." },
];

const PLANS = [
  { name: "Free", price: "$0", period: "forever", features: ["HR + Technical interviews","Coding practice (5/mo)","3 System Design sessions","1 Resume review","5 Company guides","Social features"], cta: "Get started free", highlight: false },
  { name: "Premium", price: "$12", period: "/month", features: ["Everything in Free","Unlimited all agents","All company guides","Voice interview mode","Detailed PDF reports","Priority AI responses"], cta: "Start free trial", highlight: true },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen mesh-bg text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center font-bold text-sm">AI</div>
            <span className="font-semibold text-lg">InterviewAI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            {["Agents","Companies","Pricing"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white px-3 py-1.5 transition-colors">Log in</Link>
            <Link href="/register" className="btn-primary text-sm px-5 py-2 flex items-center gap-1.5">
              Start free <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-600/8 rounded-full blur-3xl" />
          <div className="absolute top-40 left-1/4 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-64 h-64 bg-cyan-600/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 glass-light border border-brand-500/20 rounded-full px-4 py-1.5 text-sm text-brand-400 mb-8 animate-fade-in">
            <Zap size={13} className="text-amber-400" />
            Powered by open-source AI — 100% free core features
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 animate-slide-up">
            Practice interviews with<br />
            <span className="gradient-text">AI that actually helps</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            5 specialized AI agents. Real-time scoring. Instant feedback.
            Tailored to your role, company, and experience level.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/register" className="btn-primary px-8 py-4 text-base flex items-center gap-2 animate-glow">
              Start practicing free <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn-ghost px-8 py-4 text-base text-slate-300">
              Sign in →
            </Link>
          </div>

          {/* Mock interview card */}
          <div className="max-w-2xl mx-auto glass rounded-2xl p-6 border border-white/5 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-sm">⚙️</div>
              <div>
                <p className="font-medium text-sm">Technical Interview</p>
                <p className="text-xs text-slate-500">Software Engineer @ Google · Senior level</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
              </div>
            </div>
            <div className="space-y-3">
              <div className="glass-light rounded-xl p-3.5">
                <p className="text-xs text-brand-400 mb-1 font-medium">Question 3 of 10</p>
                <p className="text-sm text-slate-200">Explain the difference between a process and a thread. When would you use one over the other?</p>
              </div>
              <div className="flex justify-end">
                <div className="glass-light rounded-xl rounded-br-sm p-3.5 max-w-sm">
                  <p className="text-sm text-slate-300">A process is an independent program in execution with its own memory space, while a thread is a lightweight unit within a process sharing the same memory...</p>
                </div>
              </div>
              <div className="glass-light rounded-xl p-3.5 border border-emerald-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-0.5">
                    {Array.from({length:10}).map((_,i)=>(
                      <div key={i} className={`w-2 h-2 rounded-full ${i<8?"bg-brand-400":"bg-dark-800"}`} />
                    ))}
                  </div>
                  <span className="text-emerald-400 text-sm font-bold">8.0/10</span>
                </div>
                <p className="text-xs text-slate-400">Strong answer! Consider also mentioning context switching overhead and when shared memory is beneficial...</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6 border-y border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "5", l: "AI Agents" }, { v: "50+", l: "Job Roles" },
            { v: "20+", l: "Companies" }, { v: "100%", l: "Free Core" },
          ].map(s => (
            <div key={s.l}>
              <p className="text-3xl font-bold gradient-text">{s.v}</p>
              <p className="text-sm text-slate-500 mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agents */}
      <section id="agents" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-400 text-sm font-medium mb-2 uppercase tracking-widest">Agents</p>
            <h2 className="text-4xl font-bold mb-4">5 Specialized AI Interviewers</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Each agent is fine-tuned for its interview type with the best available open-source model.</p>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {AGENTS.map((a, i) => (
              <div key={a.name} onClick={() => setActiveTab(i)}
                className={`glass rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 border ${activeTab===i?"border-brand-500/40":"border-white/5 hover:border-white/10"}`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-2xl mb-3`}>{a.icon}</div>
                <p className="font-semibold text-sm mb-1">{a.name}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-dark-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-400 text-sm font-medium mb-2 uppercase tracking-widest">How it works</p>
            <h2 className="text-4xl font-bold">Four steps to interview mastery</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-brand-500/40 to-transparent z-0" />
                )}
                <div className="glass rounded-2xl p-5 border border-white/5 relative z-10 h-full">
                  <div className="text-brand-400 text-xs font-bold mb-3 font-mono">{s.n}</div>
                  <p className="font-semibold text-sm mb-2">{s.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Companies */}
      <section id="companies" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-brand-400 text-sm font-medium mb-2 uppercase tracking-widest">Companies</p>
          <h2 className="text-4xl font-bold mb-4">Company-specific prep</h2>
          <p className="text-slate-400 mb-10">Tailored questions based on each company's real interview style.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {COMPANIES.map(c => (
              <Link key={c} href="/register"
                className="glass-light border border-white/8 hover:border-brand-500/40 hover:text-brand-400 transition-all px-5 py-2 rounded-full text-sm font-medium">
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-dark-900/40">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-brand-400 text-sm font-medium mb-2 uppercase tracking-widest">Pricing</p>
          <h2 className="text-4xl font-bold mb-4">Simple pricing</h2>
          <p className="text-slate-400 mb-14">Core features free forever. Upgrade for unlimited access.</p>
          <div className="grid md:grid-cols-2 gap-6">
            {PLANS.map(plan => (
              <div key={plan.name} className={`rounded-2xl p-8 text-left relative ${
                plan.highlight
                  ? "gradient-border bg-gradient-to-b from-brand-600/10 to-dark-900"
                  : "glass border border-white/5"
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-xs px-3 py-1 rounded-full font-semibold">MOST POPULAR</div>
                )}
                <p className="font-bold text-lg mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
                <div className="space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-sm">
                      <Check size={14} className={plan.highlight ? "text-brand-400" : "text-emerald-400"} />
                      <span className="text-slate-300">{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight ? "bg-brand-600 hover:bg-brand-500" : "glass-light hover:bg-white/5 border border-white/10"
                  }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6 text-center text-slate-600 text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xs font-bold">AI</div>
          <span className="font-medium text-slate-400">InterviewAI</span>
        </div>
        <p>Powered by open-source LLMs · Built with Next.js, FastAPI, LangChain</p>
        <p className="mt-1">© 2024 InterviewAI. Free to use, deploy, and modify.</p>
      </footer>
    </div>
  );
}
