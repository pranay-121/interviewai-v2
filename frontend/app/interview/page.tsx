"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Send, ChevronLeft, Lightbulb, TrendingUp, RotateCcw, Check } from "lucide-react";
import api from "@/lib/api";

const AGENTS: Record<string, { icon: string; label: string; color: string }> = {
  hr:            { icon:"🎯", label:"HR Interview",   color:"from-violet-600 to-purple-600" },
  technical:     { icon:"⚙️", label:"Technical",      color:"from-blue-600 to-cyan-500" },
  coding:        { icon:"💻", label:"Coding",          color:"from-emerald-600 to-teal-500" },
  system_design: { icon:"🏗️", label:"System Design",  color:"from-orange-600 to-amber-500" },
};
const ROLES = ["Software Engineer","Data Scientist","Product Manager","Frontend Engineer","Backend Engineer","DevOps Engineer","ML Engineer","Full Stack Developer","Cloud Architect","SAP Consultant"];
const COMPANIES = ["","Google","Amazon","Microsoft","Meta","Apple","Netflix","Uber","Airbnb","Stripe","Other"];
const LEVELS = [{ v:"fresher", l:"Fresher" },{ v:"junior", l:"Junior (1-3y)" },{ v:"mid", l:"Mid (3-5y)" },{ v:"senior", l:"Senior (5y+)" }];

interface Msg { id:string; role:"user"|"assistant"; content:string; score?:number; feedback?:string; suggested?:string; strongPoints?:string[]; improvements?:string[]; qNum?:number; }

function InterviewInner() {
  const sp = useSearchParams(); const router = useRouter();
  const [phase, setPhase] = useState<"setup"|"chat"|"done">("setup");
  const [agentType, setAgentType] = useState(sp.get("type")||"technical");
  const [jobRole, setJobRole] = useState("Software Engineer");
  const [company, setCompany] = useState(sp.get("company")||"");
  const [level, setLevel] = useState("mid");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [curQ, setCurQ] = useState("");
  const [qNum, setQNum] = useState(1);
  const [total, setTotal] = useState(10);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const startInterview = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/interviews/start", { agent_type:agentType, job_role:jobRole, company, experience_level:level });
      setSessionId(data.session_id); setTotal(data.total_questions); setCurQ(data.question); setQNum(1);
      const msgs: Msg[] = [];
      if (data.greeting) msgs.push({ id:"g", role:"assistant", content:data.greeting });
      msgs.push({ id:"q1", role:"assistant", content:data.question, qNum:1 });
      setMessages(msgs); setPhase("chat");
    } catch (e:any) { alert(e.response?.data?.detail||"Failed to start"); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (!input.trim()||loading) return;
    const ans = input.trim(); setInput("");
    setMessages(p => [...p, { id:Date.now()+"u", role:"user", content:ans }]);
    setLoading(true);
    try {
      const { data } = await api.post(`/interviews/${sessionId}/answer`, { answer:ans, question:curQ });
      setMessages(p => [...p, { id:Date.now()+"e", role:"assistant", content:data.feedback||"",
        score:data.score, feedback:data.feedback, suggested:data.suggested_answer,
        strongPoints:data.strong_points, improvements:data.improvement_areas }]);
      if (data.session_complete) { setSummary(data.summary); setPhase("done"); }
      else {
        setCurQ(data.next_question); setQNum(data.question_number);
        if (data.next_question) setMessages(p => [...p, { id:Date.now()+"q", role:"assistant", content:data.next_question, qNum:data.question_number }]);
      }
    } catch (e:any) { alert(e.response?.data?.detail||"Error"); }
    finally { setLoading(false); }
  };

  const cfg = AGENTS[agentType];

  if (phase === "setup") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6"><ChevronLeft size={15}/>Back</button>
        <h1 className="text-2xl font-bold mb-1">Configure interview</h1>
        <p className="text-slate-400 text-sm mb-6">Tailor the session to your target role and company</p>
        <div className="glass rounded-2xl p-6 border border-white/5 space-y-5">
          <div>
            <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wide">Interview type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(AGENTS).map(([type, cfg]) => (
                <button key={type} onClick={() => setAgentType(type)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm transition-all ${agentType===type?"border-brand-500/50 bg-brand-600/10 text-white":"border-white/8 text-slate-400 hover:border-white/15"}`}>
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center text-base`}>{cfg.icon}</div>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Job role</label>
            <select value={jobRole} onChange={e=>setJobRole(e.target.value)} className="input-field">
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Target company <span className="text-slate-700">(optional)</span></label>
            <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="e.g. Google, Amazon…" className="input-field"/>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wide">Experience level</label>
            <div className="grid grid-cols-4 gap-2">
              {LEVELS.map(l => (
                <button key={l.v} onClick={() => setLevel(l.v)}
                  className={`py-2 rounded-lg border text-xs transition-all ${level===l.v?"border-brand-500/50 bg-brand-600/10 text-white":"border-white/8 text-slate-400 hover:border-white/15"}`}>
                  {l.l}
                </button>
              ))}
            </div>
          </div>
          <button onClick={startInterview} disabled={loading} className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
            {loading ? "Starting…" : <>{cfg.icon} Start {cfg.label}</>}
          </button>
        </div>
      </div>
    </div>
  );

  if (phase === "done" && summary) return (
    <div className="min-h-screen mesh-bg p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold mb-1">Interview Complete!</h1>
          <p className="text-slate-400 text-sm">Here's your detailed performance analysis</p>
        </div>
        <div className="glass rounded-2xl p-6 border border-white/5 mb-4 text-center">
          <div className="text-5xl font-bold gradient-text mb-1">{Number(summary.overall_score||0).toFixed(1)}</div>
          <p className="text-slate-500 text-sm">/10 overall score</p>
          <div className={`mt-3 inline-block px-3 py-1 rounded-full text-sm font-medium ${summary.hiring_likelihood?.includes("Yes")?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>
            {summary.hiring_likelihood||"Good effort"}
          </div>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5 mb-4 ai-prose text-sm">
          <ReactMarkdown>{summary.performance_summary||""}</ReactMarkdown>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="glass rounded-xl p-4 border border-white/5">
            <p className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1"><TrendingUp size={12}/>Strengths</p>
            {(summary.top_strengths||[]).map((s:string,i:number)=>(
              <div key={i} className="flex items-start gap-1.5 mb-1.5"><Check size={12} className="text-emerald-400 mt-0.5 shrink-0"/><p className="text-xs text-slate-300">{s}</p></div>
            ))}
          </div>
          <div className="glass rounded-xl p-4 border border-white/5">
            <p className="text-xs text-amber-400 font-medium mb-2 flex items-center gap-1"><Lightbulb size={12}/>Improve on</p>
            {(summary.areas_to_improve||[]).map((s:string,i:number)=>(
              <div key={i} className="flex items-start gap-1.5 mb-1.5"><span className="text-amber-400 text-xs mt-0.5">→</span><p className="text-xs text-slate-300">{s}</p></div>
            ))}
          </div>
        </div>
        {summary.next_steps && (
          <div className="glass rounded-xl p-4 border border-brand-500/15 mb-4">
            <p className="text-xs text-brand-400 font-medium mb-1">Next steps</p>
            <p className="text-xs text-slate-300">{summary.next_steps}</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setPhase("setup"); setMessages([]); setSummary(null); }}
            className="flex-1 btn-ghost py-3 text-sm flex items-center justify-center gap-2"><RotateCcw size={14}/>Practice again</button>
          <button onClick={() => router.push("/dashboard")} className="flex-1 btn-primary py-3 text-sm">Dashboard</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-dark-950 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 glass border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-white"><ChevronLeft size={18}/></button>
          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center text-sm`}>{cfg.icon}</div>
          <div>
            <p className="font-medium text-sm">{cfg.label} — {jobRole}</p>
            <p className="text-xs text-slate-500">{company||"Any company"} · {level}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Q{qNum}/{total}</span>
          <div className="w-20 h-1 bg-dark-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full score-bar" style={{width:`${(qNum/total)*100}%`}}/>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
            {m.role==="assistant" && (
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0`}>{cfg.icon}</div>
            )}
            <div className={`max-w-xl rounded-2xl px-4 py-3 ${m.role==="user"?"bg-brand-600/20 border border-brand-500/20 ml-10":"glass border border-white/5"}`}>
              {m.qNum && <p className="text-xs text-brand-400 mb-1 font-medium">Question {m.qNum} of {total}</p>}
              <div className={`text-sm leading-relaxed ${m.role==="assistant"?"ai-prose":""}`}>
                {m.role==="assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
              </div>
              {m.score != null && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({length:10}).map((_,i)=>(
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i<Math.round(m.score!)?"bg-brand-400":"bg-dark-800"}`}/>
                      ))}
                    </div>
                    <span className={`text-sm font-bold ${m.score>=7?"text-emerald-400":m.score>=5?"text-amber-400":"text-red-400"}`}>{m.score.toFixed(1)}/10</span>
                  </div>
                  {m.strongPoints?.length ? (
                    <div>
                      <p className="text-xs text-emerald-400 font-medium mb-0.5">✓ Strengths</p>
                      {m.strongPoints.map((p,i)=><p key={i} className="text-xs text-slate-400 ml-3">• {p}</p>)}
                    </div>
                  ) : null}
                  {m.improvements?.length ? (
                    <div>
                      <p className="text-xs text-amber-400 font-medium mb-0.5">→ Improve</p>
                      {m.improvements.map((p,i)=><p key={i} className="text-xs text-slate-400 ml-3">• {p}</p>)}
                    </div>
                  ) : null}
                  {m.suggested && (
                    <details className="mt-1">
                      <summary className="text-xs text-brand-400 cursor-pointer flex items-center gap-1"><Lightbulb size={11}/>Model answer</summary>
                      <div className="mt-2 text-xs text-slate-300 bg-dark-900 rounded-lg p-3 ai-prose"><ReactMarkdown>{m.suggested}</ReactMarkdown></div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center text-xs mr-2 shrink-0`}>{cfg.icon}</div>
            <div className="glass border border-white/5 rounded-2xl px-5 py-4 flex items-center gap-1.5">
              {[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 typing-dot"/>)}
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      <div className="px-5 py-4 glass border-t border-white/5 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); submit(); }}}
            placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
            rows={2} disabled={loading}
            className="flex-1 bg-dark-900 border border-white/8 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 transition-colors resize-none placeholder:text-slate-700 disabled:opacity-50 min-h-[52px] max-h-32"/>
          <button onClick={submit} disabled={loading||!input.trim()}
            className="w-11 h-11 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all rounded-xl flex items-center justify-center shrink-0 active:scale-95">
            <Send size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-950 flex items-center justify-center text-slate-400">Loading…</div>}>
      <InterviewInner/>
    </Suspense>
  );
}
