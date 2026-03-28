"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, MicOff, Video, VideoOff, Send, Play, Pause,
  StopCircle, RotateCcw, Download, Trash2, ChevronLeft,
  AlertCircle, RefreshCw, Timer, TrendingUp, TrendingDown,
  CheckCircle, Camera
} from "lucide-react";
import api from "@/lib/api";
import ShareCard from "@/app/components/ShareCard";
import InterviewPDF from "@/app/components/InterviewPDF";
import { recordPracticeDay } from "@/app/components/StreakTracker";

// ── Constants ────────────────────────────────────────────────────────────
const ROLES = [
  "Software Engineer","Senior Software Engineer","Staff Engineer",
  "Frontend Engineer","Backend Engineer","Full Stack Engineer",
  "Mobile Engineer (iOS)","Mobile Engineer (Android)","DevOps Engineer",
  "Site Reliability Engineer","Cloud Architect","Solutions Architect",
  "Data Scientist","ML Engineer","AI Engineer","Data Engineer",
  "NLP Engineer","Computer Vision Engineer","MLOps Engineer",
  "Product Manager","Technical Product Manager","UX Designer",
  "Engineering Manager","Director of Engineering","Business Analyst",
  "SAP Consultant","SAP Basis","SAP ABAP Developer","SAP FICO Consultant",
  "SAP MM Consultant","SAP SD Consultant","Oracle Consultant",
  "Salesforce Developer","QA Engineer","SDET","Security Engineer",
  "Blockchain Developer","Embedded Systems Engineer","Game Developer",
  "Network Engineer","Quantitative Analyst","Financial Analyst",
];

const COMPANIES = [
  "Google","Amazon","Microsoft","Meta","Apple","Netflix","OpenAI","Anthropic",
  "Uber","Airbnb","Stripe","Salesforce","Oracle","IBM","Adobe","Nvidia",
  "Twitter/X","LinkedIn","Spotify","Shopify","Atlassian","MongoDB","Snowflake",
  "TCS","Infosys","Wipro","HCL Technologies","Tech Mahindra","Cognizant",
  "Accenture","Capgemini","LTIMindtree","Flipkart","Swiggy","Zomato","Ola",
  "Paytm","PhonePe","Razorpay","CRED","Dream11","Freshworks","Zoho",
  "Groww","Zerodha","Browserstack","Postman","Goldman Sachs","JPMorgan",
  "Morgan Stanley","Barclays","HSBC","McKinsey","BCG","Deloitte","PwC",
  "EY","KPMG","Tesla","SpaceX","Samsung","SAP","Siemens",
  "Early Stage Startup","Series A Startup","Other Company",
];

const AGENT_TYPES = [
  { v: "hr",            l: "HR / Behavioral", icon: "🎯" },
  { v: "technical",     l: "Technical",        icon: "⚙️" },
  { v: "coding",        l: "Coding",           icon: "💻" },
  { v: "system_design", l: "System Design",    icon: "🏗️" },
];

const DURATIONS = [15, 20, 30, 45, 60];
const TIME_PER_Q = [0.5, 1, 2, 3, 5];
const LEVELS = [
  { v: "fresher", l: "Fresher" },
  { v: "junior",  l: "Junior (1-3y)" },
  { v: "mid",     l: "Mid (3-5y)" },
  { v: "senior",  l: "Senior (5y+)" },
];

const safeText = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.problem) {
    const p: string[] = [];
    if (v.title) p.push(v.title);
    if (v.problem) p.push(v.problem);
    if (v.examples?.length) {
      p.push("Examples:");
      v.examples.forEach((e: any) => p.push(`  Input: ${e.input} → Output: ${e.output}`));
    }
    if (v.constraints) p.push(`Constraints: ${JSON.stringify(v.constraints)}`);
    return p.join("\n\n");
  }
  return JSON.stringify(v, null, 2);
};

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

interface QA {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  timeUsed: number;
  difficulty: "easy" | "medium" | "hard";
}

// Single state machine — no separate pages
type InterviewState = "setup" | "in_progress" | "paused" | "completed";

function InterviewApp() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // ── Single state machine ────────────────────────────────────────────
  const [state, setState] = useState<InterviewState>("setup");

  // ── Config ─────────────────────────────────────────────────────────
  const [role, setRole] = useState("Software Engineer");
  const [company, setCompany] = useState("Google");
  const [level, setLevel] = useState("mid");
  const [agentType, setAgentType] = useState("technical");
  const [duration, setDuration] = useState(30);
  const [timePerQ, setTimePerQ] = useState(1);
  const totalQs = Math.floor(duration / timePerQ);
  const perQSec = Math.round(timePerQ * 60);

  // ── Camera ─────────────────────────────────────────────────────────
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recs, setRecs] = useState<{ url: string; name: string }[]>([]);

  // ── Interview ───────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState("");
  const [question, setQuestion] = useState("");
  const [qNum, setQNum] = useState(1);
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [qLeft, setQLeft] = useState(perQSec);
  const [totalLeft, setTotalLeft] = useState(duration * 60);
  const [qaHistory, setQaHistory] = useState<QA[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [showShare, setShowShare] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy"|"medium"|"hard">("medium");
  const [autoWarn, setAutoWarn] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────
  const recognitionRef = useRef<any>(null);
  const qTimerRef = useRef<any>(null);
  const totalTimerRef = useRef<any>(null);
  const qStartRef = useRef(Date.now());
  const submittingRef = useRef(false);
  const pausedRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Persistent camera re-attach every 400ms ─────────────────────────
  // This is the KEY fix — video element loses srcObject on React re-render
  useEffect(() => {
    if (!camReady || !streamRef.current) return;
    const reattach = () => {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    };
    reattach();
    // Camera reattach removed - was causing refresh loop
  }); // No deps — runs every render to prevent camera loss

  // Cleanup on unmount only
  useEffect(() => () => {
    clearInterval(qTimerRef.current);
    clearInterval(totalTimerRef.current);
    killSpeech();
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop(); } catch {}
  }, []);

  // ── Camera setup — called once on mount ────────────────────────────
  const initCamera = useCallback(async () => {
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      // Setup recorder
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecs(p => [...p, { url, name: `Interview_${Date.now()}.webm` }]);
        chunksRef.current = [];
      };
      setCamReady(true);
    } catch (err: any) {
      setCamError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera in browser settings."
          : `Camera error: ${err.message}`
      );
    }
  }, []);

  // Init camera immediately when component mounts
  useEffect(() => { if (mounted) initCamera(); }, [mounted]);

  const retryCamera = async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamReady(false);
    await initCamera();
  };

  const toggleCam = () => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  };

  const toggleMic = () => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled; setMicOn(t.enabled);
      if (!t.enabled) killSpeech(); else startSpeech();
    }
  };

  // ── Speech recognition ──────────────────────────────────────────────
  const startSpeech = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    submittingRef.current = false;
    const r = new SR();
    recognitionRef.current = r;
    r.continuous = true; r.interimResults = true; r.lang = "en-US";
    let final = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + " "; else interim = t;
      }
      setTranscript(final + interim);
    };
    r.onend = () => { if (!submittingRef.current && !pausedRef.current) { try { r.start(); } catch {} } };
    try { r.start(); setIsListening(true); } catch {}
  };

  const killSpeech = () => {
    submittingRef.current = true;
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setIsListening(false);
  };

  // ── Timers ──────────────────────────────────────────────────────────
  const startTimers = useCallback(() => {
    clearInterval(qTimerRef.current);
    clearInterval(totalTimerRef.current);
    qTimerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setQLeft(p => {
        if (p <= 6) setAutoWarn(true);
        if (p <= 1) { setAutoWarn(false); return 0; }
        return p - 1;
      });
    }, 1000);
    totalTimerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setTotalLeft(p => { if (p <= 1) { clearInterval(totalTimerRef.current); return 0; } return p - 1; });
    }, 1000);
  }, []);

  // Auto submit when question timer hits 0
  useEffect(() => {
    if (state === "in_progress" && qLeft === 0 && !submittingRef.current) doSubmit();
  }, [qLeft, state]);

  // ── START INTERVIEW — transforms setup → in_progress in same screen ──
  const startInterview = async () => {
    if (!camReady) { alert("Please allow camera access first."); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/interviews/start", {
        agent_type: agentType, job_role: role, company, experience_level: level,
      });
      setSessionId(data.session_id);
      setQuestion(safeText(data.question));
      setQNum(1);
      setQLeft(perQSec);
      setTotalLeft(duration * 60);
      setQaHistory([]);
      setLastScore(null);
      setLastFeedback("");
      setSummary(null);
      setDifficulty("medium");
      pausedRef.current = false;
      submittingRef.current = false;

      // Start recording
      if (mediaRecRef.current?.state === "inactive") mediaRecRef.current.start(1000);

      // State machine: setup → in_progress (SAME SCREEN)
      setState("in_progress");
      qStartRef.current = Date.now();
      startTimers();
      startSpeech();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to start. Please try again.");
    } finally { setLoading(false); }
  };

  // ── STOP — pauses, keeps camera ON ─────────────────────────────────
  const stopInterview = () => {
    pausedRef.current = true;
    killSpeech();
    setAutoWarn(false);
    setState("paused"); // Same screen, just paused state
  };

  // ── RESUME ──────────────────────────────────────────────────────────
  const resumeInterview = () => {
    pausedRef.current = false;
    setState("in_progress");
    submittingRef.current = false;
    startSpeech();
    startTimers();
  };

  // ── COMPLETE — ends interview, shows summary ────────────────────────
  const completeInterview = async () => {
    setConfirmEnd(false);
    clearInterval(qTimerRef.current);
    clearInterval(totalTimerRef.current);
    killSpeech();
    try { if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop(); } catch {}
    // Camera stays on — user may want to review
    const attempted = qaHistory.length;
    const avg = attempted > 0
      ? qaHistory.reduce((s, q) => s + q.score, 0) / attempted : 0;
    setSummary({
      overall_score: avg.toFixed(1),
      performance_summary: `You completed ${attempted} of ${totalQs} questions with an average score of ${avg.toFixed(1)}/10.`,
      top_strengths: qaHistory.filter(q => q.score >= 7).slice(0,3).map(q => q.question.slice(0,60) + "…"),
      areas_to_improve: qaHistory.filter(q => q.score < 5).slice(0,3).map(q => q.question.slice(0,60) + "…"),
      hiring_likelihood: avg >= 7 ? "Strong Yes" : avg >= 5 ? "Maybe" : "Needs Improvement",
      next_steps: "Review weak answers and practice with different companies.",
    });
    setState("completed");
  };

  // ── SUBMIT ANSWER ───────────────────────────────────────────────────
  const doSubmit = async () => {
    if (submittingRef.current || pausedRef.current) return;
    submittingRef.current = true;
    clearInterval(qTimerRef.current);
    killSpeech();
    setAutoWarn(false);
    const answer = transcript.trim() || "(No answer — time expired)";
    const timeUsed = Math.round((Date.now() - qStartRef.current) / 1000);
    setTranscript("");
    setLoading(true);
    try {
      const { data } = await api.post(`/interviews/${sessionId}/answer`, {
        answer, question,
      });
      const score = Number(data.score || 0);
      let newDiff: "easy"|"medium"|"hard" = difficulty;
      if (score >= 8) newDiff = difficulty === "easy" ? "medium" : "hard";
      else if (score <= 4) newDiff = difficulty === "hard" ? "medium" : "easy";
      setDifficulty(newDiff);
      setLastScore(score);
      setLastFeedback(safeText(data.feedback).slice(0, 120));
      setQaHistory(p => [...p, { question, answer, score, feedback: safeText(data.feedback), timeUsed, difficulty }]);
      if (data.session_complete) {
        clearInterval(totalTimerRef.current);
        try { if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop(); } catch {}
        setSummary(data.summary);
        setState("completed");
      } else {
        setQuestion(safeText(data.next_question));
        setQNum(data.question_number);
        setQLeft(perQSec);
        qStartRef.current = Date.now();
        submittingRef.current = false;
        startSpeech();
        startTimers();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Submit failed. Try again.";
      alert(msg);
      submittingRef.current = false;
    } finally { setLoading(false); }
  };

  const resetToSetup = () => {
    clearInterval(qTimerRef.current);
    clearInterval(totalTimerRef.current);
    killSpeech();
    setQaHistory([]); setSummary(null); setQuestion("");
    setLastScore(null); setLastFeedback(""); setDifficulty("medium");
    setTranscript(""); setConfirmEnd(false); pausedRef.current = false;
    setState("setup");
  };

  if (!mounted) return null;

  const avgScore = qaHistory.length > 0
    ? (qaHistory.reduce((s, q) => s + q.score, 0) / qaHistory.length).toFixed(1) : null;
  const qPct = (qLeft / perQSec) * 100;
  const totalPct = (totalLeft / (duration * 60)) * 100;
  const isSetup = state === "setup";
  const isActive = state === "in_progress";
  const isPaused = state === "paused";
  const isDone = state === "completed";

  // ── SINGLE UNIFIED RENDER ────────────────────────────────────────────
  return (
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">

      {/* ── FLOATING CAMERA — always visible, top-right ─────────────── */}
      <div className="fixed top-4 right-4 z-[100] group">
        <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-dark-900"
          style={{
            width: isSetup ? 220 : 176,
            aspectRatio: "4/3",
            border: camReady ? "2px solid rgba(255,255,255,0.15)" : "2px solid rgba(239,68,68,0.4)",
            transition: "width 0.3s ease",
          }}>
          {/* Video — ref callback forces stream attach */}
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el && streamRef.current && el.srcObject !== streamRef.current) {
                el.srcObject = streamRef.current;
                el.play().catch(() => {});
              }
            }}
            autoPlay muted playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />

          {/* Camera not ready */}
          {!camReady && !camError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-950">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-2"/>
              <p className="text-xs text-slate-400">Starting camera…</p>
            </div>
          )}

          {/* Camera error */}
          {camError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-950 p-3 text-center">
              <AlertCircle size={20} className="text-red-400 mb-2"/>
              <p className="text-xs text-red-400 mb-2 leading-tight">{camError}</p>
              <button onClick={retryCamera}
                className="flex items-center gap-1 bg-brand-600 hover:bg-brand-500 px-2.5 py-1.5 rounded-lg text-xs">
                <RefreshCw size={10}/>Retry
              </button>
            </div>
          )}

          {/* Camera off */}
          {camReady && !camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-dark-950/90">
              <VideoOff size={20} className="text-slate-500"/>
            </div>
          )}

          {/* Setup label */}
          {isSetup && camReady && (
            <div className="absolute top-2 left-2 bg-dark-950/80 text-xs text-slate-400 px-2 py-0.5 rounded-full border border-white/10">
              Preview
            </div>
          )}

          {/* Live label */}
          {(isActive || isPaused) && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-dark-950/80 px-2 py-0.5 rounded-full border border-red-500/30">
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-red-400 animate-pulse" : "bg-amber-400"}`}/>
              <span className="text-xs text-red-400">{isPaused ? "PAUSED" : "LIVE"}</span>
            </div>
          )}

          {/* Mic wave */}
          {isListening && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-0.5">
              {[2,4,6,4,6,4,2].map((h,i) => (
                <div key={i} className="w-0.5 bg-emerald-400 rounded-full animate-bounce"
                  style={{height:`${h*2}px`, animationDelay:`${i*0.07}s`}}/>
              ))}
            </div>
          )}

          {/* Hover controls */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={toggleCam}
              className={`w-6 h-6 rounded-full flex items-center justify-center ${camOn?"bg-dark-800/80":"bg-red-500/80"}`}>
              {camOn?<Video size={10}/>:<VideoOff size={10}/>}
            </button>
            <button onClick={toggleMic}
              className={`w-6 h-6 rounded-full flex items-center justify-center ${micOn?"bg-dark-800/80":"bg-red-500/80"}`}>
              {micOn?<Mic size={10}/>:<MicOff size={10}/>}
            </button>
          </div>
        </div>
        {isSetup && (
          <p className="text-xs text-center mt-1 text-slate-600">
            {camReady ? "Camera ready ✓" : "Starting…"}
          </p>
        )}
      </div>

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 glass border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")}
            className="text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={18}/>
          </button>
          <div>
            {isSetup ? (
              <>
                <p className="font-bold text-base">Interview Setup</p>
                <p className="text-xs text-slate-500">Configure and start your interview</p>
              </>
            ) : (
              <>
                <p className="font-medium text-sm">{role} @ {company}</p>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  {isDone ? "Interview complete" : (
                    <>
                      <span>Q{qNum}/{totalQs}</span>
                      <span>·</span>
                      <span>{level}</span>
                      <span>·</span>
                      <span className={`flex items-center gap-0.5 ${difficulty==="hard"?"text-red-400":difficulty==="easy"?"text-emerald-400":"text-amber-400"}`}>
                        {difficulty==="hard"?<TrendingUp size={9}/>:difficulty==="easy"?<TrendingDown size={9}/>:null}
                        {difficulty}
                      </span>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Timers — only during interview */}
        {(isActive || isPaused) && (
          <div className="flex items-center gap-6 mr-52">
            <div className={`text-center ${qLeft<=10?"text-red-400":qLeft<=30?"text-amber-400":"text-slate-200"}`}>
              <p className={`text-3xl font-mono font-bold tabular-nums ${qLeft<=10?"animate-pulse":""}`}>
                {fmt(qLeft)}
              </p>
              <div className="w-28 h-2 bg-dark-800 rounded-full overflow-hidden mt-1">
                <div className={`h-full rounded-full transition-all duration-1000 ${qLeft<=10?"bg-red-500":qLeft<=30?"bg-amber-500":"bg-emerald-500"}`}
                  style={{width:`${qPct}%`}}/>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">this question</p>
            </div>
            <div className={`text-center ${totalLeft<300?"text-red-400":"text-slate-500"}`}>
              <p className="text-lg font-mono font-bold tabular-nums">{fmt(totalLeft)}</p>
              <div className="w-20 h-1 bg-dark-800 rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                  style={{width:`${totalPct}%`}}/>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">total left</p>
            </div>
          </div>
        )}

        {/* Score badge during interview */}
        {(isActive || isPaused) && avgScore && (
          <div className="mr-52 text-center">
            <p className={`text-xl font-bold ${Number(avgScore)>=7?"text-emerald-400":Number(avgScore)>=5?"text-amber-400":"text-red-400"}`}>
              {avgScore}/10
            </p>
            <p className="text-xs text-slate-600">avg</p>
          </div>
        )}
      </div>

      {/* ── MAIN AREA ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ══ SETUP STATE ══════════════════════════════════════════════ */}
        {isSetup && (
          <div className="max-w-2xl mx-auto px-5 py-6 pr-60">

            {/* Interview type */}
            <div className="mb-5">
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wide">Interview type</label>
              <div className="grid grid-cols-2 gap-2">
                {AGENT_TYPES.map(a => (
                  <button key={a.v} onClick={() => setAgentType(a.v)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all ${agentType===a.v?"border-brand-500/50 bg-brand-600/10 text-white":"border-white/8 text-slate-400 hover:border-white/15"}`}>
                    <span>{a.icon}</span>{a.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Role + Company */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Job role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="input-field text-sm py-2.5">
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Target company</label>
                <select value={company} onChange={e => setCompany(e.target.value)} className="input-field text-sm py-2.5">
                  {COMPANIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Level */}
            <div className="mb-4">
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

            {/* Timer config */}
            <div className="glass rounded-2xl p-5 border border-white/5 mb-5">
              <label className="block text-xs text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
                <Timer size={12}/>Timer
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-600 mb-2">Interview duration</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DURATIONS.map(d => (
                      <button key={d} onClick={() => setDuration(d)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${duration===d?"border-brand-500/50 bg-brand-600/10 text-brand-400":"border-white/8 text-slate-500"}`}>
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-2">Time per question</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {TIME_PER_Q.map(t => (
                      <button key={t} onClick={() => setTimePerQ(t)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${timePerQ===t?"border-amber-500/50 bg-amber-600/10 text-amber-400":"border-white/8 text-slate-500"}`}>
                        {t < 1 ? "30s" : `${t}m`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                {[
                  { l:"Total questions", v: totalQs },
                  { l:"Per question",    v: timePerQ < 1 ? "30 sec" : `${timePerQ} min` },
                  { l:"Total duration",  v: `${duration} min` },
                ].map((s,i) => (
                  <div key={i} className="text-center glass-light rounded-xl p-3 border border-white/5">
                    <p className="text-xl font-bold gradient-text">{s.v}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="glass rounded-xl p-4 border border-brand-500/20 bg-brand-600/5 mb-5">
              <p className="text-xs font-medium text-brand-400 mb-2">How this works</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  "Camera starts automatically on this page",
                  "Click Start — same screen transforms to interview",
                  "Speak your answer — voice is transcribed live",
                  "Timer auto-submits if you run out of time",
                  "Pause anytime — timer stops, camera stays on",
                  "Complete anytime — shows full performance summary",
                ].map((t,i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                    <span className="text-brand-400 shrink-0">✓</span>{t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ IN_PROGRESS STATE ════════════════════════════════════════ */}
        {(isActive || isPaused) && (
          <div className="px-5 py-5 pr-56">

            {/* Pause overlay */}
            {isPaused && (
              <div className="glass rounded-2xl p-6 border border-amber-500/30 mb-4 text-center">
                <Pause size={28} className="text-amber-400 mx-auto mb-2"/>
                <p className="font-semibold text-amber-400 mb-1">Interview Paused</p>
                <p className="text-xs text-slate-500">
                  Q{qNum}/{totalQs} · {qaHistory.length} answered · Camera is still on (top-right)
                </p>
              </div>
            )}

            {/* Warnings */}
            {autoWarn && isActive && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm mb-3 animate-pulse">
                <AlertCircle size={14}/><strong>{qLeft}s left!</strong> Auto-submits at 0.
              </div>
            )}
            {lastScore !== null && (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 mb-3 border text-xs ${lastScore>=7?"border-emerald-500/20 bg-emerald-500/5":"border-amber-500/20 bg-amber-500/5"}`}>
                <span className={`font-bold text-sm shrink-0 ${lastScore>=7?"text-emerald-400":lastScore>=5?"text-amber-400":"text-red-400"}`}>
                  {lastScore.toFixed(1)}/10
                </span>
                <span className="text-slate-400 line-clamp-1">{lastFeedback}</span>
              </div>
            )}

            {/* Question */}
            <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-400">
                  {qNum}
                </div>
                <pre className="text-base text-white font-sans whitespace-pre-wrap leading-relaxed flex-1">
                  {question}
                </pre>
              </div>
            </div>

            {/* Transcript */}
            <div className="glass rounded-xl p-4 border border-white/5 mb-3 min-h-24">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  {isListening
                    ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Transcribing voice…</>
                    : isPaused
                    ? <><Pause size={10}/>Paused</>
                    : <><MicOff size={10}/>Mic off — type below</>
                  }
                </p>
                <button onClick={() => setTranscript("")} className="text-xs text-slate-600 hover:text-slate-400">
                  Clear
                </button>
              </div>
              {transcript
                ? <p className="text-sm text-white leading-relaxed">{transcript}</p>
                : <p className="text-sm text-slate-600 italic">
                    {isListening ? "Speak now…" : isPaused ? "Resume to continue" : "Enable mic or type below"}
                  </p>
              }
            </div>

            <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
              placeholder="Type your answer here (backup if mic is off)…"
              rows={2} disabled={isPaused}
              className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/40 resize-none placeholder:text-slate-700 disabled:opacity-40"/>
          </div>
        )}

        {/* ══ COMPLETED STATE ══════════════════════════════════════════ */}
        {isDone && (
          <div className="max-w-2xl mx-auto px-5 py-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="text-xl font-bold">Interview Complete</h2>
              <p className="text-slate-400 text-sm mt-1">
                {qaHistory.length} of {totalQs} questions · {role} @ {company}
              </p>
            </div>

            {/* Score */}
            <div className="glass rounded-2xl p-5 border border-white/5 mb-4 text-center">
              <div className="text-5xl font-bold gradient-text mb-1">{avgScore ?? "—"}</div>
              <p className="text-slate-500 text-sm">/10 average score</p>
              {summary?.hiring_likelihood && (
                <div className={`mt-3 inline-block px-3 py-1 rounded-full text-sm font-medium ${safeText(summary.hiring_likelihood).includes("Yes")?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>
                  {safeText(summary.hiring_likelihood)}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { l:"Questions done", v: qaHistory.length },
                { l:"Avg score",      v: avgScore ? `${avgScore}/10` : "—" },
                { l:"Duration",       v: `${duration - Math.floor(totalLeft/60)}/${duration}m` },
              ].map((s,i) => (
                <div key={i} className="glass rounded-xl p-3 border border-white/5 text-center">
                  <p className="text-lg font-bold gradient-text">{s.v}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            {/* Summary */}
            {summary && (
              <div className="glass rounded-2xl p-4 border border-white/5 mb-4">
                <p className="text-xs text-slate-500 uppercase font-medium mb-2">Performance Summary</p>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {safeText(summary.performance_summary)}
                </pre>
                {summary.next_steps && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-brand-400 font-medium mb-1">Next steps</p>
                    <p className="text-xs text-slate-400">{safeText(summary.next_steps)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Q&A history */}
            {qaHistory.length > 0 && (
              <div className="glass rounded-2xl p-4 border border-white/5 mb-4">
                <p className="text-xs text-slate-500 uppercase font-medium mb-3">Question Review</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {qaHistory.map((qa,i) => (
                    <div key={i} className={`rounded-xl p-3 border ${qa.score>=7?"border-emerald-500/20 bg-emerald-500/5":qa.score>=5?"border-amber-500/20 bg-amber-500/5":"border-red-500/20 bg-red-500/5"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Q{i+1}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${qa.difficulty==="hard"?"bg-red-500/10 text-red-400":qa.difficulty==="easy"?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>{qa.difficulty}</span>
                          <span className="text-xs text-slate-600">{qa.timeUsed}s</span>
                        </div>
                        <span className={`text-sm font-bold ${qa.score>=7?"text-emerald-400":qa.score>=5?"text-amber-400":"text-red-400"}`}>
                          {qa.score.toFixed(1)}/10
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2">{qa.question}</p>
                      <details>
                        <summary className="text-xs text-brand-400 cursor-pointer mt-1">View answer + feedback ▸</summary>
                        <p className="text-xs text-slate-400 mt-1 italic border-l-2 border-white/10 pl-2">"{qa.answer}"</p>
                        <p className="text-xs text-slate-500 mt-1">{qa.feedback}</p>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recordings */}
            {recs.length > 0 && (
              <div className="glass rounded-2xl p-4 border border-emerald-500/20 mb-4">
                <p className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                  <Video size={14}/>Session recording
                </p>
                {recs.map((r,i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 truncate mr-3">{r.name}</p>
                    <div className="flex gap-2 shrink-0">
                      <a href={r.url} download={r.name}
                        className="flex items-center gap-1.5 text-xs bg-brand-600/20 text-brand-400 border border-brand-500/25 px-3 py-1.5 rounded-lg">
                        <Download size={11}/>Download
                      </a>
                      <button onClick={()=>{URL.revokeObjectURL(r.url);setRecs([]);}}
                        className="text-red-400 p-1.5 rounded-lg hover:bg-red-500/10">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-600 mt-2">⚠️ Download before closing — local only</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM CONTROLS ──────────────────────────────────────────── */}
      <div className={`shrink-0 border-t px-5 py-4 glass ${autoWarn && isActive ? "border-red-500/30" : "border-white/5"}`}>

        {/* Confirm end modal */}
        {confirmEnd && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-dark-950/80 backdrop-blur-sm">
            <div className="glass rounded-2xl p-6 border border-red-500/25 max-w-sm w-full mx-4 text-center">
              <StopCircle size={32} className="text-red-400 mx-auto mb-3"/>
              <h3 className="font-bold text-lg mb-2">Complete interview now?</h3>
              <p className="text-slate-400 text-sm mb-4">
                Shows summary for {qaHistory.length} answered questions.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmEnd(false)} className="flex-1 btn-ghost py-2.5 text-sm">
                  Cancel
                </button>
                <button onClick={completeInterview}
                  className="flex-1 bg-red-600 hover:bg-red-500 transition-colors py-2.5 rounded-xl text-sm font-medium">
                  Yes, complete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SETUP controls ── */}
        {isSetup && (
          <div className="max-w-2xl mx-auto pr-56">
            <button onClick={startInterview} disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all active:scale-95 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2">
              {loading ? "Starting…" : <><Play size={18}/>Start Interview — {totalQs} Questions</>}
            </button>
            {!camReady && (
              <p className="text-xs text-amber-400 text-center mt-2 flex items-center justify-center gap-1">
                <AlertCircle size={11}/>Waiting for camera access (top-right)
              </p>
            )}
          </div>
        )}

        {/* ── IN_PROGRESS controls ── */}
        {isActive && (
          <div className="pr-52">
            <div className="flex gap-3 mb-3">
              {/* Submit */}
              <button onClick={doSubmit} disabled={loading}
                className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                  qLeft<=10?"bg-red-600 hover:bg-red-500 animate-pulse":qLeft<=30?"bg-amber-600 hover:bg-amber-500":"bg-brand-600 hover:bg-brand-500"
                }`}>
                {loading ? "Evaluating…" : <><Send size={15}/>Submit Answer</>}
              </button>
              {/* Stop */}
              <button onClick={stopInterview}
                className="flex items-center gap-1.5 glass border border-amber-500/30 hover:bg-amber-500/10 text-amber-400 transition-colors px-4 py-3.5 rounded-xl text-sm font-medium">
                <Pause size={14}/>Stop
              </button>
              {/* Complete */}
              <button onClick={() => setConfirmEnd(true)}
                className="flex items-center gap-1.5 glass border border-red-500/30 hover:bg-red-500/10 text-red-400 transition-colors px-4 py-3.5 rounded-xl text-sm font-medium">
                <StopCircle size={14}/>End
              </button>
            </div>
            <p className="text-center text-xs text-slate-700">
              Auto-submits at 0:00 · Stop pauses timer · End shows summary
            </p>
          </div>
        )}

        {/* ── PAUSED controls ── */}
        {isPaused && (
          <div className="flex gap-3 pr-52">
            <button onClick={resumeInterview}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 transition-all active:scale-95 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
              <Play size={15}/>Resume Interview
            </button>
            <button onClick={() => setConfirmEnd(true)}
              className="flex items-center gap-2 glass border border-red-500/30 hover:bg-red-500/10 text-red-400 transition-colors px-5 py-3.5 rounded-xl text-sm font-medium">
              <StopCircle size={14}/>Complete Interview
            </button>
          </div>
        )}

        {/* ── COMPLETED controls ── */}
        {isDone && (
          <div className="flex gap-3 max-w-2xl mx-auto">
            <button onClick={resetToSetup}
              className="flex-1 btn-ghost py-3 text-sm flex items-center justify-center gap-2">
              <RotateCcw size={14}/>Practice Again
            </button>
            <button onClick={() => router.push("/dashboard")}
              className="flex-1 btn-primary py-3 text-sm">
              Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-dark-950 flex items-center justify-center text-slate-400">
        Loading…
      </div>
    }>
      <InterviewApp />
    </Suspense>
  );
}
