"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";

const AGENT_META: Record<string, { icon: string; color: string }> = {
  hr: { icon:"🎯", color:"from-violet-600 to-purple-600" },
  technical: { icon:"⚙️", color:"from-blue-600 to-cyan-500" },
  coding: { icon:"💻", color:"from-emerald-600 to-teal-500" },
  system_design: { icon:"🏗️", color:"from-orange-600 to-amber-500" },
};

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PS = 15;

  useEffect(() => {
    api.get(`/interviews/history?limit=${PS}&offset=${page*PS}`)
      .then(({ data }) => setSessions(data))
      .finally(() => setLoading(false));
  }, [page]);

  const completed = sessions.filter(s => s.status === "completed");
  const avg = completed.length ? (completed.reduce((a,s)=>a+(s.overall_score||0),0)/completed.length).toFixed(1) : null;

  return (
    <div className="min-h-screen mesh-bg p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6"><ChevronLeft size={15}/>Back</button>
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold">Interview History</h1><p className="text-slate-400 text-sm mt-0.5">All your past sessions</p></div>
          <div className="flex gap-3">
            <div className="glass rounded-xl px-5 py-3 border border-white/5 text-center">
              <p className="text-xl font-bold">{sessions.length}</p><p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="glass rounded-xl px-5 py-3 border border-white/5 text-center">
              <p className={`text-xl font-bold ${avg?(Number(avg)>=7?"text-emerald-400":"text-amber-400"):"text-slate-400"}`}>{avg??"—"}</p>
              <p className="text-xs text-slate-500">Avg</p>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="shimmer rounded-xl h-16"/>)}</div>
        ) : sessions.length === 0 ? (
          <div className="glass rounded-2xl p-14 border border-dashed border-white/8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium mb-1">No interviews yet</p>
            <button onClick={() => router.push("/interview")} className="btn-primary text-xs px-4 py-2 mt-3 inline-flex">Start first interview</button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {sessions.map(s => {
                const meta = AGENT_META[s.agent_type] || { icon:"📋", color:"from-slate-600 to-slate-700" };
                return (
                  <div key={s.id} className="flex items-center justify-between glass rounded-xl px-5 py-4 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center text-sm shrink-0`}>{meta.icon}</div>
                      <div>
                        <p className="text-sm font-medium">{s.job_role}{s.company?<span className="text-slate-500"> @ {s.company}</span>:null}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.agent_type.replace("_"," ")} · {new Date(s.started_at).toLocaleDateString()} · {s.answered_questions}/{s.total_questions} Qs</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.overall_score != null && (
                        <span className={`font-bold text-sm ${s.overall_score>=7?"text-emerald-400":s.overall_score>=5?"text-amber-400":"text-red-400"}`}>{s.overall_score.toFixed(1)}/10</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status==="completed"?"bg-emerald-500/10 text-emerald-400":s.status==="in_progress"?"bg-brand-500/10 text-brand-400":"bg-dark-800 text-slate-500"}`}>{s.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-5">
              <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
                className="btn-ghost px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40"><ChevronLeft size={14}/>Prev</button>
              <span className="text-xs text-slate-500">Page {page+1}</span>
              <button onClick={()=>setPage(p=>p+1)} disabled={sessions.length<PS}
                className="btn-ghost px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40">Next<ChevronRight size={14}/></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
