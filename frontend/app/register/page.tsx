"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Loader2, Mail, Lock, User } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";

declare global {
  interface Window { google: any; }
}

export default function RegisterPage() {
  const router = useRouter();
  const { setTokens, user } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const googleInitialized = useRef(false);

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user]);

  useEffect(() => {
    if (googleInitialized.current) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const handleCredential = async (response: any) => {
      setGoogleLoading(true);
      setError("");
      try {
        const { data } = await api.post("/auth/google", { id_token: response.credential });
        setTokens(data.access_token, data.refresh_token, data.user_id, data.email, data.full_name);
        router.push("/dashboard");
      } catch (e: any) {
        setError(e.response?.data?.detail || "Google sign up failed.");
      } finally {
        setGoogleLoading(false);
      }
    };

    const init = () => {
      if (googleInitialized.current) return;
      if (!window.google?.accounts?.id) return;
      googleInitialized.current = true;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
      });
      const btn = document.getElementById("google-register-btn");
      if (btn) {
        btn.innerHTML = "";
        window.google.accounts.id.renderButton(btn, {
          theme: "filled_black",
          size: "large",
          width: 340,
          text: "signup_with",
        });
      }
    };

    if (window.google?.accounts?.id) {
      init();
    } else if (!document.getElementById("gsi-script")) {
      const s = document.createElement("script");
      s.id = "gsi-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = () => setTimeout(init, 100);
      document.head.appendChild(s);
    } else {
      setTimeout(init, 300);
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) { setError("Please fill all fields."); return; }
    if (password !== confirmPwd) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/register", { email, password, full_name: fullName });
      setTokens(data.access_token, data.refresh_token, data.user_id, data.email, data.full_name);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Registration failed.");
    } finally { setLoading(false); }
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-lg font-bold mx-auto mb-3">AI</div>
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-slate-400 text-sm mt-1">Start your interview preparation journey</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            <AlertCircle size={15} className="shrink-0 mt-0.5"/><span>{error}</span>
          </div>
        )}

        <div className="glass rounded-2xl p-6 border border-white/5">
          {/* Google Sign Up */}
          <div className="mb-5">
            {!clientId ? (
              <div className="w-full text-center text-xs text-slate-600 py-3 glass border border-dashed border-white/10 rounded-xl">
                Google signup not configured
              </div>
            ) : googleLoading ? (
              <div className="flex items-center justify-center gap-2 py-3 glass border border-white/10 rounded-xl text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin"/>Creating account…
              </div>
            ) : (
              <div id="google-register-btn" className="flex justify-center min-h-[44px]"/>
            )}
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/8"/>
            <span className="text-xs text-slate-600">or register with email</span>
            <div className="flex-1 h-px bg-white/8"/>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Full name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Pranay Kumbhare" autoComplete="name" name="full-name"
                  className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="pranay@example.com" autoComplete="email" name="email"
                  className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters" autoComplete="new-password" name="new-password"
                  className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-10 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                <input type={showPwd ? "text" : "password"} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Repeat password" autoComplete="new-password" name="confirm-password"
                  className="w-full bg-dark-900 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 placeholder:text-slate-700"/>
              </div>
              {confirmPwd && password !== confirmPwd && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
              {password.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[
                    { label:"6+", met: password.length >= 6 },
                    { label:"Letter", met: /[a-zA-Z]/.test(password) },
                    { label:"Number", met: /\d/.test(password) },
                  ].map((r, i) => (
                    <div key={i} className={`flex-1 h-1 rounded-full ${r.met ? "bg-emerald-500" : "bg-dark-800"}`}/>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><Loader2 size={14} className="animate-spin"/>Creating account…</> : "Create Account"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-4">
            Already have an account?{" "}
            <button onClick={() => router.push("/login")} className="text-brand-400 hover:text-brand-300 font-medium">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
