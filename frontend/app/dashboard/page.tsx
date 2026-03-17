"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brain, Code2, Users, FileText, Award, TrendingUp, Clock, Plus, ChevronRight, LogOut, Settings, Video } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const NAV = [
  { href:"/dashboard", icon:<Brain size={16}/>, label:"Dashboard" },
  { href:"/live-interview", icon:<Video size={16}/>, label:"Live Interview" },
    { href:"/interview", icon:<Brain size={16}/>, label:"Start Interview" },
  { href:"/resume", icon:<FileText size={16}/>, label:"Resume Review" },
  { href:"/playground", icon:<Code2 size={16}/>, label:"Code Playground" },
  { href:"/social", icon:<Users size={16}/>, label:"Social" },
  { href:"/companies", icon:<Award size={16}/>, label:"Companies" },
  { href:"/history", icon:<Clock size={16}/>, label:"History" },
];

const AGENTS = [
  { type:"hr", icon:"🎯", label:"HR Interview", color:"from-violet-600 to-purple-600" },
  { type:"technical", icon:"⚙️", label:"Technical", color:"from-blue-600 to-cyan-500" },
  { type:"coding", icon:"💻", label:"Coding", color:"from-emerald-600 to-teal-500" },
  { type:"system_design", icon:"🏗️", label:"System Design", color:"from-orange-600 to-amber-500" },
];

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [perf, setPerf] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    Promise.all([api.get("/interviews/history?limit=5"), api.get("/users/me/performance")])
      .then(([h,p]) => { setHistory(h.data); setPerf(p.data); })
      .finally(() => setLoading(false));
  }, [user]);

  const chartData = perf ? Object.values(perf.performance_by_agent).flat().slice(-12) : [];
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-dark-950 text-white flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-56 glass border-r border-white/5 flex flex-col z-40">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center font-bold text-xs">AI</div>
            <span className="font-semibold">InterviewAI</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-1">
          <button onClick={() => { logout(); router.push("/"); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <LogOut size={15}/>Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 p-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{greeting}, {user?.full_name?.split(" ")[0] || "there"} 👋</h1>
          <p className="text-slate-400 text-sm mt-1">Ready to ace your next interview?</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label:"Total Sessions", value: user?.stats?.total_interviews ?? 0, icon:<Brain size={16} className="text-brand-400"/>, color:"brand" },
            { label:"Average Score", value: user?.stats?.avg_score ? `${user.stats.avg_score}/10` : "—", icon:<TrendingUp size={16} className="text-emerald-400"/>, color:"emerald" },
            { label:"Subscription", value: user?.subscription_tier === "premium" ? "⭐ Premium" : "Free", icon:<Award size={16} className="text-amber-400"/>, color:"amber" },
          ].map(s => (
            <div key={s.label} className="glass rounded-2xl p-5 border border-white/5">
              <div className="flex items-center gap-2 mb-3">{s.icon}<span className="text-xs text-slate-500">{s.label}</span></div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Quick start */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Start interview</h2>
            <Link href="/interview" className="text-xs text-brand-400 hover:text-brand-300">All options →</Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {AGENTS.map(a => (
              <Link key={a.type} href={`/interview?type=${a.type}`}
                className="glass rounded-xl p-4 border border-white/5 hover:border-brand-500/30 transition-all hover:-translate-y-0.5 group">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center text-lg mb-2.5`}>{a.icon}</div>
                <p className="text-xs font-medium">{a.label}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Chart */}
        {chartData.length > 1 && (
          <section className="mb-8">
            <h2 className="font-semibold mb-3">Score trend</h2>
            <div className="glass rounded-2xl p-5 border border-white/5 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" hide/>
                  <YAxis domain={[0,10]} hide/>
                  <Tooltip contentStyle={{background:"#0f172a",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:12}}/>
                  <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{fill:"#6366f1",r:3}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Recent interviews */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent interviews</h2>
            <Link href="/history" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="shimmer rounded-xl h-16"/>)}
            </div>
          ) : history.length === 0 ? (
            <div className="glass rounded-2xl p-10 border border-dashed border-white/8 text-center">
              <div className="text-3xl mb-2">🎯</div>
              <p className="font-medium text-sm mb-1">No interviews yet</p>
              <p className="text-slate-500 text-xs mb-4">Complete your first session to see it here</p>
              <Link href="/interview" className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5">
                <Plus size={13}/>Start now
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(s => (
                <Link key={s.id} href={`/history`}
                  className="flex items-center justify-between glass rounded-xl px-5 py-3.5 border border-white/5 hover:border-white/10 transition-all group">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{AGENTS.find(a=>a.type===s.agent_type)?.icon||"📋"}</span>
                    <div>
                      <p className="text-sm font-medium">{s.job_role}{s.company?` @ ${s.company}`:""}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.agent_type} · {new Date(s.started_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.overall_score != null && (
                      <span className={`font-bold text-sm ${s.overall_score>=7?"text-emerald-400":s.overall_score>=5?"text-amber-400":"text-red-400"}`}>
                        {s.overall_score.toFixed(1)}/10
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status==="completed"?"bg-emerald-500/10 text-emerald-400":s.status==="in_progress"?"bg-brand-500/10 text-brand-400":"bg-dark-800 text-slate-500"}`}>
                      {s.status}
                    </span>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400"/>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
