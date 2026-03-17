"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, MicOff, Video, VideoOff, ChevronLeft, AlertCircle,
  RotateCcw, Download, Trash2, Send, Play, Clock, Timer,
  TrendingUp, TrendingDown, RefreshCw, CameraIcon
} from "lucide-react";
import api from "@/lib/api";

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
  "Network Engineer","Quantitative Analyst","Financial Analyst",
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
  "Early Stage Startup","Series B Startup","Other Company",
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
    const parts: string[] = [];
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

type CameraStatus = "idle" | "requesting" | "active" | "denied" | "error";
type Phase = "setup" | "preview" | "interview" | "done";

export default function LiveInterviewPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");

  // Config
  const [role, setRole] = useState("Software Engineer");
  const [company, setCompany] = useState("Google");
  const [level, setLevel] = useState("mid");
  const [agentType, setAgentType] = useState("technical");
  const [duration, setDuration] = useState(30);
  const [timePerQ, setTimePerQ] = useState(1);

  const totalQuestions = Math.floor(duration / timePerQ);
  const perQSeconds = Math.round(timePerQ * 60);

  // Camera state — central to the whole experience
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

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
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastFeedbackText, setLastFeedbackText] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [difficulty, setDifficulty] = useState<"easy"|"medium"|"hard">("medium");
  const [autoWarn, setAutoWarn] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const floatingVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const [recs, setRecs] = useState<{ url: string; name: string }[]>([]);
  const qTimerRef = useRef<any>(null);
  const totalTimerRef = useRef<any>(null);
  const qStartRef = useRef<number>(Date.now());
  const submittingRef = useRef(false);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentQuestion, lastScore]);

  useEffect(() => () => {
    clearInterval(qTimerRef.current);
    clearInterval(totalTimerRef.current);
    stopSpeech();
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop(); } catch {}
  }, []);

  // Attach stream to a video element
  const attachStream = (el: HTMLVideoElement | null) => {
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
    }
  };

  useEffect(() => {
    if (cameraStatus === "active") {
      attachStream(videoRef.current);
      attachStream(floatingVideoRef.current);
    }
  }, [cameraStatus, phase]);

  // ── REQUEST CAMERA ────────────────────────────────────────────────────
  const requestCamera = async () => {
    setCameraStatus("requesting");
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;

      // Attach to preview video immediately
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Setup recorder
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const name = `Interview_${role.replace(/\s/g,"_")}_${new Date().toISOString().slice(0,10)}.webm`;
        setRecs(p => [...p, { url, name }]);
      };

      setCameraStatus("active");
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraStatus("denied");
        setCameraError("Camera access required for interview. Please allow camera access in your browser.");
      } else {
        setCameraStatus("error");
        setCameraError(`Camera error: ${err.message || "Unknown error"}`);
      }
    }
  };

  const retryCamera = async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    await requestCamera();
  };

  // ── SPEECH ────────────────────────────────────────────────────────────
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

  // ── PROCEED TO PREVIEW ────────────────────────────────────────────────
  const goToPreview = async () => {
    setPhase("preview");
    await requestCamera();
  };

  // ── START INTERVIEW — MANUAL ONLY ─────────────────────────────────────
  const startInterview = async () => {
    if (cameraStatus !== "active") {
      alert("Camera must be active to start the interview.");
      return;
    }
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

      // Attach stream to floating video
      setTimeout(() => attachStream(floatingVideoRef.current), 100);

      // Start recording
      if (mediaRecRef.current?.state === "inactive") mediaRecRef.current.start(1000);

      // Start speech
      submittingRef.current = false;
      startSpeech();

      // Timers
      setQTimeLeft(perQSeconds);
      setTotalTimeLeft(duration * 60);
      qStartRef.current = Date.now();

      qTimerRef.current = setInterval(() => {
        setQTimeLeft(p => {
          if (p <= 6) setAutoWarn(true);
          if (p <= 1) { setAutoWarn(false); return 0; }
          return p - 1;
        });
      }, 1000);

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

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (phase === "interview" && qTimeLeft === 0 && !submittingRef.current) {
      doSubmit();
    }
  }, [qTimeLeft, phase]);

  // ── SUBMIT ANSWER ─────────────────────────────────────────────────────
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
        answer, question: currentQuestion,
      });

      const score = Number(data.score || 0);

      // Adaptive difficulty
      let newDiff: "easy"|"medium"|"hard" = difficulty;
      if (score >= 8) newDiff = difficulty === "easy" ? "medium" : "hard";
      else if (score <= 4) newDiff = difficulty === "hard" ? "medium" : "easy";
      setDifficulty(newDiff);

      setLastScore(score);
      setLastFeedbackText(safeText(data.feedback).slice(0, 120));

      setQaHistory(p => [...p, {
        question: currentQuestion, answer, score,
        feedback: safeText(data.feedback), timeUsed, difficulty,
      }]);

      if (data.session_complete) {
        clearInterval(totalTimerRef.current);
        try { if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop(); } catch {}
        setSummary(data.summary);
        setPhase("done");
      } else {
        setCurrentQuestion(safeText(data.next_question));
        setQuestionNumber(data.question_number);
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

  if (!mounted) return null;

  const avgScore = qaHistory.length > 0
    ? (qaHistory.reduce((s, q) => s + q.score, 0) / qaHistory.length).toFixed(1)
    : null;
  const qPct = (qTimeLeft / perQSeconds) * 100;
  const totalPct = (totalTimeLeft / (duration * 60)) * 100;

  // ── CAMERA ERROR OVERLAY (reusable) ──────────────────────────────────
  const CameraErrorOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-950 rounded-2xl z-10 p-6 text-center">
      <CameraIcon size={40} className="text-red-500 mb-3"/>
      <p className="text-sm font-semibold text-red-400 mb-2">
        {cameraStatus === "denied" ? "Camera access required for interview" : "Camera error"}
      </p>
      <p className="text-xs text-slate-500 mb-4">{cameraError}</p>
      <button onClick={retryCamera}
        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 transition-colors px-5 py-2.5 rounded-xl text-sm font-medium">
        <RefreshCw size={14}/>Retry Camera Access
      </button>
      <p className="text-xs text-slate-600 mt-3">
        Check browser settings → allow camera for this site
      </p>
    </div>
  );

  // ── FLOATING CAMERA (during interview) ───────────────────────────────
  const FloatingCamera = () => (
    <div className="fixed top-4 right-4 z-50 group">
      <div className="relative w-44 rounded-2xl overflow-hidden border-2 border-white/15 shadow-2xl bg-dark-900"
        style={{ aspectRatio: "4/3" }}>
        <video
          ref={floatingVideoRef}
          autoPlay muted playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        {!camOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-950/90">
            <VideoOff size={20} className="text-slate-500"/>
          </div>
        )}
        {/* Mic wave indicator */}
        {isListening && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-0.5">
            {[2,4,6,4,2].map((h, i) => (
              <div key={i} className="w-0.5 bg-emerald-400 rounded-full animate-bounce opacity-90"
                style={{ height: `${h*2}px`, animationDelay: `${i * 0.08}s` }}/>
            ))}
          </div>
        )}
        {/* Controls shown on hover */}
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={toggleCam}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${camOn?"bg-dark-800/80":"bg-red-500/80"}`}>
            {camOn ? <Video size={10}/> : <VideoOff size={10}/>}
          </button>
          <button onClick={toggleMic}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${micOn?"bg-dark-800/80":"bg-red-500/80"}`}>
            {micOn ? <Mic size={10}/> : <MicOff size={10}/>}
          </button>
        </div>
        {/* Camera error retry during interview */}
        {cameraStatus === "error" || cameraStatus === "denied" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-950/90 p-2">
            <AlertCircle size={16} className="text-red-400 mb-1"/>
            <p className="text-xs text-red-400 text-center mb-1.5">Camera off</p>
            <button onClick={retryCamera}
              className="text-xs bg-brand-600 px-2 py-1 rounded-lg flex items-center gap-1">
              <RefreshCw size={10}/>Retry
            </button>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-slate-600 text-center mt-1">You (hover to toggle)</p>
    </div>
  );

  // ── SETUP SCREEN ────────────────────────────────────────────────────────
  if (phase === "setup") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Video size={22}/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Live Interview Engine</h1>
            <p className="text-slate-400 text-sm">Real camera · Voice answers · Adaptive AI · Auto-scored</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-white/5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon:"🎥", title:"Live camera", desc:"See yourself during interview" },
              { icon:"🎤", title:"Voice answers", desc:"Speak — AI transcribes live" },
              { icon:"🤖", title:"Adaptive AI",   desc:"Harder if you do well" },
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
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${duration===d?"border-brand-500/50 bg-brand-600/10 text-brand-400":"border-white/8 text-slate-500"}`}>
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
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${timePerQ===t?"border-amber-500/50 bg-amber-600/10 text-amber-400":"border-white/8 text-slate-500"}`}>
                      {t < 1 ? "30s" : `${t}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label:"Questions", value: totalQuestions },
                { label:"Per question", value: timePerQ < 1 ? "30 sec" : `${timePerQ} min` },
                { label:"Duration", value: `${duration} min` },
              ].map((s,i) => (
                <div key={i} className="glass-light rounded-xl p-3 text-center border border-white/5">
                  <p className="text-xl font-bold gradient-text">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <button onClick={goToPreview}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 font-semibold">
            <CameraIcon size={18}/>Enable Camera & Preview
          </button>
          <p className="text-xs text-center text-slate-600">
            Interview will NOT start until you click "Start Interview" on the next screen
          </p>
        </div>
      </div>
    </div>
  );

  // ── PREVIEW SCREEN (camera on, NOT started) ───────────────────────────
  if (phase === "preview") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <button onClick={() => {
          streamRef.current?.getTracks().forEach(t => t.stop());
          setCameraStatus("idle");
          setPhase("setup");
        }} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back to setup
        </button>

        <h2 className="text-xl font-bold mb-1">Camera Preview</h2>
        <p className="text-slate-400 text-sm mb-5">
          Check your camera and audio. Interview starts only when you click the button below.
        </p>

        <div className="grid md:grid-cols-5 gap-5">
          {/* Camera — takes 3/5 width */}
          <div className="md:col-span-3 space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-dark-900 border border-white/8"
              style={{ aspectRatio: "4/3" }}>
              {/* Loading state */}
              {cameraStatus === "requesting" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-950 z-10">
                  <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3"/>
                  <p className="text-sm text-slate-400">Requesting camera access…</p>
                </div>
              )}
              {/* Camera denied/error */}
              {(cameraStatus === "denied" || cameraStatus === "error") && <CameraErrorOverlay />}
              {/* Idle */}
              {cameraStatus === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-950">
                  <CameraIcon size={36} className="text-slate-600 mb-3"/>
                  <p className="text-sm text-slate-500">Camera not started</p>
                </div>
              )}
              {/* Live video */}
              <video ref={videoRef} autoPlay muted playsInline
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}/>
              {/* Camera off overlay */}
              {cameraStatus === "active" && !camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-950">
                  <VideoOff size={32} className="text-slate-600 mb-2"/>
                  <p className="text-sm text-slate-500">Camera off</p>
                </div>
              )}
              {/* Labels */}
              {cameraStatus === "active" && (
                <>
                  <div className="absolute top-3 left-3 bg-dark-950/80 text-xs text-slate-400 px-2.5 py-1 rounded-full border border-white/10">
                    PREVIEW — not recording
                  </div>
                  {isListening && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-dark-950/80 px-3 py-1.5 rounded-full border border-white/10">
                      <div className="flex gap-0.5 items-end h-3">
                        {[2,4,3,5,3,4,2].map((h,i)=>(
                          <div key={i} className="w-0.5 bg-emerald-400 rounded-full animate-bounce"
                            style={{height:`${h*2}px`,animationDelay:`${i*0.07}s`}}/>
                        ))}
                      </div>
                      <span className="text-xs text-emerald-400">Mic active</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Camera controls */}
            {cameraStatus === "active" && (
              <div className="flex gap-2">
                <button onClick={toggleCam}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all ${camOn?"glass border-white/10 text-slate-300 hover:bg-white/5":"bg-red-500/15 border-red-500/30 text-red-400"}`}>
                  {camOn?<Video size={14}/>:<VideoOff size={14}/>}
                  {camOn?"Camera On":"Camera Off"}
                </button>
                <button onClick={toggleMic}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all ${micOn?"glass border-white/10 text-slate-300 hover:bg-white/5":"bg-red-500/15 border-red-500/30 text-red-400"}`}>
                  {micOn?<Mic size={14}/>:<MicOff size={14}/>}
                  {micOn?"Mic On":"Mic Off"}
                </button>
              </div>
            )}
          </div>

          {/* Config summary — takes 2/5 */}
          <div className="md:col-span-2 space-y-3">
            <div className="glass rounded-2xl p-4 border border-white/5 space-y-2.5">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Interview Config</p>
              {[
                { label:"Role",        value: role },
                { label:"Company",     value: company },
                { label:"Type",        value: AGENT_TYPES.find(a=>a.v===agentType)?.l || agentType },
                { label:"Level",       value: LEVELS.find(l=>l.v===level)?.l || level },
                { label:"Duration",    value: `${duration} min` },
                { label:"Questions",   value: `${totalQuestions}` },
                { label:"Per Q",       value: timePerQ < 1 ? "30 sec" : `${timePerQ} min` },
              ].map((item,i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className="text-xs font-medium text-slate-200 text-right max-w-32 truncate">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="glass rounded-xl p-3 border border-amber-500/20 bg-amber-500/5 space-y-1">
              <p className="text-xs font-medium text-amber-400">⚡ Adaptive difficulty</p>
              <p className="text-xs text-slate-500">AI adjusts question difficulty in real time based on your performance.</p>
            </div>

            {/* START — manual only */}
            <button
              onClick={startInterview}
              disabled={cameraStatus !== "active" || loading || !camOn}
              className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                cameraStatus === "active" && camOn
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-dark-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {loading ? "Starting…" : <><Play size={16}/>Start Interview</>}
            </button>

            {cameraStatus !== "active" && (
              <p className="text-xs text-center text-amber-400 flex items-center justify-center gap-1">
                <AlertCircle size={11}/>Camera must be active to start
              </p>
            )}
            {cameraStatus === "active" && !camOn && (
              <p className="text-xs text-center text-amber-400 flex items-center justify-center gap-1">
                <AlertCircle size={11}/>Turn camera ON to start
              </p>
            )}
            {cameraStatus === "active" && camOn && (
              <p className="text-xs text-center text-slate-600">
                Recording starts when you click Start
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── DONE SCREEN ──────────────────────────────────────────────────────────
  if (phase === "done") return (
    <div className="min-h-screen mesh-bg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold mb-1">Interview Complete!</h1>
          <p className="text-slate-400 text-sm">{qaHistory.length} questions · {role} @ {company}</p>
        </div>

        <div className="glass rounded-2xl p-6 border border-white/5 mb-4 text-center">
          <div className="text-6xl font-bold gradient-text mb-1">{avgScore ?? "—"}</div>
          <p className="text-slate-500 text-sm">/10 average score</p>
          {summary && (
            <div className={`mt-3 inline-block px-4 py-1.5 rounded-full text-sm font-medium ${safeText(summary.hiring_likelihood).includes("Yes")?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>
              {safeText(summary.hiring_likelihood) || "Good effort"}
            </div>
          )}
        </div>

        {summary && (
          <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">AI Summary</p>
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

        <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Question Review</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {qaHistory.map((qa, i) => (
              <div key={i} className={`rounded-xl p-3 border ${qa.score>=7?"border-emerald-500/20 bg-emerald-500/5":qa.score>=5?"border-amber-500/20 bg-amber-500/5":"border-red-500/20 bg-red-500/5"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Q{i+1}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${qa.difficulty==="hard"?"bg-red-500/10 text-red-400":qa.difficulty==="easy"?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>
                      {qa.difficulty}
                    </span>
                    <span className="text-xs text-slate-600">{qa.timeUsed}s</span>
                  </div>
                  <span className={`text-sm font-bold ${qa.score>=7?"text-emerald-400":qa.score>=5?"text-amber-400":"text-red-400"}`}>
                    {qa.score.toFixed(1)}/10
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-1 font-medium line-clamp-2">{qa.question}</p>
                <details>
                  <summary className="text-xs text-brand-400 cursor-pointer">View answer + feedback ▸</summary>
                  <p className="text-xs text-slate-400 mt-1 italic border-l-2 border-white/10 pl-2">"{qa.answer}"</p>
                  <p className="text-xs text-slate-500 mt-1">{qa.feedback}</p>
                </details>
              </div>
            ))}
          </div>
        </div>

        {recs.length > 0 && (
          <div className="glass rounded-2xl p-5 border border-emerald-500/20 mb-4">
            <p className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
              <Video size={14}/>Session recording
            </p>
            {recs.map((r,i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-xs text-slate-400 truncate mr-3">{r.name}</p>
                <div className="flex gap-2 shrink-0">
                  <a href={r.url} download={r.name}
                    className="flex items-center gap-1.5 text-xs bg-brand-600/20 text-brand-400 border border-brand-500/25 px-3 py-1.5 rounded-lg hover:bg-brand-600/30">
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

        <div className="flex gap-3">
          <button onClick={() => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            setCameraStatus("idle");
            setPhase("setup");
            setQaHistory([]); setSummary(null); setRecs([]);
            setLastScore(null); setLastFeedbackText(""); setDifficulty("medium");
          }} className="flex-1 btn-ghost py-3 text-sm flex items-center justify-center gap-2">
            <RotateCcw size={14}/>Try again
          </button>
          <button onClick={()=>router.push("/dashboard")} className="flex-1 btn-primary py-3 text-sm">
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );

  // ── LIVE INTERVIEW SCREEN ────────────────────────────────────────────────
  return (
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">

      {/* Floating camera — top right, always visible */}
      <FloatingCamera />

      {/* Header */}
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
        <div className="flex items-center gap-8 mr-52">
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
          <div className={`text-center ${totalTimeLeft<300?"text-red-400":"text-slate-500"}`}>
            <p className="text-lg font-mono font-bold tabular-nums">{fmt(totalTimeLeft)}</p>
            <div className="w-20 h-1 bg-dark-800 rounded-full overflow-hidden mt-0.5">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                style={{width:`${totalPct}%`}}/>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">total left</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Question */}
        <div className="px-6 py-5 border-b border-white/5 shrink-0">
          {autoWarn && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm mb-3 animate-pulse">
              <AlertCircle size={14}/>
              <strong>{qTimeLeft}s left!</strong> Submit now or auto-submits at 0.
            </div>
          )}
          {lastScore !== null && (
            <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 mb-3 border text-xs ${lastScore>=7?"border-emerald-500/20 bg-emerald-500/5":"border-amber-500/20 bg-amber-500/5"}`}>
              <span className={`font-bold text-sm ${lastScore>=7?"text-emerald-400":lastScore>=5?"text-amber-400":"text-red-400"}`}>
                {lastScore.toFixed(1)}/10
              </span>
              <span className="text-slate-400 line-clamp-1">{lastFeedbackText}…</span>
            </div>
          )}
          <div className="flex items-start gap-3 pr-52">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-400">
              {questionNumber}
            </div>
            <pre className="text-base text-white font-sans whitespace-pre-wrap leading-relaxed">
              {currentQuestion}
            </pre>
          </div>
        </div>

        {/* Answer area */}
        <div className="flex-1 px-6 py-4 overflow-y-auto pr-56">
          {/* Live transcript box */}
          <div className="glass rounded-xl p-4 border border-white/5 mb-3 min-h-28">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                {isListening
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                      Transcribing your voice in real time…</>
                  : <><MicOff size={11}/>Mic off — type below</>
                }
              </p>
              <button onClick={() => setTranscript("")}
                className="text-xs text-slate-600 hover:text-slate-400">Clear</button>
            </div>
            {transcript
              ? <p className="text-sm text-white leading-relaxed">{transcript}</p>
              : <p className="text-sm text-slate-600 italic">
                  {isListening
                    ? "Speak now — your words appear here"
                    : "Enable mic or type below"}
                </p>
            }
          </div>

          <div>
            <p className="text-xs text-slate-600 mb-1.5">Type if mic is not working:</p>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Type your answer here as a backup…"
              rows={3}
              className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/40 resize-none placeholder:text-slate-700 leading-relaxed"
            />
          </div>
          <div ref={endRef}/>
        </div>

        {/* Submit */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0 pr-56">
          <button
            onClick={doSubmit}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
              qTimeLeft<=10 ? "bg-red-600 hover:bg-red-500 animate-pulse"
              : qTimeLeft<=30 ? "bg-amber-600 hover:bg-amber-500"
              : "bg-brand-600 hover:bg-brand-500"
            }`}
          >
            {loading ? "Evaluating…" : <><Send size={16}/>Submit Answer → Next Question</>}
          </button>
          <p className="text-center text-xs text-slate-600 mt-1.5">
            Auto-submits when timer reaches 0:00
          </p>
        </div>
      </div>
    </div>
  );
}
