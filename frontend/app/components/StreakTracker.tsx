"use client";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

export default function StreakTracker() {
  const [streak, setStreak] = useState(0);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem("interviewai_streak");
    if (!stored) {
      localStorage.setItem("interviewai_streak", JSON.stringify({ count: 1, lastDate: today }));
      setStreak(1);
      setIsNew(true);
      return;
    }
    const { count, lastDate } = JSON.parse(stored);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastDate === today) {
      setStreak(count);
    } else if (lastDate === yesterday.toDateString()) {
      const newCount = count + 1;
      localStorage.setItem("interviewai_streak", JSON.stringify({ count: newCount, lastDate: today }));
      setStreak(newCount);
      setIsNew(true);
    } else {
      localStorage.setItem("interviewai_streak", JSON.stringify({ count: 1, lastDate: today }));
      setStreak(1);
    }
  }, []);

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isNew ? "bg-orange-500/20 border border-orange-500/30 text-orange-400 animate-pulse" : "glass border border-white/10 text-slate-400"}`}>
      <Flame size={14} className={streak >= 7 ? "text-orange-400" : "text-slate-500"}/>
      <span>{streak} day{streak !== 1 ? "s" : ""} streak</span>
      {streak >= 7 && <span>🔥</span>}
    </div>
  );
}

export function recordPracticeDay() {
  const today = new Date().toDateString();
  const stored = localStorage.getItem("interviewai_streak");
  if (!stored) {
    localStorage.setItem("interviewai_streak", JSON.stringify({ count: 1, lastDate: today }));
    return;
  }
  const { count, lastDate } = JSON.parse(stored);
  if (lastDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const newCount = lastDate === yesterday.toDateString() ? count + 1 : 1;
  localStorage.setItem("interviewai_streak", JSON.stringify({ count: newCount, lastDate: today }));
}
