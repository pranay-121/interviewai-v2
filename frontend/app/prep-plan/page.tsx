"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Lock, Play, Calendar } from "lucide-react";

const PLANS: Record<string, any> = {
  google_swe: {
    title: "Google SWE in 30 Days",
    company: "Google",
    role: "Software Engineer",
    description: "Structured 30-day plan to crack Google SWE interviews",
    weeks: [
      {
        week: 1, title: "Data Structures Foundation",
        days: [
          { day:1,  topic:"Arrays & Strings",       type:"coding",    q:5, desc:"Two pointers, sliding window, subarrays" },
          { day:2,  topic:"Hash Maps & Sets",        type:"coding",    q:5, desc:"Frequency counting, grouping, lookup" },
          { day:3,  topic:"Linked Lists",            type:"coding",    q:4, desc:"Reversal, cycle detection, merge" },
          { day:4,  topic:"Stacks & Queues",         type:"coding",    q:4, desc:"Monotonic stack, BFS, valid parentheses" },
          { day:5,  topic:"Binary Search",           type:"coding",    q:5, desc:"Search space, rotated arrays, boundaries" },
          { day:6,  topic:"Mock Interview #1",       type:"technical", q:8, desc:"Mixed DS questions — timed session" },
          { day:7,  topic:"Rest & Review",           type:"hr",        q:3, desc:"Behavioral questions — Tell me about yourself" },
        ]
      },
      {
        week: 2, title: "Trees & Graphs",
        days: [
          { day:8,  topic:"Binary Trees",            type:"coding",    q:5, desc:"Traversals, height, diameter, LCA" },
          { day:9,  topic:"Binary Search Trees",     type:"coding",    q:4, desc:"Insert, delete, validate, kth element" },
          { day:10, topic:"Graph BFS/DFS",           type:"coding",    q:5, desc:"Connected components, shortest path" },
          { day:11, topic:"Graph Advanced",          type:"coding",    q:4, desc:"Topological sort, cycle detection" },
          { day:12, topic:"Heaps & Priority Queues", type:"coding",    q:4, desc:"Top K, merge K lists, median stream" },
          { day:13, topic:"Mock Interview #2",       type:"technical", q:8, desc:"Tree/graph mixed — Google style" },
          { day:14, topic:"System Design Intro",     type:"system_design", q:3, desc:"URL shortener, key-value store basics" },
        ]
      },
      {
        week: 3, title: "Dynamic Programming & Advanced",
        days: [
          { day:15, topic:"DP Fundamentals",         type:"coding",    q:4, desc:"Memoization, tabulation, common patterns" },
          { day:16, topic:"DP on Strings",           type:"coding",    q:4, desc:"LCS, LPS, edit distance, regex" },
          { day:17, topic:"DP on Arrays",            type:"coding",    q:5, desc:"Kadane, jump game, coin change" },
          { day:18, topic:"Backtracking",            type:"coding",    q:4, desc:"Permutations, N-queens, Sudoku" },
          { day:19, topic:"Tries & Advanced DS",     type:"coding",    q:3, desc:"Prefix search, word search, autocomplete" },
          { day:20, topic:"Mock Interview #3",       type:"technical", q:10,desc:"Full Google-style technical round" },
          { day:21, topic:"System Design Deep Dive", type:"system_design", q:3, desc:"Design Google Search, YouTube" },
        ]
      },
      {
        week: 4, title: "Full Mock & Behavioral",
        days: [
          { day:22, topic:"Google-specific Patterns",type:"coding",    q:6, desc:"Bit manipulation, math, greedy" },
          { day:23, topic:"Behavioral Round Prep",   type:"hr",        q:8, desc:"STAR method — leadership, conflict, impact" },
          { day:24, topic:"System Design Practice",  type:"system_design", q:2, desc:"Design Gmail, Maps, Drive" },
          { day:25, topic:"Mock Interview #4 (Full)",type:"technical", q:10,desc:"Full loop simulation — coding + design" },
          { day:26, topic:"Weak Areas Review",       type:"coding",    q:5, desc:"Revisit your lowest scoring topics" },
          { day:27, topic:"Final Behavioral",        type:"hr",        q:6, desc:"Why Google? Culture fit questions" },
          { day:28, topic:"Mock Interview #5 (Final)",type:"technical",q:10,desc:"Final full interview simulation" },
        ]
      },
    ]
  },
  amazon_sde: {
    title: "Amazon SDE in 30 Days",
    company: "Amazon",
    role: "Software Engineer",
    description: "LP-focused 30-day plan to crack Amazon SDE interviews",
    weeks: [
      {
        week: 1, title: "LP + DS Basics",
        days: [
          { day:1,  topic:"Amazon Leadership Principles", type:"hr",    q:5, desc:"All 16 LPs — STAR stories" },
          { day:2,  topic:"Arrays & Two Pointers",        type:"coding", q:5, desc:"Container water, trapping rain, 3sum" },
          { day:3,  topic:"LP: Customer Obsession",       type:"hr",    q:4, desc:"Tell me about a time you went above and beyond" },
          { day:4,  topic:"Hash Maps & Frequency",        type:"coding", q:5, desc:"Anagrams, subarray sum, top K frequent" },
          { day:5,  topic:"LP: Ownership & Bias for Action",type:"hr",  q:4, desc:"Bias for action examples from work" },
          { day:6,  topic:"Mock Interview #1 (LP)",       type:"hr",    q:8, desc:"Full behavioral round — Amazon style" },
          { day:7,  topic:"Binary Search",                type:"coding", q:4, desc:"Amazon loves binary search problems" },
        ]
      },
      {
        week: 2, title: "Trees & Advanced LP",
        days: [
          { day:8,  topic:"Trees & Recursion",            type:"coding", q:5, desc:"Amazon tree problems — LCA, paths" },
          { day:9,  topic:"LP: Think Big & Invent",       type:"hr",    q:4, desc:"Innovation and risk-taking stories" },
          { day:10, topic:"Graphs & BFS",                 type:"coding", q:4, desc:"Word ladder, course schedule" },
          { day:11, topic:"LP: Dive Deep & Deliver",      type:"hr",    q:4, desc:"Metrics, data-driven decisions" },
          { day:12, topic:"Dynamic Programming",          type:"coding", q:5, desc:"Coin change, word break, LIS" },
          { day:13, topic:"Mock Interview #2 (Mixed)",    type:"technical",q:8,desc:"Coding + LP combined round" },
          { day:14, topic:"System Design: Amazon Scale",  type:"system_design",q:2,desc:"Design Amazon cart, Prime Video" },
        ]
      },
      {
        week: 3, title: "Advanced DS + Design",
        days: [
          { day:15, topic:"Heaps & Sorting",              type:"coding", q:5, desc:"Merge K lists, find median" },
          { day:16, topic:"System Design: Distributed",   type:"system_design",q:2,desc:"Design DynamoDB, SQS" },
          { day:17, topic:"Backtracking & Greedy",        type:"coding", q:4, desc:"Activity selection, jump game" },
          { day:18, topic:"LP: Earn Trust & Frugality",   type:"hr",    q:4, desc:"Trust building and doing more with less" },
          { day:19, topic:"Sliding Window & Strings",     type:"coding", q:4, desc:"Minimum window substring, permutations" },
          { day:20, topic:"Mock Interview #3 (Full)",     type:"technical",q:10,desc:"Full Amazon loop simulation" },
          { day:21, topic:"Review & Weak Areas",          type:"coding", q:5, desc:"Redo your lowest scoring problems" },
        ]
      },
      {
        week: 4, title: "Final Preparation",
        days: [
          { day:22, topic:"All LP Stories Review",        type:"hr",    q:8, desc:"Polish all 16 LP STAR stories" },
          { day:23, topic:"Advanced Graph Problems",      type:"coding", q:5, desc:"Dijkstra, MST, union find" },
          { day:24, topic:"System Design: Full Practice", type:"system_design",q:3,desc:"Design S3, EC2 autoscaling" },
          { day:25, topic:"Mock Interview #4 (Full Loop)",type:"technical",q:10,desc:"4-hour full loop simulation" },
          { day:26, topic:"Bar Raiser Prep",              type:"hr",    q:6, desc:"Bar raiser specific LP questions" },
          { day:27, topic:"Final Coding Review",          type:"coding", q:5, desc:"Your weakest topics" },
          { day:28, topic:"Mock Interview #5 (Final)",    type:"technical",q:10,desc:"Final full interview simulation" },
        ]
      }
    ]
  }
};

const TYPE_COLORS: Record<string,string> = {
  coding: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  hr: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  technical: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  system_design: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function PrepPlanPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [completedDays, setCompletedDays] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    const stored = localStorage.getItem("prep_plan_completed");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const toggleDay = (day: number) => {
    const newSet = new Set(completedDays);
    if (newSet.has(day)) newSet.delete(day);
    else newSet.add(day);
    setCompletedDays(newSet);
    localStorage.setItem("prep_plan_completed", JSON.stringify([...newSet]));
  };

  const plan = selectedPlan ? PLANS[selectedPlan] : null;
  const totalDays = plan ? plan.weeks.reduce((s: number, w: any) => s + w.days.length, 0) : 0;
  const completedCount = plan
    ? plan.weeks.flatMap((w: any) => w.days).filter((d: any) => completedDays.has(d.day)).length
    : 0;

  if (!selectedPlan) return (
    <div className="min-h-screen mesh-bg p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
            <Calendar size={20}/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">30-Day Prep Plans</h1>
            <p className="text-slate-400 text-sm">Structured interview preparation for top companies</p>
          </div>
        </div>
        <div className="grid gap-4">
          {Object.entries(PLANS).map(([key, p]) => (
            <button key={key} onClick={() => { setSelectedPlan(key); setCompletedDays(new Set()); }}
              className="glass rounded-2xl p-5 border border-white/5 hover:border-brand-500/30 transition-all text-left group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-base mb-1">{p.title}</p>
                  <p className="text-sm text-slate-400 mb-3">{p.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-brand-600/15 text-brand-400 px-2 py-0.5 rounded-full border border-brand-500/20">
                      {p.company}
                    </span>
                    <span className="text-xs text-slate-600">28 days · 4 weeks</span>
                  </div>
                </div>
                <div className="btn-primary text-xs px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 ml-3">
                  <Play size={11}/>Start
                </div>
              </div>
            </button>
          ))}
          <div className="glass rounded-2xl p-5 border border-dashed border-white/8 text-center">
            <p className="text-sm text-slate-500 mb-1">More plans coming soon</p>
            <p className="text-xs text-slate-600">Microsoft, Meta, Flipkart, Goldman Sachs…</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen mesh-bg p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setSelectedPlan(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back to plans
        </button>

        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold mb-1">{plan.title}</h1>
            <p className="text-slate-400 text-sm">{plan.description}</p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-2xl font-bold gradient-text">{completedCount}/{totalDays}</p>
            <p className="text-xs text-slate-500">days done</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-dark-800 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all"
            style={{ width: `${(completedCount / totalDays) * 100}%` }}/>
        </div>

        {/* Weeks */}
        <div className="space-y-6">
          {plan.weeks.map((week: any) => (
            <div key={week.week}>
              <h2 className="font-semibold text-sm text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-xs text-brand-400 font-bold">
                  {week.week}
                </span>
                Week {week.week}: {week.title}
              </h2>
              <div className="space-y-2">
                {week.days.map((day: any) => {
                  const done = completedDays.has(day.day);
                  return (
                    <div key={day.day}
                      className={`glass rounded-xl border transition-all ${done ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/5"}`}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button onClick={() => toggleDay(day.day)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${done ? "bg-emerald-500 border-emerald-500" : "border-white/20 hover:border-brand-500"}`}>
                          {done && <Check size={12} className="text-white"/>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs text-slate-600">Day {day.day}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${TYPE_COLORS[day.type]}`}>
                              {day.type.replace("_"," ")}
                            </span>
                          </div>
                          <p className={`text-sm font-medium ${done ? "text-slate-500 line-through" : "text-white"}`}>
                            {day.topic}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">{day.desc}</p>
                        </div>
                        <button
                          onClick={() => router.push(`/interview?type=${day.type}`)}
                          className="shrink-0 flex items-center gap-1 text-xs bg-brand-600/20 text-brand-400 border border-brand-500/25 px-2.5 py-1.5 rounded-lg hover:bg-brand-600/30 transition-colors">
                          <Play size={10}/>{day.q}Q
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
