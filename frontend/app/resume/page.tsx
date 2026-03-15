"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Upload, FileText, AlertTriangle, Check, TrendingUp, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import api from "@/lib/api";

export default function ResumePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File|null>(null);
  const [role, setRole] = useState("Software Engineer");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".pdf")) { alert("PDF only"); return; }
    if (f.size > 5*1024*1024) { alert("Max 5MB"); return; }
    setFile(f);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true); setAnalysis(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post(
        `/agents/resume?target_role=${encodeURIComponent(role)}&target_company=${encodeURIComponent(company)}`,
        form, { headers: { "Content-Type": "multipart/form-data" } }
      );
      setAnalysis(data.analysis);
    } catch (e:any) { alert(e.response?.data?.detail||"Analysis failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen mesh-bg p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6"><ChevronLeft size={15}/>Back</button>
        <h1 className="text-2xl font-bold mb-1">Resume Reviewer</h1>
        <p className="text-slate-400 text-sm mb-6">AI-powered ATS scoring, gap detection, and rewrite suggestions</p>
        {!analysis ? (
          <div className="space-y-4">
            <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${drag?"border-brand-500 bg-brand-600/5":"border-white/10 hover:border-white/20"}`}>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e=>{if(e.target.files?.[0])handleFile(e.target.files[0]);}}/>
              <Upload className="mx-auto mb-3 text-slate-600" size={28}/>
              {file ? (
                <div><p className="font-medium text-brand-400 flex items-center justify-center gap-2"><FileText size={14}/>{file.name}</p>
                  <p className="text-xs text-slate-600 mt-1">{(file.size/1024).toFixed(0)} KB</p></div>
              ) : (
                <div><p className="text-sm font-medium">Drop your resume here</p><p className="text-xs text-slate-600 mt-1">PDF only · max 5MB</p></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-slate-500 mb-1.5">Target role</label>
                <input value={role} onChange={e=>setRole(e.target.value)} placeholder="Software Engineer" className="input-field"/></div>
              <div><label className="block text-xs text-slate-500 mb-1.5">Company <span className="text-slate-700">(optional)</span></label>
                <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="e.g. Google" className="input-field"/></div>
            </div>
            <button onClick={analyze} disabled={!file||loading} className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
              {loading?<><Loader2 size={15} className="animate-spin"/>Analyzing…</>:"Analyze Resume"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              {[{l:"Overall Score",v:analysis.overall_score,max:100},{l:"ATS Score",v:analysis.ats_score,max:100}].map(s=>(
                <div key={s.l} className="glass rounded-2xl p-5 border border-white/5 text-center">
                  <p className="text-xs text-slate-500 mb-2">{s.l}</p>
                  <div className={`text-4xl font-bold ${s.v>=70?"text-emerald-400":s.v>=50?"text-amber-400":"text-red-400"}`}>{s.v}<span className="text-lg text-slate-600">/{s.max}</span></div>
                  <div className="mt-3 h-1.5 bg-dark-800 rounded-full overflow-hidden"><div className="h-full bg-brand-500 rounded-full score-bar" style={{width:`${s.v}%`}}/></div>
                </div>
              ))}
            </div>
            <div className="glass rounded-xl p-4 border border-white/5">
              <p className="text-xs text-slate-400 font-medium mb-2">Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
            </div>
            {analysis.critical_issues?.length>0 && (
              <div className="glass rounded-xl p-4 border border-red-500/15">
                <p className="text-xs text-red-400 font-medium mb-2 flex items-center gap-1"><AlertTriangle size={12}/>Critical issues</p>
                {analysis.critical_issues.map((i:string,idx:number)=>(
                  <div key={idx} className="flex items-start gap-2 mb-1.5"><span className="text-red-400 text-xs mt-0.5">!</span><p className="text-xs text-slate-300">{i}</p></div>
                ))}
              </div>
            )}
            {analysis.improvements?.length>0 && (
              <div className="glass rounded-xl p-4 border border-white/5">
                <p className="text-xs text-amber-400 font-medium mb-2 flex items-center gap-1"><TrendingUp size={12}/>Improvements</p>
                {analysis.improvements.map((item:any,i:number)=>(
                  <div key={i} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0 border-white/5">
                    <p className="text-xs font-medium text-brand-400">{item.section}</p>
                    <p className="text-xs text-red-300 mt-0.5">Issue: {item.issue}</p>
                    <p className="text-xs text-emerald-300 mt-0.5">→ {item.suggestion}</p>
                  </div>
                ))}
              </div>
            )}
            {analysis.rewritten_summary && (
              <div className="glass rounded-xl p-4 border border-brand-500/15">
                <p className="text-xs text-brand-400 font-medium mb-2 flex items-center gap-1"><Check size={12}/>Improved summary</p>
                <p className="text-xs text-slate-200 italic leading-relaxed">"{analysis.rewritten_summary}"</p>
              </div>
            )}
            {analysis.missing_keywords?.length>0 && (
              <div className="glass rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-400 font-medium mb-2">Missing keywords</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.missing_keywords.map((k:string,i:number)=>(
                    <span key={i} className="text-xs bg-dark-800 border border-white/8 px-2.5 py-1 rounded-full text-slate-400">{k}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={()=>{setAnalysis(null);setFile(null);}} className="flex-1 btn-ghost py-2.5 text-sm">Analyze another</button>
              <button onClick={() => router.push("/interview?type=technical")} className="flex-1 btn-primary py-2.5 text-sm">Practice interview</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
