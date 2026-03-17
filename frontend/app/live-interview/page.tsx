"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, Square, Play, ChevronLeft, Clock, AlertCircle, Check, RotateCcw, Download, Trash2, Send } from "lucide-react";
import api from "@/lib/api";

const ROLES = [
  "Software Engineer","Senior Software Engineer","Frontend Engineer","Backend Engineer",
  "Full Stack Engineer","DevOps Engineer","Data Scientist","ML Engineer","AI Engineer",
  "Product Manager","Data Engineer","Cloud Architect","Security Engineer",
  "Mobile Engineer","QA Engineer","SAP Consultant","SAP Basis","Business Analyst",
  "Solution Architect","Site Reliability Engineer","Blockchain Developer",
];

const COMPANIES = [
  "","Google","Amazon","Microsoft","Meta","Apple","Netflix","Uber","Airbnb","Stripe",
  "TCS","Infosys","Wipro","HCL","Cognizant","Accenture","Flipkart","Swiggy","Zomato",
  "Razorpay","CRED","Freshworks","Zoho","Goldman Sachs","JPMorgan","Deloitte","Other",
];

const LEVELS = [
  { v: "fresher", l: "Fresher (0y)",  questions: 20 },
  { v: "junior",  l: "Junior (1-3y)", questions: 25 },
  { v: "mid",     l: "Mid (3-5y)",    questions: 30 },
  { v: "senior",  l: "Senior (5y+)",  questions: 30 },
];

const AGENT_TYPES = [
  { v: "hr",            l: "HR Interview",  icon: "��" },
  { v: "technical",     l: "Technical",     icon: "⚙️" },
  { v: "coding",        l: "Coding",        icon: "💻" },
  { v: "system_design", l: "System Design", icon: "🏗️" },
];

const safeText = (v: any) => {
  if (!v) return "";
  if (typeof v === "string") return v;
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
}

export default function LiveInterviewPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"setup"|"countdown"|"interview"|"done">("setup");

  const [role, setRole] = useState("Software Engineer");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState("mid");
  const [agentType, setAgentType] = useState("technical");

  const [sessionId, setSessionId] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(30);
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [qTimeLeft, setQTimeLeft] = useState(60);
  const [totalTimeLeft, setTotalTimeLeft] = useState(1800);
  const [qaHistory, setQaHistory] = useState<QA[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [countdown, setCountdown] = useState(3);
  const [autoWarn, setAutoWarn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const mediaRecRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const [recs, setRecs] = useState<{url:string;name:string}[]>([]);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState("");

  const qTimerRef = useRef<any>(null);
  const totalTimerRef = useRef<any>(null);
  const qStartRef = useRef<number>(Date.now());
  const submittingRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => () => {
    clearInterval(qTimerRef.current);
    clearInterval(totalTimerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
  }, []);

  const setupMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMediaReady(true);
      setMediaError("");
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecs(p => [...p, { url, name: `LiveInterview_${Date.now()}.webm` }]);
      };
    } catch {
      setMediaError("Camera/mic access denied. Please allow access in browser settings.");
      setMediaReady(false);
    }
  };

  const startSpeech = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
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
    r.onend = () => { if (!submittingRef.current) r.start(); };
    r.start();
    setIsListening(true);
  };

  const stopSpeech = () => {
    submittingRef.current = true;
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsListening(false);
  };

  const startCountdown = async () => {
    setPhase("countdown");
    await setupMedia();
    let c = 3;
    setCountdown(c);
    const iv = setInterval(() => {
      c--;
      setCountdown(c);
      if (c === 0) { clearInterval(iv); beginInterview(); }
    }, 1000);
  };

  const beginInterview = async () => {
    setLoading(true);
    try {
      const lvl = LEVELS.find(l => l.v === level);
      const { data } = await api.post("/interviews/start", {
        agent_type: agentType, job_role: role, company, experience_level: level,
      });
      setSessionId(data.session_id);
      setCurrentQuestion(safeText(data.question));
      setQuestionNumber(1);
      const tq = data.total_questions || lvl?.questions || 30;
      setTotalQuestions(tq);
      setPhase("interview");
      if (mediaRecRef.current) mediaRecRef.current.start(1000);
      submittingRef.current = false;
      startSpeech();
      setQTimeLeft(60);
      setTotalTimeLeft(tq * 60);
      qStartRef.current = Date.now();
      qTimerRef.current = setInterval(() => {
        setQTimeLeft(p => {
          if (p <= 6) setAutoWarn(true);
          if (p <= 1) { setAutoWarn(false); return 0; }
          return p - 1;
        });
      }, 1000);
      totalTimerRef.current = setInterval(() => {
        setTotalTimeLeft(p => { if (p <= 1) { clearInterval(totalTimerRef.current); return 0; } return p - 1; });
      }, 1000);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to start. Try again.");
      setPhase("setup");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (phase === "interview" && qTimeLeft === 0) doSubmit();
  }, [qTimeLeft, phase]);

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
      setQaHistory(p => [...p, {
        question: currentQuestion, answer, score: data.score || 0,
        feedback: safeText(data.feedback), timeUsed,
      }]);
      setFeedback(data);
      if (data.session_complete) {
        clearInterval(totalTimerRef.current);
        if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
        setSummary(data.summary);
        setPhase("done");
      } else {
        setCurrentQuestion(safeText(data.next_question));
        setQuestionNumber(data.question_number);
        setQTimeLeft(60);
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
    } catch { alert("Submit failed. Try again."); submittingRef.current = false; }
    finally { setLoading(false); }
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
    ? (qaHistory.reduce((s, q) => s + q.score, 0) / qaHistory.length).toFixed(1) : "0";

  // ── SETUP ──────────────────────────────────────────────────────────────
  if (phase === "setup") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Video size={20}/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Live Interview Mode</h1>
            <p className="text-slate-400 text-sm">Face cam + voice + 1 min per question + recording</p>
          </div>
        </div>

        {mediaError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            <AlertCircle size={15}/>{mediaError}
          </div>
        )}

        <div className="glass rounded-2xl p-6 border border-white/5 space-y-5">
          <div className="bg-brand-600/10 border border-brand-500/20 rounded-xl p-4">
            <p className="text-xs font-medium text-brand-400 mb-2">⚡ How it works</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                "Your face shown on screen","Speak your answers aloud",
                "1 minute per question","Auto-submits when timer ends",
                "AI scores every answer","Full session recorded",
              ].map((t,i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className="text-brand-400">✓</span>{t}
                </div>
              ))}
            </div>
          </div>

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

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Job role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="input-field text-sm py-2.5">
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Company <span className="text-slate-700 normal-case">(optional)</span></label>
            <select value={company} onChange={e => setCompany(e.target.value)} className="input-field text-sm py-2.5">
              <option value="">No specific company</option>
              {COMPANIES.filter(Boolean).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wide">Experience level</label>
            <div className="grid grid-cols-4 gap-2">
              {LEVELS.map(l => (
                <button key={l.v} onClick={() => setLevel(l.v)}
                  className={`py-2.5 rounded-xl border text-xs transition-all text-center ${level===l.v?"border-brand-500/50 bg-brand-600/10 text-white":"border-white/8 text-slate-400 hover:border-white/15"}`}>
                  <p className="font-medium">{l.l}</p>
                  <p className="text-slate-600 mt-0.5">{l.questions} Qs · {l.questions} min</p>
                </button>
              ))}
            </div>
          </div>

          <button onClick={startCountdown}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 font-semibold">
            <Video size={18}/>Start Live Interview
          </button>
          <p className="text-xs text-center text-slate-600">
            Browser will request camera + microphone permission
          </p>
        </div>
      </div>
    </div>
  );

  // ── COUNTDOWN ──────────────────────────────────────────────────────────
  if (phase === "countdown") return (
    <div className="h-screen bg-dark-950 flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <video ref={videoRef} autoPlay muted playsInline
          className="w-72 h-54 object-cover rounded-2xl border border-white/10"
          style={{ transform: "scaleX(-1)" }}/>
        {!mediaReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/90 rounded-2xl">
            <p className="text-slate-400 text-sm">Accessing camera…</p>
          </div>
        )}
      </div>
      {mediaError ? (
        <div className="text-center">
          <p className="text-red-400 text-sm mb-4">{mediaError}</p>
          <button onClick={() => setPhase("setup")} className="btn-ghost px-6 py-2 text-sm">Go back</button>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-9xl font-bold gradient-text animate-pulse mb-2">
            {countdown > 0 ? countdown : "GO!"}
          </div>
          <p className="text-slate-400">Get ready! Interview starts in {countdown}s</p>
          <p className="text-xs text-slate-600 mt-1">Speak clearly · 1 min per question · auto-submit</p>
        </div>
      )}
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────────────────
  if (phase === "done") return (
    <div className="min-h-screen mesh-bg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold mb-1">Live Interview Complete!</h1>
          <p className="text-slate-400 text-sm">{qaHistory.length} questions answered</p>
        </div>
        <div className="glass rounded-2xl p-6 border border-white/5 mb-4 text-center">
          <div className="text-5xl font-bold gradient-text mb-1">{avgScore}</div>
          <p className="text-slate-500 text-sm">/10 average score</p>
          {summary && (
            <div className={`mt-3 inline-block px-3 py-1 rounded-full text-sm font-medium ${safeText(summary.hiring_likelihood).includes("Yes")?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>
              {safeText(summary.hiring_likelihood) || "Good effort"}
            </div>
          )}
        </div>
        {summary && (
          <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
            <p className="text-xs text-slate-500 uppercase font-medium mb-2">Performance Summary</p>
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {safeText(summary.performance_summary)}
            </pre>
          </div>
        )}
        <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
          <p className="text-xs text-slate-500 uppercase font-medium mb-3">Question by Question</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {qaHistory.map((qa, i) => (
              <div key={i} className={`rounded-xl p-3 border ${qa.score>=7?"border-emerald-500/20 bg-emerald-500/5":qa.score>=5?"border-amber-500/20 bg-amber-500/5":"border-red-500/20 bg-red-500/5"}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-400">Q{i+1} · {qa.timeUsed}s used</p>
                  <span className={`text-xs font-bold ${qa.score>=7?"text-emerald-400":qa.score>=5?"text-amber-400":"text-red-400"}`}>{qa.score.toFixed(1)}/10</span>
                </div>
                <p className="text-xs text-slate-300 mb-1">{qa.question}</p>
                <details>
                  <summary className="text-xs text-brand-400 cursor-pointer">Answer + feedback</summary>
                  <p className="text-xs text-slate-400 mt-1 italic">"{qa.answer}"</p>
                  <p className="text-xs text-slate-500 mt-1">{qa.feedback}</p>
                </details>
              </div>
            ))}
          </div>
        </div>
        {recs.length > 0 && (
          <div className="glass rounded-2xl p-5 border border-emerald-500/15 mb-4">
            <p className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2"><Video size={14}/>Session recording</p>
            {recs.map((r,i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-xs text-slate-400 truncate">{r.name}</p>
                <div className="flex gap-2 shrink-0">
                  <a href={r.url} download={r.name} className="flex items-center gap-1.5 text-xs bg-brand-600/20 text-brand-400 px-3 py-1.5 rounded-lg">
                    <Download size={11}/>Download
                  </a>
                  <button onClick={()=>{URL.revokeObjectURL(r.url);setRecs([]);}} className="text-red-400 p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-600 mt-2">⚠️ Download before closing tab — stored locally only</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={()=>{setPhase("setup");setQaHistory([]);setSummary(null);setRecs([]);setFeedback(null);}}
            className="flex-1 btn-ghost py-3 text-sm flex items-center justify-center gap-2">
            <RotateCcw size={14}/>Try again
          </button>
          <button onClick={()=>router.push("/dashboard")} className="flex-1 btn-primary py-3 text-sm">Dashboard</button>
        </div>
      </div>
    </div>
  );

  // ── LIVE SCREEN ────────────────────────────────────────────────────────
  const qPct = (qTimeLeft / 60) * 100;
  const totalPct = (totalTimeLeft / (totalQuestions * 60)) * 100;

  return (
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 glass border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>LIVE
          </div>
          <div>
            <p className="font-medium text-sm">{role}{company?` @ ${company}`:""}</p>
            <p className="text-xs text-slate-500">Q{questionNumber}/{totalQuestions} · {level}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Per-Q timer */}
          <div className={`text-center ${qTimeLeft<=10?"text-red-400":qTimeLeft<=30?"text-amber-400":"text-slate-200"}`}>
            <p className={`text-2xl font-mono font-bold ${qTimeLeft<=10?"animate-pulse":""}`}>{fmt(qTimeLeft)}</p>
            <div className="w-24 h-2 bg-dark-800 rounded-full overflow-hidden mt-1">
              <div className={`h-full rounded-full transition-all duration-1000 ${qTimeLeft<=10?"bg-red-500":qTimeLeft<=30?"bg-amber-500":"bg-emerald-500"}`}
                style={{width:`${qPct}%`}}/>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">this question</p>
          </div>
          {/* Total */}
          <div className={`text-center ${totalTimeLeft<300?"text-red-400":"text-slate-400"}`}>
            <p className="text-sm font-mono font-bold">{fmt(totalTimeLeft)}</p>
            <div className="w-20 h-1 bg-dark-800 rounded-full overflow-hidden mt-0.5">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-1000" style={{width:`${totalPct}%`}}/>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">total left</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Camera panel */}
        <div className="w-60 shrink-0 flex flex-col border-r border-white/5">
          <div className="relative flex-1 bg-dark-900 min-h-0">
            <video ref={videoRef} autoPlay muted playsInline
              className="w-full h-full object-cover"
              style={{transform:"scaleX(-1)"}}/>
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900">
                <VideoOff size={28} className="text-slate-600 mb-2"/>
                <p className="text-xs text-slate-500">Camera off</p>
              </div>
            )}
            {/* Mic wave animation */}
            {isListening && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-dark-950/80 rounded-full px-3 py-1.5">
                <div className="flex gap-0.5 items-end h-4">
                  {[1,2,3,4,3,2,1].map((h,i) => (
                    <div key={i} className="w-0.5 bg-emerald-400 rounded-full animate-bounce"
                      style={{height:`${h*4}px`,animationDelay:`${i*0.08}s`}}/>
                  ))}
                </div>
                <span className="text-xs text-emerald-400 font-medium">Listening</span>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-white/5 space-y-2 shrink-0">
            <div className="flex gap-2">
              <button onClick={toggleCam}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs ${camOn?"bg-dark-800 text-slate-300":"bg-red-500/20 text-red-400"}`}>
                {camOn?<Video size={12}/>:<VideoOff size={12}/>}
                {camOn?"On":"Off"}
              </button>
              <button onClick={toggleMic}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs ${micOn?"bg-dark-800 text-slate-300":"bg-red-500/20 text-red-400"}`}>
                {micOn?<Mic size={12}/>:<MicOff size={12}/>}
                {micOn?"On":"Off"}
              </button>
            </div>
            {qaHistory.length > 0 && (
              <div className="glass rounded-lg p-2.5 text-center border border-white/5">
                <p className="text-xs text-slate-500">Avg score</p>
                <p className={`text-xl font-bold ${Number(avgScore)>=7?"text-emerald-400":Number(avgScore)>=5?"text-amber-400":"text-red-400"}`}>
                  {avgScore}/10
                </p>
                <div className="flex gap-0.5 justify-center mt-1">
                  {qaHistory.slice(-6).map((qa,i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${qa.score>=7?"bg-emerald-400":qa.score>=5?"bg-amber-400":"bg-red-400"}`}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Question */}
          <div className="p-5 border-b border-white/5 shrink-0">
            {autoWarn && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-red-400 text-xs mb-3 animate-pulse">
                <AlertCircle size={13}/>Auto-submitting in {qTimeLeft}s! Speak now or it submits automatically.
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-brand-600/20 text-brand-400 px-2 py-0.5 rounded-full font-medium">
                Q{questionNumber}/{totalQuestions}
              </span>
              {feedback && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${feedback.score>=7?"bg-emerald-500/10 text-emerald-400":"bg-amber-500/10 text-amber-400"}`}>
                  Last: {Number(feedback.score||0).toFixed(1)}/10
                </span>
              )}
            </div>
            <pre className="text-base text-white font-sans whitespace-pre-wrap leading-relaxed">
              {currentQuestion}
            </pre>
          </div>

          {/* Transcript */}
          <div className="flex-1 p-5 overflow-y-auto">
            <div className="glass rounded-xl p-4 border border-white/5 min-h-28 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  {isListening
                    ? <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>Transcribing voice…</>
                    : <><MicOff size={11}/>Mic off — type below</>
                  }
                </p>
                <button onClick={()=>setTranscript("")} className="text-xs text-slate-600 hover:text-slate-400">Clear</button>
              </div>
              {transcript
                ? <p className="text-sm text-white leading-relaxed">{transcript}</p>
                : <p className="text-sm text-slate-600 italic">{isListening?"Start speaking — words appear here in real time":"Enable mic or type below"}</p>
              }
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1.5">Type if mic is not working:</p>
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
                placeholder="Type your answer here…" rows={2}
                className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/40 resize-none placeholder:text-slate-700"/>
            </div>
          </div>

          {/* Submit */}
          <div className="p-4 border-t border-white/5 shrink-0">
            <button onClick={doSubmit} disabled={loading}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${qTimeLeft<=10?"bg-red-600 hover:bg-red-500 animate-pulse":"bg-brand-600 hover:bg-brand-500"}`}>
              {loading?"Evaluating…":<><Send size={15}/>Submit Answer & Next Question</>}
            </button>
            <p className="text-center text-xs text-slate-600 mt-1.5">
              Submits automatically when timer reaches 0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
