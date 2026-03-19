"use client";
import { useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";

interface Props {
  role: string;
  company: string;
  score: number;
  totalQuestions: number;
  agentType: string;
  onClose: () => void;
}

const APP_URL = "https://interviewai-beta-one.vercel.app";

export default function ShareCard({ role, company, score, totalQuestions, agentType, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const scoreColor = score >= 7 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";
  const emoji = score >= 8 ? "🔥" : score >= 6 ? "🎯" : score >= 4 ? "💪" : "📚";
  const verdict = score >= 8 ? "Excellent" : score >= 6 ? "Good" : score >= 4 ? "Average" : "Needs Work";

  const whatsappText = encodeURIComponent(
    `${emoji} Just scored ${score.toFixed(1)}/10 in my ${company} ${role} mock interview!\n\n` +
    `Interview type: ${agentType.replace("_"," ")}\n` +
    `Questions: ${totalQuestions}\n` +
    `Result: ${verdict}\n\n` +
    `Practice free at ${APP_URL} ��`
  );

  const linkedinText = encodeURIComponent(
    `${emoji} Just scored ${score.toFixed(1)}/10 in my ${company} ${role} mock interview on InterviewAI!\n\n` +
    `Been practicing with AI-powered mock interviews.\n\n` +
    `Try it free: ${APP_URL}\n\n` +
    `#InterviewPrep #TechInterview #SoftwareEngineering #CareerGrowth`
  );

  const downloadCard = async () => {
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      if (!cardRef.current) return;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: "#0a0a0f",
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `InterviewAI_Score_${score.toFixed(1)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-dark-950/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <button onClick={onClose}
            className="text-slate-400 hover:text-white p-2 glass rounded-xl border border-white/10">
            <X size={16}/>
          </button>
        </div>

        <div ref={cardRef}
          style={{
            background: "linear-gradient(135deg, #0a0a0f 0%, #0f172a 50%, #0a0a0f 100%)",
            borderRadius: 20,
            padding: 32,
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "system-ui, sans-serif",
          }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#fff", fontWeight:700 }}>
                AI
              </div>
              <div>
                <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>InterviewAI</div>
                <div style={{ color:"#64748b", fontSize:11 }}>Mock Interview Score</div>
              </div>
            </div>
            <div style={{ color:"#64748b", fontSize:11 }}>{new Date().toLocaleDateString("en-IN")}</div>
          </div>

          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ fontSize:72, fontWeight:900, color:scoreColor, lineHeight:1 }}>
              {score.toFixed(1)}
            </div>
            <div style={{ color:"#94a3b8", fontSize:14, marginTop:4 }}>out of 10</div>
            <div style={{ marginTop:10, display:"inline-block", background:`${scoreColor}18`, border:`1px solid ${scoreColor}40`, borderRadius:20, padding:"4px 14px", color:scoreColor, fontSize:12, fontWeight:600 }}>
              {emoji} {verdict}
            </div>
          </div>

          <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:14, padding:"14px 18px", marginBottom:20 }}>
            {[
              { label:"Role",      value: role },
              { label:"Company",   value: company || "General" },
              { label:"Type",      value: agentType.replace("_"," ").replace(/\b\w/g,c=>c.toUpperCase()) },
              { label:"Questions", value: `${totalQuestions} answered` },
            ].map((item,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom: i < 3 ? 8 : 0 }}>
                <span style={{ color:"#64748b", fontSize:12 }}>{item.label}</span>
                <span style={{ color:"#e2e8f0", fontSize:12, fontWeight:500 }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", gap:3 }}>
              {Array.from({length:10}).map((_,i) => (
                <div key={i} style={{
                  flex:1, height:6, borderRadius:3,
                  background: i < Math.round(score) ? scoreColor : "rgba(255,255,255,0.1)",
                }}/>
              ))}
            </div>
          </div>

          <div style={{ textAlign:"center", color:"#475569", fontSize:11 }}>
            Practice free at <span style={{ color:"#6366f1" }}>{APP_URL}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button onClick={downloadCard} disabled={downloading}
            className="w-full flex items-center justify-center gap-2 glass border border-white/10 hover:bg-white/5 transition-colors py-3 rounded-xl text-sm font-medium">
            <Download size={15}/>
            {downloading ? "Generating image…" : "Download Score Card"}
          </button>

          <a href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
            style={{ background:"#25D366", color:"#fff", display:"flex" }}>
            <span>📱</span>Share on WhatsApp
          </a>

          <a href={`https://www.linkedin.com/feed/?shareActive=true&text=${linkedinText}`}
            target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
            style={{ background:"#0077B5", color:"#fff", display:"flex" }}>
            <span>💼</span>Share on LinkedIn
          </a>

          <button onClick={() => {
            navigator.clipboard.writeText(`${emoji} Scored ${score.toFixed(1)}/10 in ${company} ${role} mock interview!\nPractice free: ${APP_URL}`);
            alert("Copied to clipboard!");
          }} className="w-full flex items-center justify-center gap-2 glass border border-white/10 hover:bg-white/5 transition-colors py-3 rounded-xl text-sm text-slate-400">
            <Share2 size={14}/>Copy share text
          </button>
        </div>
      </div>
    </div>
  );
}
