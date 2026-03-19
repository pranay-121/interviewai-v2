"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import api from "@/lib/api";

function ResetInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [token, setToken] = useState(sp.get("token") || "");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setError("Passwords do not match."); return; }
    if (newPwd.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/reset-password", { token, new_password: newPwd });
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Reset failed. Token may have expired.");
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="min-h-screen mesh-bg flex items-center justify-center">
      <div className="text-center">
        <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4"/>
        <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
        <p className="text-slate-400 text-sm">Redirecting to login in 3 seconds…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-lg font-bold mx-auto mb-3">AI</div>
          <h1 className="text-xl font-bold">Set New Password</h1>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>
        )}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <form onSubmit={handleReset} className="space-y-4">
            {!sp.get("token") && (
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Reset Token</label>
                <input value={token} onChange={e => setToken(e.target.value)}
                  placeholder="Paste your reset token"
                  className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"/>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">New Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                <input type={showPwd?"text":"password"} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-10 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
                  {showPwd?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                <input type={showPwd?"text":"password"} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
              </div>
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>
            <button type="submit" disabled={loading || (!!confirmPwd && newPwd !== confirmPwd)}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><Loader2 size={15} className="animate-spin"/>Resetting…</> : "Reset Password"}
            </button>
          </form>
          <button onClick={() => router.push("/login")}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300 mt-4">
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-screen mesh-bg flex items-center justify-center text-slate-400">Loading…</div>}>
    <ResetInner/>
  </Suspense>;
}
