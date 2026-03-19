"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Loader2, Mail, Lock } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";

declare global {
  interface Window { google: any; handleGoogleCredential: (r: any) => void; }
}

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"login"|"forgot"|"reset">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  useEffect(() => { if (user) router.push("/dashboard"); }, [user]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    window.handleGoogleCredential = async (response: any) => {
      setGoogleLoading(true);
      setError("");
      try {
        const { data } = await api.post("/auth/google", { id_token: response.credential });
        setTokens(data.access_token, data.refresh_token, data.user_id, data.email, data.full_name);
        router.push("/dashboard");
      } catch (e: any) {
        setError(e.response?.data?.detail || "Google login failed.");
      } finally { setGoogleLoading(false); }
    };
    const loadGoogle = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: window.handleGoogleCredential });
      const btn = document.getElementById("google-btn");
      if (btn) window.google.accounts.id.renderButton(btn, { theme: "filled_black", size: "large", width: 360 });
    };
    if (!document.getElementById("google-gsi")) {
      const s = document.createElement("script");
      s.id = "google-gsi"; s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true; s.onload = loadGoogle;
      document.head.appendChild(s);
    } else { loadGoogle(); }
  }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter email and password."); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setTokens(data.access_token, data.refresh_token, data.user_id, data.email, data.full_name);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Login failed.");
    } finally { setLoading(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) { setError("Please enter your email."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email: resetEmail });
      setResetToken(data.reset_token || "");
      setSuccess(data.note || "Reset token generated!");
      if (data.reset_token) setMode("reset");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Email not found.");
    } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setError("Passwords do not match."); return; }
    if (newPwd.length < 6) { setError("Min 6 characters."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      await api.post("/auth/reset-password", { token: resetToken, new_password: newPwd });
      setSuccess("Password reset! You can now login.");
      setMode("login"); setNewPwd(""); setConfirmPwd(""); setResetToken("");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Reset failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-lg font-bold mx-auto mb-3">AI</div>
          <h1 className="text-2xl font-bold">InterviewAI</h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === "login" ? "Sign in to your account" : mode === "forgot" ? "Reset your password" : "Set new password"}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            <AlertCircle size={15} className="shrink-0 mt-0.5"/><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm mb-4">{success}</div>
        )}

        <div className="glass rounded-2xl p-6 border border-white/5">

          {mode === "login" && (
            <>
              <div className="mb-5">
                {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
                  googleLoading ? (
                    <div className="flex items-center justify-center gap-2 w-full py-3 glass border border-white/10 rounded-xl text-sm text-slate-400">
                      <Loader2 size={15} className="animate-spin"/>Signing in with Google…
                    </div>
                  ) : (
                    <div id="google-btn" className="flex justify-center min-h-[44px]"/>
                  )
                ) : (
                  <div className="w-full flex items-center justify-center gap-3 glass border border-dashed border-white/10 rounded-xl py-3 text-xs text-slate-600">
                    Google login: add NEXT_PUBLIC_GOOGLE_CLIENT_ID to Vercel env
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/8"/>
                <span className="text-xs text-slate-600">or continue with email</span>
                <div className="flex-1 h-px bg-white/8"/>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="pranay@example.com" autoComplete="email"
                      className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password"
                      className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-10 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                      {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                    className="text-xs text-brand-400 hover:text-brand-300">Forgot password?</button>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <><Loader2 size={15} className="animate-spin"/>Signing in…</> : "Sign In"}
                </button>
              </form>
              <p className="text-center text-xs text-slate-500 mt-4">
                Don't have an account?{" "}
                <button onClick={() => router.push("/register")} className="text-brand-400 hover:text-brand-300 font-medium">
                  Create account
                </button>
              </p>
            </>
          )}

          {mode === "forgot" && (
            <>
              <p className="text-xs text-slate-400 mb-4">Enter your registered email to get a password reset token.</p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                      placeholder="pranay@example.com"
                      className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <><Loader2 size={15} className="animate-spin"/>Sending…</> : "Generate Reset Token"}
                </button>
              </form>
              <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 mt-4">
                ← Back to login
              </button>
            </>
          )}

          {mode === "reset" && (
            <>
              <p className="text-xs text-slate-400 mb-4">Enter the reset token and your new password. Expires in 15 min.</p>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Reset token</label>
                  <input value={resetToken} onChange={e => setResetToken(e.target.value)}
                    placeholder="Paste token here"
                    className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"/>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">New password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input type={showPwd ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-10 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
                      {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Confirm new password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input type={showPwd ? "text" : "password"} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
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
              <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 mt-4">
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
