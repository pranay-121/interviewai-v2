"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, Star, Loader2 } from "lucide-react";
import api from "@/lib/api";

const LOGOS: Record<string,string> = { Google:"🔵",Amazon:"🟠",Microsoft:"🔷",Meta:"🟣",Apple:"⚫",Netflix:"🔴",Uber:"⬛",Airbnb:"🔶",Stripe:"🟤",Salesforce:"☁️" };

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string|null>(null);
  const [guide, setGuide] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/companies").then(({data})=>setCompanies(data.companies)); }, []);

  const select = async (name: string) => {
    setSelected(name); setLoading(true); setGuide(null);
    try { const {data} = await api.get(`/companies/${encodeURIComponent(name)}/prep`); setGuide(data); }
    finally { setLoading(false); }
  };

  const filtered = companies.filter(c => c.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen mesh-bg p-8">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6"><ChevronLeft size={15}/>Back</button>
        <h1 className="text-2xl font-bold mb-1">Company Prep Guides</h1>
        <p className="text-slate-400 text-sm mb-6">Tailored interview guidance for top companies</p>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" className="input-field pl-9 py-2 text-sm"/>
            </div>
            <div className="space-y-1">
              {filtered.map(c => (
                <button key={c} onClick={() => select(c)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all ${selected===c?"bg-brand-600/15 border border-brand-500/30 text-white":"glass border border-white/5 text-slate-300 hover:border-white/10"}`}>
                  <div className="flex items-center gap-2"><span>{LOGOS[c]||"🏢"}</span><span className="font-medium">{c}</span></div>
                  <ChevronRight size={13} className="text-slate-600"/>
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            {!selected ? (
              <div className="glass rounded-2xl p-12 border border-dashed border-white/8 text-center h-full flex flex-col items-center justify-center">
                <div className="text-4xl mb-3">🏢</div>
                <p className="font-medium text-sm">Select a company</p>
                <p className="text-slate-500 text-xs mt-1">Get tailored prep for your target company</p>
              </div>
            ) : loading ? (
              <div className="glass rounded-2xl border border-white/5 h-64 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-brand-400"/>
              </div>
            ) : guide ? (
              <div className="space-y-4 animate-fade-in">
                <div className="glass rounded-2xl p-5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><span className="text-3xl">{LOGOS[selected]||"🏢"}</span><h2 className="text-xl font-bold">{selected}</h2></div>
                    {guide.difficulty_rating && (
                      <div className="text-right"><p className="text-xs text-slate-600 mb-0.5">Difficulty</p>
                        <p className={`font-bold text-sm ${guide.difficulty_rating>=8.5?"text-red-400":guide.difficulty_rating>=7?"text-amber-400":"text-emerald-400"}`}>{guide.difficulty_rating}/10</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="glass rounded-xl p-5 border border-white/5">
                  <p className="text-xs font-medium text-slate-300 mb-3">Interview rounds</p>
                  <div className="space-y-2">
                    {(guide.interview_rounds||[]).map((r:any,i:number)=>(
                      <div key={i} className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-brand-600/20 border border-brand-500/30 text-brand-400 text-xs flex items-center justify-center shrink-0 mt-0.5">{i+1}</div>
                        <div><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.description}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass rounded-xl p-5 border border-white/5">
                  <p className="text-xs font-medium text-slate-300 mb-2">Common topics</p>
                  <div className="flex flex-wrap gap-2">
                    {(guide.common_topics||[]).map((t:string,i:number)=>(
                      <span key={i} className="text-xs bg-brand-600/10 border border-brand-500/20 text-brand-300 px-3 py-1 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="glass rounded-xl p-5 border border-white/5">
                  <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1"><Star size={11}/>Pro tips</p>
                  {(guide.tips||[]).map((t:string,i:number)=>(
                    <div key={i} className="flex items-start gap-2 mb-1.5 last:mb-0">
                      <span className="text-amber-400 text-xs mt-0.5 shrink-0">→</span>
                      <p className="text-xs text-slate-300">{t}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push(`/interview?company=${encodeURIComponent(selected)}`)}
                  className="btn-primary w-full py-3 text-sm">Start {selected} mock interview →</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
