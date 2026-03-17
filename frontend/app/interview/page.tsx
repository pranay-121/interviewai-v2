"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Send, ChevronLeft, Lightbulb, RotateCcw, Check, Camera, CameraOff, Mic, MicOff, Video, Square, Download, Trash2, Timer, Clock, Play, AlertCircle, History } from "lucide-react";
import api from "@/lib/api";

const AGENTS: Record<string, { icon: string; label: string; color: string }> = {
  hr:            { icon: "🎯", label: "HR Interview",   color: "from-violet-600 to-purple-600" },
  technical:     { icon: "⚙️", label: "Technical",      color: "from-blue-600 to-cyan-500" },
  coding:        { icon: "💻", label: "Coding",          color: "from-emerald-600 to-teal-500" },
  system_design: { icon: "🏗️", label: "System Design",  color: "from-orange-600 to-amber-500" },
};

const ROLES = [
  "Software Engineer","Senior Software Engineer","Staff Engineer","Principal Engineer",
  "Frontend Engineer","Backend Engineer","Full Stack Engineer","Mobile Engineer (iOS)",
  "Mobile Engineer (Android)","React Native Developer","Flutter Developer",
  "DevOps Engineer","Site Reliability Engineer","Platform Engineer","Infrastructure Engineer",
  "Cloud Engineer","Solutions Architect","Cloud Architect","Enterprise Architect",
  "Data Scientist","Senior Data Scientist","ML Engineer","Machine Learning Engineer",
  "AI Engineer","Data Engineer","Data Analyst","Business Intelligence Analyst",
  "NLP Engineer","Computer Vision Engineer","Research Scientist","MLOps Engineer",
  "Product Manager","Senior Product Manager","Group Product Manager","Principal PM",
  "Technical Product Manager","Product Analyst","UX Designer","UI Designer",
  "UX Researcher","Product Designer","Design Lead",
  "Engineering Manager","Director of Engineering","VP of Engineering","CTO",
  "Technical Lead","Team Lead","Scrum Master","Agile Coach",
  "Business Analyst","Management Consultant","Strategy Consultant","IT Consultant",
  "SAP Consultant","SAP Basis","SAP ABAP Developer","SAP FICO Consultant",
  "SAP MM Consultant","SAP SD Consultant","Oracle Consultant","Salesforce Developer",
  "QA Engineer","SDET","Test Automation Engineer","Security Engineer",
  "Penetration Tester","Cybersecurity Analyst","Information Security Analyst",
  "Quantitative Analyst","Risk Analyst","Financial Analyst","Investment Banking Analyst",
  "Software Engineer (FinTech)","Blockchain Developer","Smart Contract Developer",
  "Embedded Systems Engineer","Firmware Engineer","Game Developer",
  "AR/VR Developer","Robotics Engineer","Network Engineer",
];

const COMPANIES = [
  "","Google","Amazon","Microsoft","Meta","Apple","Netflix","OpenAI","Anthropic",
  "Uber","Airbnb","Stripe","Salesforce","Oracle","IBM","Intel","Nvidia","Adobe",
  "Twitter/X","LinkedIn","Snapchat","Pinterest","Spotify","Shopify","Slack","Zoom",
  "Atlassian","MongoDB","Databricks","Snowflake","Palantir","Cloudflare","Twilio",
  "TCS","Infosys","Wipro","HCL Technologies","Tech Mahindra","Cognizant",
  "Accenture","Capgemini","LTIMindtree","Mphasis","Hexaware",
  "Flipkart","Meesho","Swiggy","Zomato","Ola","Paytm","PhonePe","Razorpay",
  "CRED","Dream11","Zepto","Blinkit","Nykaa","Freshworks","Zoho","InMobi",
  "ShareChat","Groww","Zerodha","Upstox","PolicyBazaar","Browserstack","Postman",
  "Goldman Sachs","JPMorgan Chase","Morgan Stanley","Citibank","Deutsche Bank",
  "Barclays","HSBC","BlackRock","Visa","Mastercard","PayPal",
  "McKinsey","BCG","Bain","Deloitte","PwC","EY","KPMG",
  "Tesla","SpaceX","Samsung","Qualcomm","SAP","Siemens",
  "Other Startup","Other Company",
];

const LEVELS = [
  { v: "fresher", l: "Fresher (0y)" },
  { v: "junior",  l: "Junior (1-3y)" },
  { v: "mid",     l: "Mid (3-5y)" },
  { v: "senior",  l: "Senior (5y+)" },
];

const DURATIONS = [
  { v: 15, l: "15 min" },
  { v: 30, l: "30 min" },
  { v: 45, l: "45 min" },
  { v: 60, l: "60 min" },
];

const PER_Q = [
  { v: 60,  l: "1 min" },
  { v: 120, l: "2 min" },
  { v: 180, l: "3 min" },
  { v: 300, l: "5 min" },
  { v: 0,   l: "No limit" },
];

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  score?: number;
  feedback?: string;
  suggested?: string;
  strongPoints?: string[];
  improvements?: string[];
  qNum?: number;
}

const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

const safeText = (val: any): string => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
};

function InterviewInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Setup state
  const [phase, setPhase] = useState<"setup" | "chat" | "done">("setup");
  const [agentType, setAgentType] = useState("technical");
  const [jobRole, setJobRole] = useState("Software Engineer");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState("mid");
  const [totalDur, setTotalDur] = useState(30);
  const [perQSec, setPerQSec] = useState(120);
  const [useCamera, setUseCamera] = useState(false);
  const [useMic, setUseMic] = useState(false);
  const [useRec, setUseRec] = useState(false);

  // Active session detection
  const [activeSession, setActiveSession] = useState<any>(null);
  const [checkingActive, setCheckingActive] = useState(false);

  // Interview state
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [curQ, setCurQ] = useState("");
  const [qNum, setQNum] = useState(1);
  const [total, setTotal] = useState(10);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  // Timers
  const [totalSec, setTotalSec] = useState(0);
  const [qLeft, setQLeft] = useState(0);
  const [warn, setWarn] = useState(false);
  const totalRef = useRef<any>(null);
  const qRef = useRef<any>(null);

  // Media
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recs, setRecs] = useState<{ url: string; name: string; size: string }[]>([]);
  const [recording, setRecording] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [mediaErr, setMediaErr] = useState("");

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const type = sp.get("type");
    const comp = sp.get("company");
    if (type && AGENTS[type]) setAgentType(type);
    if (comp) setCompany(comp);
    // Check for active session
    checkActiveSession();
  }, []);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      clearInterval(totalRef.current);
      clearInterval(qRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const checkActiveSession = async () => {
    setCheckingActive(true);
    try {
      const { data } = await api.get("/interviews/active");
      if (data.session) setActiveSession(data.session);
    } catch {}
    finally { setCheckingActive(false); }
  };

  const resumeSession = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      // Load full session with all messages
      const { data } = await api.get(`/interviews/${activeSession.id}`);
      setSessionId(data.id);
      setTotal(data.total_questions);
      setQNum(data.answered_questions + 1);

      // Rebuild messages from history
      const msgs: Msg[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: safeText(m.content),
        score: m.score,
        feedback: safeText(m.feedback),
        suggested: safeText(m.suggested_answer),
        qNum: m.question_number,
      }));
      setMessages(msgs);

      // Set current question (last assistant message)
      const lastAssistant = [...data.messages].reverse().find((m: any) => m.role === "assistant");
      if (lastAssistant) setCurQ(safeText(lastAssistant.content));

      setAgentType(data.agent_type);
      setJobRole(data.job_role);
      setCompany(data.company || "");
      setLevel(data.experience_level);
      setActiveSession(null);
      setPhase("chat");
      startTotalTimer();
      startQTimer();
    } catch (e: any) {
      alert("Failed to resume session");
    } finally {
      setLoading(false);
    }
  };

  const startTotalTimer = useCallback(() => {
    const max = totalDur * 60;
    setTotalSec(max);
    totalRef.current = setInterval(() => {
      setTotalSec(p => {
        if (p <= 1) { clearInterval(totalRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  }, [totalDur]);

  const startQTimer = useCallback(() => {
    if (perQSec === 0) return;
    clearInterval(qRef.current);
    setQLeft(perQSec);
    setWarn(false);
    qRef.current = setInterval(() => {
      setQLeft(p => {
        if (p <= 11) setWarn(true);
        if (p <= 1) { clearInterval(qRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  }, [perQSec]);

  const startMedia = async () => {
    if (!useCamera && !useMic) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: useCamera,
        audio: useMic,
      });
      streamRef.current = stream;
      if (videoRef.current && useCamera) videoRef.current.srcObject = stream;
      setCamOn(useCamera);
      setMicOn(useMic);
      if (useRec) {
        const mr = new MediaRecorder(stream);
        recRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const name = `Interview_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
          setRecs(p => [...p, { url, name, size: `${(blob.size / 1024 / 1024).toFixed(1)} MB` }]);
          chunksRef.current = [];
        };
        mr.start(1000);
        setRecording(true);
      }
    } catch {
      setMediaErr("Camera/mic access denied. Interview will continue without media.");
    }
  };

  const stopMedia = () => {
    if (recRef.current && recording) { recRef.current.stop(); setRecording(false); }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamOn(false);
    setMicOn(false);
  };

  const startInterview = async () => {
    setLoading(true);
    try {
      await startMedia();
      const { data } = await api.post("/interviews/start", {
        agent_type: agentType,
        job_role: jobRole,
        company,
        experience_level: level,
      });
      setSessionId(data.session_id);
      setTotal(data.total_questions);
      setCurQ(safeText(data.question));
      setQNum(1);
      const msgs: Msg[] = [];
      if (data.greeting) msgs.push({ id: "g", role: "assistant", content: safeText(data.greeting) });
      msgs.push({ id: "q1", role: "assistant", content: safeText(data.question), qNum: 1 });
      setMessages(msgs);
      setActiveSession(null);
      setPhase("chat");
      startTotalTimer();
      startQTimer();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to start. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!input.trim() || loading) return;
    clearInterval(qRef.current);
    const ans = input.trim();
    setInput("");
    setMessages(p => [...p, { id: Date.now() + "u", role: "user", content: ans }]);
    setLoading(true);
    try {
      const { data } = await api.post(`/interviews/${sessionId}/answer`, {
        answer: ans,
        question: curQ,
      });
      setMessages(p => [...p, {
        id: Date.now() + "e",
        role: "assistant",
        content: safeText(data.feedback),
        score: data.score,
        feedback: safeText(data.feedback),
        suggested: safeText(data.suggested_answer),
        strongPoints: Array.isArray(data.strong_points) ? data.strong_points : [],
        improvements: Array.isArray(data.improvement_areas) ? data.improvement_areas : [],
      }]);
      if (data.session_complete) {
        clearInterval(totalRef.current);
        stopMedia();
        setSummary(data.summary);
        setPhase("done");
      } else {
        const nextQ = safeText(data.next_question);
        setCurQ(nextQ);
        setQNum(data.question_number);
        if (nextQ) {
          setMessages(p => [...p, {
            id: Date.now() + "q",
            role: "assistant",
            content: nextQ,
            qNum: data.question_number,
          }]);
        }
        startQTimer();
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to submit answer.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const cfg = AGENTS[agentType];
  const totalPct = totalDur > 0 ? (totalSec / (totalDur * 60)) * 100 : 100;
  const qPct = perQSec > 0 ? (qLeft / perQSec) * 100 : 100;

  // ── SETUP ────────────────────────────────────────────────────────────────
  if (phase === "setup") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15} />Back
        </button>
        <h1 className="text-2xl font-bold mb-1">Configure Interview</h1>
        <p className="text-slate-400 text-sm mb-6">Set your role, company, timer, and live mode</p>

        {/* Resume banner */}
        {activeSession && (
          <div className="glass rounded-2xl p-5 border border-amber-500/30 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <History size={18} className="text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-amber-400">Unfinished interview found!</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeSession.job_role}
                    {activeSession.company ? ` @ ${activeSession.company}` : ""} —{" "}
                    {activeSession.agent_type} interview
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Progress: {activeSession.answered_questions}/{activeSession.total_questions} questions answered
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Started: {new Date(activeSession.started_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={resumeSession} disabled={loading}
                  className="bg-amber-600 hover:bg-amber-500 transition-colors px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5">
                  <Play size={12} />Resume
                </button>
                <button onClick={() => setActiveSession(null)}
                  className="glass border border-white/10 hover:bg-white/5 transition-colors px-4 py-2 rounded-lg text-xs text-slate-400">
                  Start new
                </button>
              </div>
            </div>
            {activeSession.last_question && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-xs text-slate-500 mb-1">Last question:</p>
                <p className="text-xs text-slate-300 line-clamp-2">{activeSession.last_question}</p>
              </div>
            )}
          </div>
        )}

        <div className="glass rounded-2xl p-6 border border-white/5 space-y-5">
          {/* Agent Type */}
          <div>
            <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wide">Interview type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(AGENTS).map(([type, c]) => (
                <button key={type} onClick={() => setAgentType(type)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm transition-all ${agentType === type ? "border-brand-500/50 bg-brand-600/10 text-white" : "border-white/8 text-slate-400 hover:border-white/15"}`}>
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}>{c.icon}</div>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Job Role */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Job role</label>
            <select value={jobRole} onChange={e => setJobRole(e.target.value)} className="input-field text-sm py-2.5">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Company */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">
              Target company <span className="text-slate-700 normal-case">(optional)</span>
            </label>
            <select value={company} onChange={e => setCompany(e.target.value)} className="input-field text-sm py-2.5">
              <option value="">No specific company</option>
              {COMPANIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Level */}
          <div>
            <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wide">Experience level</label>
            <div className="grid grid-cols-4 gap-2">
              {LEVELS.map(l => (
                <button key={l.v} onClick={() => setLevel(l.v)}
                  className={`py-2 rounded-lg border text-xs transition-all ${level === l.v ? "border-brand-500/50 bg-brand-600/10 text-white" : "border-white/8 text-slate-400 hover:border-white/15"}`}>
                  {l.l}
                </button>
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="border-t border-white/5 pt-5">
            <label className="block text-xs text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
              <Timer size={12} />Timer settings
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-600 mb-2">Total interview time</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATIONS.map(d => (
                    <button key={d.v} onClick={() => setTotalDur(d.v)}
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${totalDur === d.v ? "border-brand-500/50 bg-brand-600/10 text-brand-400" : "border-white/8 text-slate-500 hover:border-white/15"}`}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-2">Time per question</p>
                <div className="flex gap-1.5 flex-wrap">
                  {PER_Q.map(t => (
                    <button key={t.v} onClick={() => setPerQSec(t.v)}
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${perQSec === t.v ? "border-amber-500/50 bg-amber-600/10 text-amber-400" : "border-white/8 text-slate-500 hover:border-white/15"}`}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Camera/Mic/Record */}
          <div className="border-t border-white/5 pt-5">
            <label className="block text-xs text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
              <Video size={12} />Live interview mode
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Camera",     icon: useCamera ? <Camera size={16} /> : <CameraOff size={16} />, val: useCamera, set: setUseCamera },
                { label: "Microphone", icon: useMic ? <Mic size={16} /> : <MicOff size={16} />,         val: useMic,    set: setUseMic },
                { label: "Record",     icon: <Video size={16} />,                                        val: useRec,    set: setUseRec },
              ].map((item, i) => (
                <button key={i} onClick={() => item.set(!item.val)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs transition-all ${item.val ? "border-emerald-500/50 bg-emerald-600/10 text-emerald-400" : "border-white/8 text-slate-500 hover:border-white/15"}`}>
                  {item.icon}
                  <span>{item.label}</span>
                  <span className={`font-bold ${item.val ? "text-emerald-400" : "text-slate-600"}`}>
                    {item.val ? "ON" : "OFF"}
                  </span>
                </button>
              ))}
            </div>
            {(useCamera || useMic) && (
              <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                <AlertCircle size={11} />Browser will ask for permission when you start
              </p>
            )}
            {useRec && (
              <p className="text-xs text-slate-500 mt-1">
                Recording saved locally — free, private, no uploads
              </p>
            )}
          </div>

          <button onClick={startInterview} disabled={loading}
            className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2">
            {loading ? "Starting…" : <><Play size={15} />Start {cfg.label} — {totalDur} min</>}
          </button>
        </div>
      </div>
    </div>
  );

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  if (phase === "done" && summary) return (
    <div className="min-h-screen mesh-bg p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold mb-1">Interview Complete!</h1>
          <p className="text-slate-400 text-sm">Here is your detailed performance analysis</p>
        </div>
        <div className="glass rounded-2xl p-6 border border-white/5 mb-4 text-center">
          <div className="text-5xl font-bold gradient-text mb-1">
            {Number(summary.overall_score || 0).toFixed(1)}
          </div>
          <p className="text-slate-500 text-sm">/10 overall score</p>
          <div className={`mt-3 inline-block px-3 py-1 rounded-full text-sm font-medium ${safeText(summary.hiring_likelihood).includes("Yes") ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
            {safeText(summary.hiring_likelihood) || "Good effort"}
          </div>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
          <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">Performance Summary</p>
          <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
            {safeText(summary.performance_summary)}
          </pre>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="glass rounded-xl p-4 border border-white/5">
            <p className="text-xs text-emerald-400 font-medium mb-2">✓ Strengths</p>
            {(Array.isArray(summary.top_strengths) ? summary.top_strengths : []).map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5 mb-1.5">
                <Check size={11} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-300">{s}</p>
              </div>
            ))}
          </div>
          <div className="glass rounded-xl p-4 border border-white/5">
            <p className="text-xs text-amber-400 font-medium mb-2">→ Improve on</p>
            {(Array.isArray(summary.areas_to_improve) ? summary.areas_to_improve : []).map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5 mb-1.5">
                <span className="text-amber-400 text-xs mt-0.5 shrink-0">→</span>
                <p className="text-xs text-slate-300">{s}</p>
              </div>
            ))}
          </div>
        </div>
        {summary.next_steps && (
          <div className="glass rounded-xl p-4 border border-brand-500/15 mb-4">
            <p className="text-xs text-brand-400 font-medium mb-1">Next steps</p>
            <p className="text-xs text-slate-300">{safeText(summary.next_steps)}</p>
          </div>
        )}
        {recs.length > 0 && (
          <div className="glass rounded-2xl p-5 border border-emerald-500/15 mb-4">
            <p className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
              <Video size={14} />Your recordings ({recs.length})
            </p>
            <div className="space-y-2">
              {recs.map((r, i) => (
                <div key={i} className="flex items-center justify-between glass-light rounded-lg px-4 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-slate-300">{r.name}</p>
                    <p className="text-xs text-slate-600">{r.size}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={r.url} download={r.name}
                      className="flex items-center gap-1.5 text-xs bg-brand-600/20 text-brand-400 px-2.5 py-1.5 rounded-lg hover:bg-brand-600/30">
                      <Download size={11} />Download
                    </a>
                    <button onClick={() => { URL.revokeObjectURL(r.url); setRecs(p => p.filter((_, j) => j !== i)); }}
                      className="text-red-400 p-1.5 rounded-lg hover:bg-red-500/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">⚠️ Download before closing tab</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setPhase("setup"); setMessages([]); setSummary(null); setRecs([]); checkActiveSession(); }}
            className="flex-1 btn-ghost py-3 text-sm flex items-center justify-center gap-2">
            <RotateCcw size={14} />Practice again
          </button>
          <button onClick={() => router.push("/dashboard")}
            className="flex-1 btn-primary py-3 text-sm">Dashboard</button>
        </div>
      </div>
    </div>
  );

  // ── CHAT ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-dark-950 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 glass border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            if (confirm("Abandon? You can resume this later.")) {
              stopMedia();
              clearInterval(totalRef.current);
              clearInterval(qRef.current);
              router.push("/dashboard");
            }
          }} className="text-slate-400 hover:text-white">
            <ChevronLeft size={18} />
          </button>
          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center text-sm`}>{cfg.icon}</div>
          <div>
            <p className="font-medium text-sm">{cfg.label} — {jobRole}</p>
            <p className="text-xs text-slate-500">{company || "Any company"} · {level}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {perQSec > 0 && (
            <div className={`flex items-center gap-2 ${warn ? "text-red-400" : "text-slate-300"}`}>
              <Timer size={13} />
              <div>
                <p className={`text-sm font-mono font-bold ${warn ? "animate-pulse" : ""}`}>{fmt(qLeft)}</p>
                <div className="w-14 h-1 bg-dark-800 rounded-full overflow-hidden mt-0.5">
                  <div className={`h-full rounded-full transition-all duration-1000 ${warn ? "bg-red-500" : "bg-amber-500"}`}
                    style={{ width: `${qPct}%` }} />
                </div>
              </div>
            </div>
          )}
          <div className={`flex items-center gap-2 ${totalSec < 300 ? "text-red-400" : "text-slate-300"}`}>
            <Clock size={13} />
            <div>
              <p className={`text-sm font-mono font-bold ${totalSec < 300 ? "animate-pulse" : ""}`}>{fmt(totalSec)}</p>
              <div className="w-20 h-1 bg-dark-800 rounded-full overflow-hidden mt-0.5">
                <div className={`h-full rounded-full transition-all duration-1000 ${totalSec < 300 ? "bg-red-500" : "bg-brand-500"}`}
                  style={{ width: `${totalPct}%` }} />
              </div>
            </div>
          </div>
          <span className="text-xs text-slate-500">Q{qNum}/{total}</span>
          {recording && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />REC
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {camOn && (
          <div className="w-52 shrink-0 bg-dark-900 border-r border-white/5 flex flex-col">
            <video ref={videoRef} autoPlay muted playsInline className="w-full flex-1 object-cover" />
            <div className="p-2 flex gap-1.5 border-t border-white/5">
              <button onClick={() => { const t = streamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); } }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs ${camOn ? "bg-dark-800 text-slate-300" : "bg-red-500/20 text-red-400"}`}>
                {camOn ? <Camera size={12} /> : <CameraOff size={12} />}
              </button>
              <button onClick={() => { const t = streamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); } }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs ${micOn ? "bg-dark-800 text-slate-300" : "bg-red-500/20 text-red-400"}`}>
                {micOn ? <Mic size={12} /> : <MicOff size={12} />}
              </button>
              {useRec && (
                <button onClick={() => {
                  if (recording && recRef.current) { recRef.current.stop(); setRecording(false); }
                  else if (recRef.current) { recRef.current.start(1000); setRecording(true); }
                }} className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs ${recording ? "bg-red-500/20 text-red-400" : "bg-dark-800 text-slate-300"}`}>
                  {recording ? <Square size={12} /> : <Video size={12} />}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {warn && perQSec > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm animate-pulse">
              <AlertCircle size={15} />Time is almost up! Submit your answer now.
            </div>
          )}
          {totalSec < 300 && totalSec > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-amber-400 text-sm">
              <Clock size={15} />Less than 5 minutes remaining!
            </div>
          )}
          {mediaErr && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5 text-yellow-400 text-xs">
              <AlertCircle size={13} />{mediaErr}
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0`}>
                  {cfg.icon}
                </div>
              )}
              <div className={`max-w-xl rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-brand-600/20 border border-brand-500/20 ml-10" : "glass border border-white/5"}`}>
                {m.qNum && <p className="text-xs text-brand-400 mb-1 font-medium">Question {m.qNum} of {total}</p>}
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{m.content}</pre>
                {m.score != null && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < Math.round(m.score!) ? "bg-brand-400" : "bg-dark-800"}`} />
                        ))}
                      </div>
                      <span className={`text-sm font-bold ${m.score >= 7 ? "text-emerald-400" : m.score >= 5 ? "text-amber-400" : "text-red-400"}`}>
                        {m.score.toFixed(1)}/10
                      </span>
                    </div>
                    {m.strongPoints && m.strongPoints.length > 0 && (
                      <div>
                        <p className="text-xs text-emerald-400 font-medium mb-0.5">✓ Strengths</p>
                        {m.strongPoints.map((p, i) => <p key={i} className="text-xs text-slate-400 ml-3">• {p}</p>)}
                      </div>
                    )}
                    {m.improvements && m.improvements.length > 0 && (
                      <div>
                        <p className="text-xs text-amber-400 font-medium mb-0.5">→ Improve</p>
                        {m.improvements.map((p, i) => <p key={i} className="text-xs text-slate-400 ml-3">• {p}</p>)}
                      </div>
                    )}
                    {m.suggested && (
                      <details className="mt-1">
                        <summary className="text-xs text-brand-400 cursor-pointer flex items-center gap-1">
                          <Lightbulb size={11} />Model answer
                        </summary>
                        <pre className="mt-2 text-xs text-slate-300 bg-dark-900 rounded-lg p-3 border border-white/5 whitespace-pre-wrap font-sans">
                          {m.suggested}
                        </pre>
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
                {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 typing-dot" />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className={`px-5 py-4 glass border-t shrink-0 ${warn ? "border-red-500/30" : "border-white/5"}`}>
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Type your answer… (Enter to submit · Shift+Enter for new line)"
            rows={2} disabled={loading}
            className={`flex-1 bg-dark-900 border rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors resize-none placeholder:text-slate-700 disabled:opacity-50 min-h-[52px] max-h-36 ${warn ? "border-red-500/40" : "border-white/8 focus:border-brand-500/40"}`} />
          <button onClick={submit} disabled={loading || !input.trim()}
            className={`w-11 h-11 disabled:opacity-40 disabled:cursor-not-allowed transition-all rounded-xl flex items-center justify-center shrink-0 active:scale-95 ${warn ? "bg-red-600 hover:bg-red-500" : "bg-brand-600 hover:bg-brand-500"}`}>
            <Send size={15} />
          </button>
        </div>
        <p className="text-center text-xs text-slate-700 mt-1.5">
          Enter to submit · Shift+Enter for new line
          {perQSec > 0 && <> · <span className={warn ? "text-red-400 font-medium" : ""}>{fmt(qLeft)} for this question</span></>}
        </p>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-950 flex items-center justify-center text-slate-400">Loading…</div>}>
      <InterviewInner />
    </Suspense>
  );
}
