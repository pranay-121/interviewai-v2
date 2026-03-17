"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, MicOff, Video, VideoOff, ChevronLeft, AlertCircle,
  RotateCcw, Download, Trash2, Send, Settings, Play,
  Clock, Timer, TrendingUp, TrendingDown
} from "lucide-react";
import api from "@/lib/api";

// ── Constants ──────────────────────────────────────────────────────────────
const ROLES = [
  "Software Engineer","Senior Software Engineer","Staff Engineer","Principal Engineer",
  "Frontend Engineer","Backend Engineer","Full Stack Engineer","Mobile Engineer (iOS)",
  "Mobile Engineer (Android)","DevOps Engineer","Site Reliability Engineer",
  "Cloud Architect","Solutions Architect","Data Scientist","ML Engineer",
  "AI Engineer","Data Engineer","NLP Engineer","Computer Vision Engineer",
  "MLOps Engineer","Product Manager","Technical Product Manager","UX Designer",
  "Engineering Manager","Director of Engineering","Business Analyst",
  "SAP Consultant","SAP Basis","SAP ABAP Developer","SAP FICO Consultant",
  "SAP MM Consultant","SAP SD Consultant","Oracle Consultant","Salesforce Developer",
  "QA Engineer","SDET","Security Engineer","Penetration Tester",
  "Blockchain Developer","Embedded Systems Engineer","Game Developer",
  "Network Engineer","Cloud Engineer","Quantitative Analyst","Financial Analyst",
];

const COMPANIES = [
  "Google","Amazon","Microsoft","Meta","Apple","Netflix","OpenAI","Anthropic",
  "Uber","Airbnb","Stripe","Salesforce","Oracle","IBM","Adobe","Nvidia",
  "Twitter/X","LinkedIn","Spotify","Shopify","Atlassian","MongoDB","Snowflake",
  "TCS","Infosys","Wipro","HCL Technologies","Tech Mahindra","Cognizant",
  "Accenture","Capgemini","LTIMindtree",
  "Flipkart","Swiggy","Zomato","Ola","Paytm","PhonePe","Razorpay","CRED",
  "Dream11","Freshworks","Zoho","Groww","Zerodha","Browserstack","Postman",
  "Goldman Sachs","JPMorgan Chase","Morgan Stanley","Barclays","HSBC",
  "McKinsey","BCG","Deloitte","PwC","EY","KPMG",
  "Early Stage Startup","Series A Startup","Series B Startup","Other",
];

const DURATIONS = [15, 20, 30, 45, 60];
const TIME_PER_Q = [0.5, 1, 2, 3, 5];
const LEVELS = [
  { v: "fresher", l: "Fresher (0y)" },
  { v: "junior",  l: "Junior (1-3y)" },
  { v: "mid",     l: "Mid (3-5y)" },
  { v: "senior",  l: "Senior (5y+)" },
];
const AGENT_TYPES = [
  { v: "hr",            l: "HR / Behavioral", icon: "🎯" },
  { v: "technical",     l: "Technical",        icon: "⚙️" },
  { v: "coding",        l: "Coding",           icon: "💻" },
  { v: "system_design", l: "System Design",    icon: "🏗️" },
];

const safeText = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.problem) {
    const parts = [];
    if (v.title) parts.push(v.title);
    if (v.problem) parts.push(v.problem);
    if (v.examples?.length) {
      parts.push("Examples:");
      v.examples.forEach((e: any) => parts.push(`  Input: ${e.input} → Output: ${e.output}`));
    }
    if (v.constraints) parts.push(`Constraints: ${JSON.stringify(v.constraints)}`);
    return parts.join("\n\n");
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

// ── Main Component ─────────────────────────────────────────────────────────
export default function LiveInterviewPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"setup" | "preview" | "interview" | "done">("setup");

  // Config
  const [role, setRole] = useState("Software Engineer");
  const [company, setCompany] = useState("Google");
  const [level, setLevel] = useState("mid");
  const [agentType, setAgentType] = useState("technical");
  const [duration, setDuration] = useState(30);
  const [timePerQ, setTimePerQ] = useState(1);

  // Computed
  const totalQuestions = Math.floor(duration / timePerQ);
  const perQSeconds = Math.round(timePerQ * 60);

  // Interview state
  const [sessionId, setSessionId] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionNumber, setQuestionNumber] = useState(1);
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [qTimeLeft, setQTimeLeft] = useState(perQSeconds);
  const [totalTimeLeft, setTotalTimeLeft] = useState(duration * 60);
  const [qaHistory, setQaHistory] = useState<QA[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [autoWarn, setAutoWarn] = useState(false);

  // Media
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const [recs, setRecs] = useState<{ url: string; name: string }[]>([]);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [mediaError, setMediaError] = useState("");

  const qTimerRef = useRef<any>(null);
  const totalTimerRef = useRef<any>(null);
  const qStartRef = useRef<number>(Date.now());
  const submittingRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => () => {
    clearInterval(qTimerRef.current);
    clearInterval(totalTimerRef.current);
    stopSpeech();
    streamRef.current?.getTracks().forEach(t => t.stop());
    try {
      if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop();
    } catch {}
  }, []);

  // Media setup
  const setupMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMediaError("");

      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecs(p => [...p, { url, name: `Interview_${role.replace(/\s/g,"_")}_${Date.now()}.webm` }]);
      };
      return true;
    } catch {
      setMediaError("Camera/mic access denied. Please allow in browser and try again.");
      return false;
    }
  };

  // Speech recognition
  const startSpeech = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    submittingRef.current = false;
    const r = new SR();
    recognitionRef.current = r;
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    let final = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + " ";
        else interim = t;
      }
      setTranscript(final + interim);
    };
    r.onend = () => { if (!submittingRef.current) { try { r.start(); } catch {} } };
    try { r.start(); setIsListening(true); } catch {}
  };

  const stopSpeech = () => {
    submittingRef.current = true;
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setIsListening(false);
  };

  // Go to preview (camera on, interview NOT started)
  const goToPreview = async () => {
    const ok = await setupMedia();
    if (ok) setPhase("preview");
  };

  // START INTERVIEW — only on manual click
  const startInterview = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/interviews/start", {
        agent_type: agentType,
        job_role: role,
        company,
        experience_level: level,
      });
      setSessionId(data.session_id);
      setCurrentQuestion(safeText(data.question));
      setQuestionNumber(1);
      setPhase("interview");

      if (mediaRecRef.current) mediaRecRef.current.start(1000);
      startSpeech();

      setQTimeLeft(perQSeconds);
      setTotalTimeLeft(duration * 60);
      qStartRef.current = Date.now();

      // Per-question countdown
      qTimerRef.current = setInterval(() => {
        setQTimeLeft(p => {
          if (p <= 6) setAutoWarn(true);
          if (p <= 1) { setAutoWarn(false); return 0; }
          return p - 1;
        });
      }, 1000);

      // Total countdown
      totalTimerRef.current = setInterval(() => {
        setTotalTimeLeft(p => {
          if (p <= 1) { clearInterval(totalTimerRef.current); return 0; }
          return p - 1;
        });
      }, 1000);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to start. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when q timer hits 0
  useEffect(() => {
    if (phase === "interview" && qTimeLeft === 0 && !submittingRef.current) {
      doSubmit();
    }
  }, [qTimeLeft, phase]);

  // Submit answer + adaptive difficulty
  const doSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    clearInterval(qTimerRef.current);
    stopSpeech();
    setAutoWarn(false);

    const answer = transcript.trim() || "(No answer — time expired)";
    const timeUsed = Math.round((Date.now() - qStartRef.current) / 1000);
    setTranscript("");
    setLoading(true);

    try {
      const { data } = await api.post(`/interviews/${sessionId}/answer`, {
        answer,
        question: currentQuestion,
      });

      const score = Number(data.score || 0);

      // Adaptive difficulty
      let newDiff: "easy" | "medium" | "hard" = difficulty;
      if (score >= 8) newDiff = difficulty === "easy" ? "medium" : "hard";
      else if (score <= 4) newDiff = difficulty === "hard" ? "medium" : "easy";
      setDifficulty(newDiff);

      setQaHistory(p => [...p, {
        question: currentQuestion, answer, score,
        feedback: safeText(data.feedback),
        timeUsed, difficulty,
      }]);
      setLastFeedback(data);

      if (data.session_complete) {
        clearInterval(totalTimerRef.current);
        try { if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop(); } catch {}
        setSummary(data.summary);
        setPhase("done");
      } else {
        setCurrentQuestion(safeText(data.next_question));
        setQuestionNumber(data.question_number);
        setLastFeedback(null);

        // Reset timer
        setQTimeLeft(perQSeconds);
        qStartRef.current = Date.now();
        submittingRef.current = false;
        startSpeech();
        qTimerRef.current = setInterval(() => {
          setQTimeLeft(p => {
            if (p <= 6) setAutoWarn(true);
            if (p <= 1) { setAutoWarn(false); return 0; }
            return p - 1;
          });
        }, 1000);
      }
    } catch {
      alert("Submit failed. Try again.");
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const toggleCam = () => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  };

  const toggleMic = () => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setMicOn(t.enabled);
      if (!t.enabled) stopSpeech();
      else { submittingRef.current = false; startSpeech(); }
    }
  };

  if (!mounted) return null;

  const avgScore = qaHistory.length > 0
    ? (qaHistory.reduce((s, q) => s + q.score, 0) / qaHistory.length).toFixed(1)
    : null;

  const qPct = (qTimeLeft / perQSeconds) * 100;
  const totalPct = (totalTimeLeft / (duration * 60)) * 100;

  // ── SETUP SCREEN ────────────────────────────────────────────────────────
  if (phase === "setup") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back to dashboard
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Video size={22}/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Live Interview Engine</h1>
            <p className="text-slate-400 text-sm">Face cam · Voice answers · Auto-scored · Adaptive difficulty</p>
          </div>
        </div>

        {mediaError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            <AlertCircle size={15}/>{mediaError}
          </div>
        )}

        <div className="glass rounded-2xl p-6 border border-white/5 space-y-5">

          {/* How it works */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon:"🎥", title:"Face on screen",   desc:"Camera preview before start" },
              { icon:"🎤", title:"Speak answers",     desc:"Voice transcribed in real time" },
              { icon:"🤖", title:"Adaptive AI",       desc:"Difficulty adjusts to your level" },
            ].map((f,i) => (
              <div key={i} className="glass-light rounded-xl p-3 text-center border border-white/5">
                <div className="text-2xl mb-1">{f.icon}</div>
                <p className="text-xs font-medium text-white">{f.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Interview type */}
          <div>
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
          <div className="grid grid-cols-2 gap-3">
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

          {/* Duration + Time per Q */}
          <div className="border-t border-white/5 pt-5">
            <label className="block text-xs text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
              <Timer size={12}/>Timer configuration
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-600 mb-2">Interview duration</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${duration===d?"border-brand-500/50 bg-brand-600/10 text-brand-400":"border-white/8 text-slate-500 hover:border-white/15"}`}>
                      {d} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-2">Time per question</p>
                <div className="flex gap-1.5 flex-wrap">
                  {TIME_PER_Q.map(t => (
                    <button key={t} onClick={() => setTimePerQ(t)}
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${timePerQ===t?"border-amber-500/50 bg-amber-600/10 text-amber-400":"border-white/8 text-slate-500 hover:border-white/15"}`}>
                      {t < 1 ? "30s" : `${t} min`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary box */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Total questions", value: totalQuestions },
                { label: "Time per question", value: timePerQ < 1 ? "30 sec" : `${timePerQ} min` },
                { label: "Total duration", value: `${duration} min` },
              ].map((s,i) => (
                <div key={i} className="glass-light rounded-xl p-3 text-center border border-white/5">
                  <p className="text-xl font-bold gradient-text">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Proceed to camera preview */}
          <button onClick={goToPreview}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 font-semibold">
            <Video size={18}/>Set Up Camera & Preview
          </button>
          <p className="text-xs text-center text-slate-600">
            Interview will NOT start until you click "Start Interview" on the next screen
          </p>
        </div>
      </div>
    </div>
  );

  // ── CAMERA PREVIEW SCREEN (interview NOT started yet) ──────────────────
  if (phase === "preview") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setPhase("setup"); }}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back to setup
        </button>

        <h2 className="text-xl font-bold mb-1">Camera Preview</h2>
        <p className="text-slate-400 text-sm mb-5">Check your camera and audio before starting. Interview will begin only when you click Start.</p>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Camera preview */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-dark-900 border border-white/8" style={{aspectRatio:"4/3"}}>
              <video ref={videoRef} autoPlay muted playsInline
                className="w-full h-full object-cover"
                style={{transform:"scaleX(-1)"}}/>
              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900">
                  <VideoOff size={32} className="text-slate-600 mb-2"/>
                  <p className="text-sm text-slate-500">Camera off</p>
                </div>
              )}
              {/* Preview label */}
              <div className="absolute top-3 left-3 bg-dark-950/80 text-xs text-slate-400 px-2.5 py-1 rounded-full border border-white/10">
                PREVIEW — not recording
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={toggleCam}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all ${camOn?"glass border-white/10 text-slate-300":"bg-red-500/15 border-red-500/30 text-red-400"}`}>
                {camOn?<Video size={14}/>:<VideoOff size={14}/>}
                {camOn?"Camera On":"Camera Off"}
              </button>
              <button onClick={toggleMic}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all ${micOn?"glass border-white/10 text-slate-300":"bg-red-500/15 border-red-500/30 text-red-400"}`}>
                {micOn?<Mic size={14}/>:<MicOff size={14}/>}
                {micOn?"Mic On":"Mic Off"}
              </button>
            </div>
          </div>

          {/* Interview summary */}
          <div className="space-y-3">
            <div className="glass rounded-2xl p-5 border border-white/5 space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Interview Summary</p>
              {[
                { label:"Role",        value: role },
                { label:"Company",     value: company },
                { label:"Type",        value: AGENT_TYPES.find(a=>a.v===agentType)?.l || agentType },
                { label:"Level",       value: LEVELS.find(l=>l.v===level)?.l || level },
                { label:"Duration",    value: `${duration} minutes` },
                { label:"Questions",   value: `${totalQuestions} questions` },
                { label:"Per Q",       value: timePerQ < 1 ? "30 seconds" : `${timePerQ} minute${timePerQ>1?"s":""}` },
              ].map((item,i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className="text-xs font-medium text-slate-200">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="glass rounded-xl p-4 border border-amber-500/20 bg-amber-500/5">
              <p className="text-xs text-amber-400 font-medium mb-2">⚡ Adaptive difficulty</p>
              <p className="text-xs text-slate-400">AI adjusts question difficulty based on your answers. Answer well → harder questions. Struggle → easier questions.</p>
            </div>

            {/* START INTERVIEW button — manual trigger only */}
            <button onClick={startInterview} disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all active:scale-95 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2">
              {loading ? "Starting…" : <><Play size={18}/>Start Interview Now</>}
            </button>
            <p className="text-xs text-center text-slate-600">
              Recording starts when you click the button above
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── DONE SCREEN ─────────────────────────────────────────────────────────
  if (phase === "done") return (
    <div className="min-h-screen mesh-bg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold mb-1">Interview Complete!</h1>
          <p className="text-slate-400 text-sm">{qaHistory.length} questions · {role} @ {company}</p>
        </div>

        {/* Overall score */}
        <div className="glass rounded-2xl p-6 border border-white/5 mb-4 text-center">
          <div className="text-6xl font-bold gradient-text mb-1">{avgScore ?? "—"}</div>
          <p className="text-slate-500 text-sm">/10 average score</p>
          {summary && (
            <div className={`mt-3 inline-block px-4 py-1.5 rounded-full text-sm font-medium ${safeText(summary.hiring_likelihood).includes("Yes")?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>
              {safeText(summary.hiring_likelihood) || "Good effort"}
            </div>
          )}
        </div>

        {/* Summary */}
        {summary && (
          <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">AI Performance Summary</p>
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

        {/* Q&A review */}
        <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Question by Question Review</p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {qaHistory.map((qa, i) => (
              <div key={i} className={`rounded-xl p-3 border ${qa.score>=7?"border-emerald-500/20 bg-emerald-500/5":qa.score>=5?"border-amber-500/20 bg-amber-500/5":"border-red-500/20 bg-red-500/5"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Q{i+1}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${qa.difficulty==="hard"?"bg-red-500/10 text-red-400":qa.difficulty==="easy"?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>
                      {qa.difficulty}
                    </span>
                    <span className="text-xs text-slate-600">{qa.timeUsed}s used</span>
                  </div>
                  <span className={`text-sm font-bold ${qa.score>=7?"text-emerald-400":qa.score>=5?"text-amber-400":"text-red-400"}`}>
                    {qa.score.toFixed(1)}/10
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-1 font-medium">{qa.question}</p>
                <details>
                  <summary className="text-xs text-brand-400 cursor-pointer hover:text-brand-300">
                    View answer + feedback ▸
                  </summary>
                  <p className="text-xs text-slate-400 mt-1.5 italic border-l-2 border-white/10 pl-2">"{qa.answer}"</p>
                  <p className="text-xs text-slate-500 mt-1.5">{qa.feedback}</p>
                </details>
              </div>
            ))}
          </div>
        </div>

        {/* Recording download */}
        {recs.length > 0 && (
          <div className="glass rounded-2xl p-5 border border-emerald-500/20 mb-4">
            <p className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
              <Video size={14}/>Your recording
            </p>
            {recs.map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-xs text-slate-400 truncate mr-3">{r.name}</p>
                <div className="flex gap-2 shrink-0">
                  <a href={r.url} download={r.name}
                    className="flex items-center gap-1.5 text-xs bg-brand-600/20 text-brand-400 border border-brand-500/25 px-3 py-1.5 rounded-lg hover:bg-brand-600/30 transition-colors">
                    <Download size={11}/>Download
                  </a>
                  <button onClick={() => { URL.revokeObjectURL(r.url); setRecs([]); }}
                    className="text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-600 mt-2">⚠️ Download before closing — stored locally in browser only</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            setPhase("setup");
            setQaHistory([]); setSummary(null); setRecs([]);
            setLastFeedback(null); setDifficulty("medium");
          }} className="flex-1 btn-ghost py-3 text-sm flex items-center justify-center gap-2">
            <RotateCcw size={14}/>Try again
          </button>
          <button onClick={() => router.push("/dashboard")} className="flex-1 btn-primary py-3 text-sm">
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );

  // ── LIVE INTERVIEW SCREEN ────────────────────────────────────────────────
  return (
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 glass border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>LIVE
          </div>
          <div>
            <p className="font-medium text-sm">{role} @ {company}</p>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>Q{questionNumber}/{totalQuestions}</span>
              <span>·</span>
              <span>{level}</span>
              <span>·</span>
              <span className={`flex items-center gap-0.5 ${difficulty==="hard"?"text-red-400":difficulty==="easy"?"text-emerald-400":"text-amber-400"}`}>
                {difficulty==="hard"?<TrendingUp size={10}/>:difficulty==="easy"?<TrendingDown size={10}/>:null}
                {difficulty}
              </span>
            </p>
          </div>
        </div>

        {/* Timers */}
        <div className="flex items-center gap-6">
          {/* Per-question timer */}
          <div className={`text-center ${qTimeLeft<=10?"text-red-400":qTimeLeft<=30?"text-amber-400":"text-slate-200"}`}>
            <p className={`text-3xl font-mono font-bold tabular-nums ${qTimeLeft<=10?"animate-pulse":""}`}>
              {fmt(qTimeLeft)}
            </p>
            <div className="w-28 h-2 bg-dark-800 rounded-full overflow-hidden mt-1">
              <div className={`h-full rounded-full transition-all duration-1000 ${qTimeLeft<=10?"bg-red-500":qTimeLeft<=30?"bg-amber-500":"bg-emerald-500"}`}
                style={{width:`${qPct}%`}}/>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">this question</p>
          </div>

          {/* Total timer */}
          <div className={`text-center ${totalTimeLeft<300?"text-red-400":"text-slate-500"}`}>
            <p className="text-base font-mono font-bold tabular-nums">{fmt(totalTimeLeft)}</p>
            <div className="w-20 h-1 bg-dark-800 rounded-full overflow-hidden mt-0.5">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                style={{width:`${totalPct}%`}}/>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">total left</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Camera panel */}
        <div className="w-56 shrink-0 flex flex-col border-r border-white/5 bg-dark-900">
          <div className="relative flex-1 min-h-0">
            <video ref={videoRef} autoPlay muted playsInline
              className="w-full h-full object-cover"
              style={{transform:"scaleX(-1)"}}/>
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900">
                <VideoOff size={28} className="text-slate-600 mb-2"/>
                <p className="text-xs text-slate-500">Camera off</p>
              </div>
            )}
            {/* Mic wave */}
            {isListening && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-dark-950/90 rounded-full px-3 py-1.5 border border-white/5">
                <div className="flex gap-0.5 items-end h-4">
                  {[2,4,6,4,6,4,2].map((h,i) => (
                    <div key={i} className="w-0.5 bg-emerald-400 rounded-full animate-bounce"
                      style={{height:`${h*2}px`,animationDelay:`${i*0.07}s`}}/>
                  ))}
                </div>
                <span className="text-xs text-emerald-400 font-medium">Listening</span>
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="p-3 space-y-2 shrink-0 border-t border-white/5">
            <div className="flex gap-1.5">
              <button onClick={toggleCam}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs transition-all ${camOn?"bg-dark-800 text-slate-300 hover:bg-dark-700":"bg-red-500/20 text-red-400"}`}>
                {camOn?<Video size={12}/>:<VideoOff size={12}/>}
                {camOn?"Cam":"Off"}
              </button>
              <button onClick={toggleMic}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs transition-all ${micOn?"bg-dark-800 text-slate-300 hover:bg-dark-700":"bg-red-500/20 text-red-400"}`}>
                {micOn?<Mic size={12}/>:<MicOff size={12}/>}
                {micOn?"Mic":"Off"}
              </button>
            </div>

            {/* Score tracker */}
            {qaHistory.length > 0 && (
              <div className="glass rounded-xl p-3 text-center border border-white/5">
                <p className="text-xs text-slate-500 mb-1">Running avg</p>
                <p className={`text-2xl font-bold ${Number(avgScore)>=7?"text-emerald-400":Number(avgScore)>=5?"text-amber-400":"text-red-400"}`}>
                  {avgScore}/10
                </p>
                <div className="flex gap-1 justify-center mt-2">
                  {qaHistory.slice(-6).map((qa, i) => (
                    <div key={i} title={`Q${i+1}: ${qa.score.toFixed(1)}`}
                      className={`w-2 h-2 rounded-full ${qa.score>=7?"bg-emerald-400":qa.score>=5?"bg-amber-400":"bg-red-400"}`}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main interview panel */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Question display */}
          <div className="px-6 py-5 border-b border-white/5 shrink-0">
            {autoWarn && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm mb-3 animate-pulse">
                <AlertCircle size={14}/>
                <strong>{qTimeLeft}s left!</strong> Submit now or answer auto-submits.
              </div>
            )}
            {lastFeedback && (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 mb-3 border text-xs ${lastFeedback.score>=7?"border-emerald-500/20 bg-emerald-500/5 text-emerald-300":"border-amber-500/20 bg-amber-500/5 text-amber-300"}`}>
                <span className="font-bold text-sm">{Number(lastFeedback.score||0).toFixed(1)}/10</span>
                <span className="text-slate-400 line-clamp-1">{safeText(lastFeedback.feedback).slice(0, 100)}…</span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-400">
                {questionNumber}
              </div>
              <pre className="text-base text-white font-sans whitespace-pre-wrap leading-relaxed flex-1">
                {currentQuestion}
              </pre>
            </div>
          </div>

          {/* Answer area */}
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            {/* Live transcript */}
            <div className="glass rounded-xl p-4 border border-white/5 mb-3 min-h-28">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  {isListening
                    ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Voice transcript (speak now)</>
                    : <><MicOff size={11}/>Mic is off — type below</>
                  }
                </p>
                <button onClick={() => setTranscript("")}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  Clear
                </button>
              </div>
              {transcript
                ? <p className="text-sm text-white leading-relaxed">{transcript}</p>
                : <p className="text-sm text-slate-600 italic">
                    {isListening ? "Waiting for you to speak…" : "Enable mic above or type your answer below"}
                  </p>
              }
            </div>

            {/* Manual text fallback */}
            <div>
              <p className="text-xs text-slate-600 mb-1.5">
                Type your answer (if mic is not working):
              </p>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                placeholder="Type here as a backup to voice…"
                rows={3}
                className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/40 resize-none placeholder:text-slate-700 leading-relaxed"
              />
            </div>
          </div>

          {/* Submit button */}
          <div className="px-6 py-4 border-t border-white/5 shrink-0">
            <button
              onClick={doSubmit}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                qTimeLeft <= 10
                  ? "bg-red-600 hover:bg-red-500 animate-pulse"
                  : qTimeLeft <= 30
                  ? "bg-amber-600 hover:bg-amber-500"
                  : "bg-brand-600 hover:bg-brand-500"
              }`}
            >
              {loading
                ? "Evaluating your answer…"
                : <><Send size={16}/>Submit Answer  →  Next Question</>
              }
            </button>
            <p className="text-center text-xs text-slate-600 mt-1.5">
              Answer auto-submits when the question timer reaches 0:00
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
