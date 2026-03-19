"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Loader2, Mail, Lock } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";

declare global {
  interface Window {
    google: any;
    handleGoogleCredential: (response: any) => void;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, user } = useAuthStore();

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

  // Redirect if already logged in
  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user]);

  // Load Google Identity Services
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    window.handleGoogleCredential = async (response: any) => {
      setGoogleLoading(true);
      setError("");
      try {
        const { data } = await api.post("/auth/google", { id_token: response.credential });
        setAuth(data.access_token, data.refresh_token, {
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
        });
        router.push("/dashboard");
      } catch (e: any) {
        setError(e.response?.data?.detail || "Google login failed. Please try again.");
      } finally { setGoogleLoading(false); }
    };

    if (!document.getElementById("google-gsi")) {
      const script = document.createElement("script");
      script.id = "google-gsi";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: window.handleGoogleCredential,
            auto_select: false,
          });
          window.google.accounts.id.renderButton(
            document.getElementById("google-btn"),
            { theme:"filled_black", size:"large", width:360, text:"signin_with", shape:"rectangular" }
          );
        }
      };
      document.head.appendChild(script);
    } else if (window.google) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: window.handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-btn"),
        { theme:"filled_black", size:"large", width:360, text:"signin_with", shape:"rectangular" }
      );
    }
  }, [mode]);

  // Email/password login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter email and password."); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAuth(data.access_token, data.refresh_token, {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
      });
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Login failed. Please check your credentials.");
    } finally { setLoading(false); }
  };

  // Forgot password
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) { setError("Please enter your email."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email: resetEmail });
      setResetToken(data.reset_token || "");
      setSuccess(`Reset link generated! ${data.note}`);
      if (data.reset_token) setMode("reset");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed. Please check the email address.");
    } finally { setLoading(false); }
  };

  // Reset password
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPwd || !confirmPwd) { setError("Please fill all fields."); return; }
    if (newPwd !== confirmPwd) { setError("Passwords do not match."); return; }
    if (newPwd.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      await api.post("/auth/reset-password", { token: resetToken, new_password: newPwd });
      setSuccess("Password reset successfully! You can now login.");
      setMode("login");
      setNewPwd(""); setConfirmPwd(""); setResetToken("");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Reset failed. Token may have expired.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-lg font-bold mx-auto mb-3">AI</div>
          <h1 className="text-2xl font-bold">InterviewAI</h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === "login" ? "Sign in to your account"
            : mode === "forgot" ? "Reset your password"
            : "Set new password"}
          </p>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            <AlertCircle size={15} className="shrink-0 mt-0.5"/>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm mb-4">
            {success}
          </div>
        )}

        <div className="glass rounded-2xl p-6 border border-white/5">

          {/* ── LOGIN FORM ── */}
          {mode === "login" && (
            <>
              {/* Google Login */}
              <div className="mb-5">
                {googleLoading ? (
                  <div className="flex items-center justify-center gap-2 w-full py-3 glass border border-white/10 rounded-xl text-sm text-slate-400">
                    <Loader2 size={15} className="animate-spin"/>Signing in with Google…
                  </div>
                ) : (
                  <div id="google-btn" className="flex justify-center min-h-[44px]">
                    {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                      <div className="w-full flex items-center justify-center gap-3 glass border border-white/10 rounded-xl py-3 text-sm text-slate-400 cursor-not-allowed">
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Sign in with Google (add NEXT_PUBLIC_GOOGLE_CLIENT_ID)
                      </div>
                    )}
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
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                    Forgot password?
                  </button>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <><Loader2 size={15} className="animate-spin"/>Signing in…</> : "Sign In"}
                </button>
              </form>

              <p className="text-center text-xs text-slate-500 mt-4">
                Don't have an account?{" "}
                <button onClick={() => router.push("/register")}
                  className="text-brand-400 hover:text-brand-300 font-medium">
                  Create account
                </button>
              </p>
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {mode === "forgot" && (
            <>
              <p className="text-xs text-slate-400 mb-4">
                Enter your registered email address and we'll generate a password reset link.
              </p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                      placeholder="pranay@example.com" autoComplete="email"
                      className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <><Loader2 size={15} className="animate-spin"/>Sending…</> : "Generate Reset Link"}
                </button>
              </form>
              <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 mt-4">
                ← Back to login
              </button>
            </>
          )}

          {/* ── RESET PASSWORD ── */}
          {mode === "reset" && (
            <>
              <p className="text-xs text-slate-400 mb-4">
                Enter your new password. Token expires in 15 minutes.
              </p>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Reset token</label>
                  <input value={resetToken} onChange={e => setResetToken(e.target.value)}
                    placeholder="Paste token here"
                    className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500/50 font-mono"/>
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
