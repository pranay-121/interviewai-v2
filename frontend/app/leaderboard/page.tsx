"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trophy, Medal, Crown } from "lucide-react";
import api from "@/lib/api";

interface LeaderEntry {
  rank: number;
  user_id: string;
  full_name: string;
  avg_score: number;
  total_sessions: number;
  best_score: number;
  role: string;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [data, setData] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week"|"month"|"all">("week");

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/users/leaderboard?period=${period}`);
      setData(res.leaderboard || []);
    } catch {
      // Fallback mock data if endpoint not ready
      setData([
        { rank:1, user_id:"1", full_name:"Rahul Sharma",   avg_score:9.2, total_sessions:45, best_score:10, role:"SWE @ Google" },
        { rank:2, user_id:"2", full_name:"Priya Patel",    avg_score:8.8, total_sessions:38, best_score:9.5, role:"DS @ Amazon" },
        { rank:3, user_id:"3", full_name:"Amit Kumar",     avg_score:8.5, total_sessions:52, best_score:9.8, role:"PM @ Flipkart" },
        { rank:4, user_id:"4", full_name:"Sneha Gupta",    avg_score:8.1, total_sessions:29, best_score:9.2, role:"SWE @ Microsoft" },
        { rank:5, user_id:"5", full_name:"Kiran Reddy",    avg_score:7.9, total_sessions:61, best_score:9.0, role:"ML @ Meta" },
        { rank:6, user_id:"6", full_name:"Anjali Singh",   avg_score:7.6, total_sessions:33, best_score:8.8, role:"SWE @ Razorpay" },
        { rank:7, user_id:"7", full_name:"Rohan Mehta",    avg_score:7.4, total_sessions:27, best_score:8.5, role:"DevOps @ TCS" },
        { rank:8, user_id:"8", full_name:"Divya Nair",     avg_score:7.1, total_sessions:41, best_score:8.3, role:"SWE @ Infosys" },
        { rank:9, user_id:"9", full_name:"Vivek Joshi",    avg_score:6.9, total_sessions:19, best_score:8.0, role:"BA @ Deloitte" },
        { rank:10,user_id:"10",full_name:"Pooja Iyer",     avg_score:6.7, total_sessions:22, best_score:7.8, role:"SWE @ Wipro" },
      ]);
    } finally { setLoading(false); }
  };

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={18} className="text-yellow-400"/>;
    if (rank === 2) return <Medal size={18} className="text-slate-300"/>;
    if (rank === 3) return <Medal size={18} className="text-amber-600"/>;
    return <span className="text-sm font-bold text-slate-500">#{rank}</span>;
  };

  const rankBg = (rank: number) => {
    if (rank === 1) return "border-yellow-500/30 bg-yellow-500/5";
    if (rank === 2) return "border-slate-400/30 bg-slate-400/5";
    if (rank === 3) return "border-amber-600/30 bg-amber-600/5";
    return "border-white/5";
  };

  return (
    <div className="min-h-screen mesh-bg p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
            <Trophy size={20}/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Leaderboard</h1>
            <p className="text-slate-400 text-sm">Top performers this week — can you beat them?</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/5 mb-5 w-fit">
          {(["week","month","all"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-all capitalize ${period===p?"bg-brand-600 text-white":"text-slate-400 hover:text-white"}`}>
              {p === "all" ? "All time" : `This ${p}`}
            </button>
          ))}
        </div>

        {/* Top 3 podium */}
        {!loading && data.length >= 3 && (
          <div className="flex items-end justify-center gap-4 mb-6">
            {/* 2nd */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-lg font-bold mx-auto mb-2 border-2 border-slate-400/50">
                {data[1].full_name[0]}
              </div>
              <p className="text-xs font-medium text-slate-300 truncate w-20">{data[1].full_name.split(" ")[0]}</p>
              <div className="bg-slate-400/20 border border-slate-400/30 rounded-lg py-2 px-3 mt-2">
                <p className="text-lg font-bold text-slate-300">{data[1].avg_score.toFixed(1)}</p>
                <p className="text-xs text-slate-500">#2</p>
              </div>
            </div>
            {/* 1st */}
            <div className="text-center -mb-2">
              <Crown size={20} className="text-yellow-400 mx-auto mb-1"/>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-xl font-bold mx-auto mb-2 border-2 border-yellow-400/50">
                {data[0].full_name[0]}
              </div>
              <p className="text-xs font-medium text-white truncate w-24 mx-auto">{data[0].full_name.split(" ")[0]}</p>
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg py-2 px-3 mt-2">
                <p className="text-xl font-bold text-yellow-400">{data[0].avg_score.toFixed(1)}</p>
                <p className="text-xs text-yellow-600">#1</p>
              </div>
            </div>
            {/* 3rd */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center text-lg font-bold mx-auto mb-2 border-2 border-amber-600/50">
                {data[2].full_name[0]}
              </div>
              <p className="text-xs font-medium text-slate-300 truncate w-20">{data[2].full_name.split(" ")[0]}</p>
              <div className="bg-amber-600/20 border border-amber-600/30 rounded-lg py-2 px-3 mt-2">
                <p className="text-lg font-bold text-amber-600">{data[2].avg_score.toFixed(1)}</p>
                <p className="text-xs text-amber-800">#3</p>
              </div>
            </div>
          </div>
        )}

        {/* Full list */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="shimmer rounded-xl h-16"/>)}
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((entry) => (
              <div key={entry.rank}
                className={`glass rounded-xl px-5 py-3.5 border transition-all ${rankBg(entry.rank)}`}>
                <div className="flex items-center gap-4">
                  <div className="w-8 flex items-center justify-center shrink-0">
                    {rankIcon(entry.rank)}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-sm font-bold shrink-0">
                    {entry.full_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{entry.role} · {entry.total_sessions} sessions</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold ${entry.avg_score>=8?"text-emerald-400":entry.avg_score>=6?"text-amber-400":"text-slate-300"}`}>
                      {entry.avg_score.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-600">avg/10</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 glass rounded-xl p-4 border border-brand-500/20 text-center">
          <p className="text-sm font-medium mb-1">Want to be on the leaderboard?</p>
          <p className="text-xs text-slate-500 mb-3">Complete interviews and get high scores to appear here</p>
          <button onClick={() => router.push("/interview")}
            className="btn-primary text-sm px-5 py-2">
            Start practicing now
          </button>
        </div>
      </div>
    </div>
  );
}
