"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Play, Loader2, RotateCcw, Lightbulb, AlertCircle } from "lucide-react";
import api from "@/lib/api";

const LANGS = ["Python","JavaScript","TypeScript","Java","C++","Go","Rust"];
const DIFFS = ["Easy","Medium","Hard"];
const TOPICS = ["Arrays","Strings","Linked Lists","Trees","Graphs","Dynamic Programming","Sorting","Binary Search","Hashing"];

const DEFAULT_CODE: Record<string,string> = {
  Python: "# Write your Python solution here\n\ndef solution():\n    # Your code here\n    pass\n\nprint(solution())\n",
  JavaScript: "// Write your JavaScript solution here\n\nfunction solution() {\n    // Your code here\n}\n\nconsole.log(solution());\n",
  TypeScript: "function solution(): any {\n    // Your code here\n}\nconsole.log(solution());\n",
  Java: "public class Solution {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}\n",
  "C++": "#include <iostream>\nusing namespace std;\nint main() {\n    // Your code here\n    return 0;\n}\n",
  Go: "package main\nimport \"fmt\"\nfunc main() {\n    fmt.Println(\"Hello\")\n}\n",
  Rust: "fn main() {\n    println!(\"Hello\");\n}\n",
};

function formatQuestion(q: any): string {
  if (!q) return "";
  if (typeof q === "string") return q;
  try {
    const parts: string[] = [];
    if (q.title) parts.push(`## ${q.title}`);
    if (q.problem) parts.push(q.problem);
    if (q.examples?.length) {
      parts.push("\n**Examples:**");
      q.examples.forEach((e: any, i: number) => {
        parts.push(`Example ${i+1}: Input: \`${e.input}\` → Output: \`${e.output}\``);
      });
    }
    if (q.constraints) {
      parts.push("\n**Constraints:**");
      Object.entries(q.constraints).forEach(([k,v]) => parts.push(`- ${k}: ${v}`));
    }
    if (q.context) parts.push(`\n**Hint:** ${q.context}`);
    return parts.join("\n\n") || JSON.stringify(q);
  } catch {
    return JSON.stringify(q);
  }
}

export default function PlaygroundPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState("Python");
  const [diff, setDiff] = useState("Medium");
  const [topic, setTopic] = useState("Arrays");
  const [questionText, setQuestionText] = useState("");
  const [hintText, setHintText] = useState("");
  const [code, setCode] = useState(DEFAULT_CODE["Python"]);
  const [explanation, setExplanation] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const hasFetched = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !hasFetched.current) {
      hasFetched.current = true;
      generateProblem();
    }
  }, [mounted]);

  const generateProblem = async () => {
    setLoading(true);
    setFeedback(null);
    setError("");
    setQuestionText("");
    setHintText("");
    try {
      const { data } = await api.post("/agents/quick-question", {
        agent_type: "coding",
        job_role: `${diff} ${topic} coding problem`,
        experience_level: diff === "Easy" ? "fresher" : diff === "Medium" ? "mid" : "senior",
      });
      const formatted = formatQuestion(data.question);
      if (formatted) {
        setQuestionText(formatted);
        setHintText(typeof data.context === "string" ? data.context : "");
        setCode(DEFAULT_CODE[lang] || DEFAULT_CODE["Python"]);
      } else {
        setError("No question returned. Try again.");
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to load. Make sure you are logged in.");
    } finally {
      setLoading(false);
    }
  };

  const evaluate = async () => {
    if (!code.trim() || !questionText) return;
    setEvaluating(true);
    setFeedback(null);
    setError("");
    try {
      const { data: sessionData } = await api.post("/interviews/start", {
        agent_type: "coding",
        job_role: `${diff} ${topic}`,
        experience_level: diff === "Easy" ? "fresher" : diff === "Medium" ? "mid" : "senior",
      });
      const { data } = await api.post(`/interviews/${sessionData.session_id}/answer`, {
        answer: `My ${lang} solution:\n\`\`\`${lang.toLowerCase()}\n${code}\n\`\`\`\nExplanation: ${explanation || "See code above"}`,
        question: questionText,
      });
      setFeedback(data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen mesh-bg p-6">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-5">
          <ChevronLeft size={15}/>Back
        </button>
        <h1 className="text-2xl font-bold mb-1">Coding Playground</h1>
        <p className="text-slate-400 text-sm mb-5">Practice coding problems with AI evaluation</p>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            <AlertCircle size={15}/>{error}
            <button onClick={() => setError("")} className="ml-auto">✕</button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-5 p-4 glass rounded-2xl border border-white/5 items-end">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Language</label>
            <select value={lang} onChange={e => { setLang(e.target.value); setCode(DEFAULT_CODE[e.target.value] || DEFAULT_CODE["Python"]); }}
              className="bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {LANGS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Difficulty</label>
            <div className="flex gap-1.5">
              {DIFFS.map(d => (
                <button key={d} onClick={() => setDiff(d)}
                  className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                    diff===d ? d==="Easy" ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
                      : d==="Medium" ? "bg-amber-600/20 border-amber-500/40 text-amber-400"
                      : "bg-red-600/20 border-red-500/40 text-red-400"
                    : "glass border-white/8 text-slate-500"}`}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Topic</label>
            <select value={topic} onChange={e => setTopic(e.target.value)}
              className="bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {TOPICS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={generateProblem} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2 text-sm ml-auto">
            {loading ? <Loader2 size={13} className="animate-spin"/> : <Play size={13}/>}
            {loading ? "Loading…" : "New Problem"}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-4">
            {loading ? (
              <div className="glass rounded-2xl p-8 border border-white/5 flex flex-col items-center justify-center min-h-48">
                <Loader2 size={28} className="animate-spin text-brand-400 mb-3"/>
                <p className="text-sm text-slate-400">Generating problem…</p>
              </div>
            ) : questionText ? (
              <div className="glass rounded-2xl p-5 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    diff==="Easy" ? "bg-emerald-500/10 text-emerald-400"
                    : diff==="Medium" ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"}`}>{diff}</span>
                  <span className="text-xs bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded-full font-medium">{topic}</span>
                </div>
                <pre className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {questionText}
                </pre>
                {hintText && (
                  <div className="mt-3 text-xs text-brand-400 flex items-start gap-1.5 bg-brand-600/10 rounded-lg px-3 py-2">
                    <Lightbulb size={11} className="mt-0.5 shrink-0"/>
                    <span>{hintText}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass rounded-2xl p-12 border border-dashed border-white/8 text-center min-h-48 flex flex-col items-center justify-center">
                <div className="text-3xl mb-3">💻</div>
                <p className="text-sm font-medium mb-1">No problem loaded</p>
                <p className="text-xs text-slate-600 mb-3">Click to generate a problem</p>
                <button onClick={generateProblem} className="btn-primary text-xs px-4 py-2">
                  Generate Problem
                </button>
              </div>
            )}

            {feedback && (
              <div className="glass rounded-2xl p-5 border border-white/5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-bold ${feedback.score>=7?"text-emerald-400":feedback.score>=5?"text-amber-400":"text-red-400"}`}>
                    {Number(feedback.score||0).toFixed(1)}<span className="text-sm text-slate-600">/10</span>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({length:10}).map((_,i)=>(
                      <div key={i} className={`w-2 h-2 rounded-full ${i<Math.round(feedback.score||0)?"bg-brand-400":"bg-dark-800"}`}/>
                    ))}
                  </div>
                </div>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                  {typeof feedback.feedback === "string" ? feedback.feedback : JSON.stringify(feedback.feedback)}
                </pre>
                {feedback.suggested_answer && (
                  <details>
                    <summary className="text-xs text-brand-400 cursor-pointer">View optimal solution ▸</summary>
                    <pre className="mt-2 text-xs text-slate-300 bg-dark-900 rounded-lg p-3 border border-white/5 whitespace-pre-wrap font-sans">
                      {typeof feedback.suggested_answer === "string" ? feedback.suggested_answer : JSON.stringify(feedback.suggested_answer)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-dark-900/50">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"/>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60"/>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60"/>
                  </div>
                  <span className="text-xs text-slate-600 font-mono ml-1">
                    solution.{lang==="Python"?"py":lang==="JavaScript"?"js":lang==="TypeScript"?"ts":lang==="Java"?"java":lang==="C++"?"cpp":lang==="Go"?"go":"rs"}
                  </span>
                </div>
                <button onClick={() => setCode(DEFAULT_CODE[lang] || "")}
                  className="text-slate-600 hover:text-slate-400 text-xs flex items-center gap-1">
                  <RotateCcw size={10}/>Reset
                </button>
              </div>
              <textarea value={code} onChange={e => setCode(e.target.value)}
                spellCheck={false}
                className="w-full h-64 bg-transparent px-4 py-3 font-mono text-xs text-slate-200 focus:outline-none resize-none leading-relaxed"
                placeholder="Write your solution here..."/>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1.5">Explain your approach <span className="text-slate-700">(optional)</span></label>
              <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2}
                placeholder="Describe algorithm, time/space complexity…"
                className="input-field resize-none text-sm"/>
            </div>

            <button onClick={evaluate} disabled={evaluating || !code.trim() || !questionText}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
              {evaluating ? <><Loader2 size={14} className="animate-spin"/>Evaluating…</> : <><Play size={14}/>Evaluate with AI</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
