"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, Code2, Users, FileText, Award, TrendingUp,
  Clock, Plus, ChevronRight, LogOut, Settings, Play,
  RotateCcw, AlertCircle, Trophy, Calendar
} from "lucide-react";
import api from "@/lib/api";
import StreakTracker from "@/app/components/StreakTracker";
import { useAuthStore } from "@/lib/store";

interface Session {
  id: string;
  agent_type: string;
  job_role: string;
  company: string;
  status: string;
  overall_score: number | null;
  answered_questions: number;
  total_questions: number;
  started_at: string;
}

const AGENT_ICONS: Record<string, string> = {
  hr: "🎯", technical: "⚙️", coding: "💻", system_design: "🏗️",
};

const AGENT_COLORS: Record<string, string> = {
  hr: "from-violet-600 to-purple-600",
  technical: "from-blue-600 to-cyan-500",
  coding: "from-emerald-600 to-teal-500",
  system_design: "from-orange-600 to-amber-500",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState({ total: 0, avgScore: null as number | null });
  const [loading, setLoading] = useState(true);
  const [resumeLoading, setResumeLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await api.get("/interviews/history?limit=10");
      setSessions(data.sessions || []);
      const completed = (data.sessions || []).filter((s: Session) => s.overall_score != null);
      const avg = completed.length > 0
        ? completed.reduce((sum: number, s: Session) => sum + (s.overall_score || 0), 0) / completed.length
        : null;
      setStats({ total: data.sessions?.length || 0, avgScore: avg });
    } catch {}
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await logout(); router.push("/login"); };

  const resumeSession = async (session: Session) => {
    setResumeLoading(session.id);
    try {
      const { data } = await api.get(`/interviews/${session.id}`);
      // Get last question from messages
      const msgs = data.messages || [];
      const lastQ = [...msgs].reverse().find((m: any) => m.role === "assistant");
      const params = new URLSearchParams({
        session_id: session.id,
        agent_type: session.agent_type,
        job_role: session.job_role,
        company: session.company || "",
        level: data.experience_level || "mid",
        question_number: String(session.answered_questions + 1),
        total_questions: String(session.total_questions),
        last_question: lastQ?.content || "",
        resume: "true",
      });
      router.push(`/interview?${params.toString()}`);
    } catch {
      router.push(`/interview?type=${session.agent_type}&resume=${session.id}`);
    } finally {
      setResumeLoading(null);
    }
  };

  const nav = [
    { href: "/dashboard",  icon: <TrendingUp size={16}/>, label: "Dashboard" },
    { href: "/interview",  icon: <Brain size={16}/>,      label: "Start Interview" },
    { href: "/resume",          icon: <FileText size={16}/>, label: "Resume Review" },
    { href: "/resume-builder", icon: <Plus size={16}/>,     label: "Resume Builder" },
    { href: "/playground", icon: <Code2 size={16}/>,      label: "Code Playground" },
    { href: "/social",     icon: <Users size={16}/>,      label: "Social" },
    { href: "/companies",  icon: <Award size={16}/>,      label: "Companies" },
    { href: "/history",     icon: <Clock size={16}/>,      label: "History" },
    { href: "/leaderboard", icon: <Trophy size={16}/>,     label: "Leaderboard" },
    { href: "/prep-plan",   icon: <Calendar size={16}/>,   label: "30-Day Plan" },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Sidebar */}
      <div className="w-56 shrink-0 glass border-r border-white/5 flex flex-col py-5 px-3">
        <div className="flex items-center gap-2.5 px-3 mb-7">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xs font-bold">AI</div>
          <span className="font-bold text-sm">InterviewAI</span>
        </div>
        <nav className="flex-1 space-y-0.5">
          {nav.map(item => (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                item.href === "/dashboard"
                  ? "bg-brand-600/15 text-brand-400"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div className="space-y-0.5">
          <button onClick={() => router.push("/settings")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">
            <Settings size={16}/>Settings
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all">
            <LogOut size={16}/>Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">
              {greeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
            </h1>
            <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-400 text-sm">Ready to ace your next interview?</p>
          </div>
          <p className="text-xs text-slate-600 mt-1">Logged in as <span className="text-brand-400">{user?.email}</span></p>
            <StreakTracker/>
          </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Sessions", value: stats.total, icon: <Clock size={18}/> },
              { label: "Average Score",  value: stats.avgScore ? `${stats.avgScore.toFixed(1)}/10` : "—", icon: <TrendingUp size={18}/> },
              { label: "Subscription",  value: "Free", icon: <Award size={18}/> },
            ].map((s,i) => (
              <div key={i} className="glass rounded-2xl p-5 border border-white/5">
                <div className="flex items-center gap-2 text-slate-500 mb-2 text-sm">{s.icon}{s.label}</div>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Start interview */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Start interview</h2>
              <button onClick={() => router.push("/interview")}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                All options <ChevronRight size={13}/>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(AGENT_ICONS).map(([type, icon]) => (
                <button key={type} onClick={() => router.push(`/interview?type=${type}`)}
                  className="glass rounded-2xl p-5 border border-white/5 hover:border-brand-500/30 transition-all group text-left">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${AGENT_COLORS[type]} flex items-center justify-center text-lg mb-3`}>
                    {icon}
                  </div>
                  <p className="text-sm font-medium capitalize group-hover:text-brand-400 transition-colors">
                    {type.replace("_", " ")}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Recent interviews */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent interviews</h2>
              <button onClick={() => router.push("/history")}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                View all <ChevronRight size={13}/>
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="shimmer rounded-xl h-16"/>)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="glass rounded-2xl p-10 border border-dashed border-white/8 text-center">
                <Brain size={28} className="mx-auto mb-3 text-slate-700"/>
                <p className="text-sm font-medium mb-1">No interviews yet</p>
                <p className="text-xs text-slate-600 mb-4">Start your first mock interview to see results here</p>
                <button onClick={() => router.push("/interview")}
                  className="btn-primary text-sm px-5 py-2 flex items-center gap-2 mx-auto">
                  <Plus size={14}/>Start interview
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id}
                    className="glass rounded-xl border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${AGENT_COLORS[s.agent_type] || "from-slate-600 to-slate-700"} flex items-center justify-center text-sm shrink-0`}>
                          {AGENT_ICONS[s.agent_type] || "⚙️"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {s.job_role}{s.company ? ` @ ${s.company}` : ""}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {s.agent_type.replace("_"," ")} · {new Date(s.started_at).toLocaleDateString("en-IN")}
                            {s.status === "in_progress" && (
                              <span className="ml-2 text-amber-400">
                                · {s.answered_questions}/{s.total_questions} questions done
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Score badge */}
                        {s.overall_score != null ? (
                          <span className={`text-sm font-bold ${s.overall_score >= 7 ? "text-emerald-400" : s.overall_score >= 5 ? "text-amber-400" : "text-red-400"}`}>
                            {s.overall_score.toFixed(1)}/10
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === "in_progress" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-slate-500/10 text-slate-400"}`}>
                            {s.status === "in_progress" ? "In progress" : s.status}
                          </span>
                        )}

                        {/* Resume button for in_progress */}
                        {s.status === "in_progress" ? (
                          <button
                            onClick={() => resumeSession(s)}
                            disabled={resumeLoading === s.id}
                            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium">
                            {resumeLoading === s.id
                              ? <RotateCcw size={11} className="animate-spin"/>
                              : <Play size={11}/>
                            }
                            {resumeLoading === s.id ? "Loading…" : "Resume"}
                          </button>
                        ) : (
                          <button onClick={() => router.push(`/history`)}
                            className="text-slate-600 hover:text-slate-400 transition-colors">
                            <ChevronRight size={16}/>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar for in_progress */}
                    {s.status === "in_progress" && s.total_questions > 0 && (
                      <div className="px-5 pb-3">
                        <div className="w-full h-1 bg-dark-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${(s.answered_questions / s.total_questions) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {Math.round((s.answered_questions / s.total_questions) * 100)}% complete — click Resume to continue
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
