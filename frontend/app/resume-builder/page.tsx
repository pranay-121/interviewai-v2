"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Plus, Trash2, Download, FileText,
  Briefcase, GraduationCap, Code2, Award, User,
  Mail, Upload, Sparkles, Loader2, Eye, EyeOff,
  CheckCircle, AlertCircle, X
} from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
interface Experience {
  id: string; company: string; role: string; location: string;
  startDate: string; endDate: string; current: boolean; bullets: string[];
}
interface Education {
  id: string; institution: string; degree: string; field: string;
  startDate: string; endDate: string; grade: string;
}
interface Project {
  id: string; name: string; description: string; tech: string; link: string;
}
interface Certification {
  id: string; name: string; issuer: string; date: string;
}
interface ResumeData {
  fullName: string; email: string; phone: string; location: string;
  website: string; linkedin: string; github: string; summary: string;
  targetRole: string; experience: Experience[]; education: Education[];
  skills: { category: string; items: string }[];
  projects: Project[]; certifications: Certification[];
}

// ── Constants ──────────────────────────────────────────────────────────────
const TARGET_ROLES = [
  "Software Engineer","Senior Software Engineer","Staff Engineer","Principal Engineer",
  "Frontend Engineer","Backend Engineer","Full Stack Engineer","Mobile Engineer (iOS)",
  "Mobile Engineer (Android)","DevOps Engineer","Site Reliability Engineer",
  "Cloud Architect","Data Scientist","ML Engineer","AI Engineer","Data Engineer",
  "Data Analyst","Product Manager","Engineering Manager","Business Analyst",
  "SAP Consultant","SAP Basis","SAP ABAP Developer","QA Engineer","Security Engineer",
  "UX Designer","Technical Lead","Solutions Architect","Blockchain Developer",
];

const TEMPLATES = [
  { id:"modern",       label:"Modern",       color:"#6366f1", desc:"Clean & professional" },
  { id:"minimal",      label:"Minimal",      color:"#10b981", desc:"ATS optimized" },
  { id:"professional", label:"Professional", color:"#3b82f6", desc:"Traditional corporate" },
];

const uid = () => Math.random().toString(36).slice(2,8);

const EMPTY: ResumeData = {
  fullName:"", email:"", phone:"", location:"", website:"", linkedin:"", github:"",
  summary:"", targetRole:"Software Engineer",
  experience:[{ id:uid(), company:"", role:"", location:"", startDate:"", endDate:"", current:false, bullets:["","",""] }],
  education:[{ id:uid(), institution:"", degree:"", field:"", startDate:"", endDate:"", grade:"" }],
  skills:[{ category:"Programming Languages", items:"" },{ category:"Frameworks & Libraries", items:"" },{ category:"Tools & Platforms", items:"" }],
  projects:[{ id:uid(), name:"", description:"", tech:"", link:"" }],
  certifications:[],
};

function hexToRgb(hex: string) {
  return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16) };
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function ResumeBuilderPage() {
  const router = useRouter();
  const [resume, setResume] = useState<ResumeData>(EMPTY);
  const [template, setTemplate] = useState("modern");
  const [activeSection, setActiveSection] = useState("personal");
  const [downloading, setDownloading] = useState(false);
  const [aiLoading, setAiLoading] = useState<string|null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Import state
  const [importPhase, setImportPhase] = useState<"home"|"upload"|"editor">("home");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof ResumeData, val: any) =>
    setResume(p => ({ ...p, [field]: val }));

  // ── Parse resume text with AI ──────────────────────────────────────────
  const parseResumeWithAI = async (text: string) => {
    // Get token from Zustand persisted store
    let token = "";
    try {
      const stored = localStorage.getItem("interviewai-auth");
      if (stored) {
        const obj = JSON.parse(stored);
        // Try all possible locations
        token = obj?.state?.accessToken
          || obj?.accessToken
          || obj?.state?.access_token
          || obj?.access_token
          || "";
      }
    } catch {}

    // Also try sessionStorage
    if (!token) {
      try {
        const session = sessionStorage.getItem("interviewai-auth");
        if (session) {
          const obj = JSON.parse(session);
          token = obj?.state?.accessToken || obj?.accessToken || "";
        }
      } catch {}
    }

    console.log("[Resume] Token found:", !!token);
    console.log("[Resume] Text length:", text.length);

    if (!token) {
      // Last resort: check all localStorage keys
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("auth") || key.includes("token"))) {
            const val = localStorage.getItem(key) || "";
            const obj = JSON.parse(val);
            token = obj?.state?.accessToken || obj?.accessToken || obj?.token || "";
            if (token) break;
          }
        }
      } catch {}
    }

    if (!token) {
      throw new Error("Session expired. Please logout and login again.");
    }

    const backendRes = await fetch("https://interviewai-backend-yaci.onrender.com/agents/parse-resume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ text: text.slice(0, 3000) }),
    });

    console.log("[Resume] Backend response status:", backendRes.status);

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({}));
      console.log("[Resume] Backend error:", err);
      throw new Error(err.detail || `Server error ${backendRes.status}. Please try again.`);
    }

    const backendData = await backendRes.json();
    console.log("[Resume] Parsed success:", backendData.success);

    if (!backendData.parsed) {
      throw new Error("Could not extract resume data. Please fill the form manually.");
    }
    return backendData.parsed;
  };

  // ── Handle file upload ─────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    if (!file) return;
    if (!file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
      setImportError("Only PDF or TXT files supported.");
      return;
    }
    setImporting(true);
    setImportError("");
    try {
      let text = "";
      if (file.name.endsWith(".txt")) {
        text = await file.text();
      } else {
        // Extract text from PDF using backend
        const formData = new FormData();
        formData.append("file", file);
        const token = JSON.parse(localStorage.getItem("interviewai-auth") || "{}").state?.accessToken || "";
        const res = await fetch("https://interviewai-backend-yaci.onrender.com/agents/extract-resume-text", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          text = data.text || "";
        } else {
          // Fallback: read as text
          text = await file.text();
        }
      }
      if (!text.trim()) throw new Error("Could not extract text from file.");

      // Parse with AI
      const parsed = await parseResumeWithAI(text);

      // Merge parsed data with empty template
      const newResume: ResumeData = {
        ...EMPTY,
        fullName: parsed.fullName || "",
        email: parsed.email || "",
        phone: parsed.phone || "",
        location: parsed.location || "",
        linkedin: parsed.linkedin || "",
        github: parsed.github || "",
        website: parsed.website || "",
        summary: parsed.summary || "",
        targetRole: parsed.targetRole || "Software Engineer",
        experience: parsed.experience?.length
          ? parsed.experience.map((e: any) => ({ id:uid(), company:e.company||"", role:e.role||"", location:e.location||"", startDate:e.startDate||"", endDate:e.endDate||"", current:e.current||false, bullets:e.bullets?.length?e.bullets:[""] }))
          : EMPTY.experience,
        education: parsed.education?.length
          ? parsed.education.map((e: any) => ({ id:uid(), institution:e.institution||"", degree:e.degree||"", field:e.field||"", startDate:e.startDate||"", endDate:e.endDate||"", grade:e.grade||"" }))
          : EMPTY.education,
        skills: parsed.skills?.length
          ? parsed.skills.map((s: any) => ({ category:s.category||"Skills", items:s.items||"" }))
          : EMPTY.skills,
        projects: parsed.projects?.length
          ? parsed.projects.map((p: any) => ({ id:uid(), name:p.name||"", description:p.description||"", tech:p.tech||"", link:p.link||"" }))
          : EMPTY.projects,
        certifications: parsed.certifications?.length
          ? parsed.certifications.map((c: any) => ({ id:uid(), name:c.name||"", issuer:c.issuer||"", date:c.date||"" }))
          : [],
      };
      setResume(newResume);
      setImportPhase("editor");
    } catch (e: any) {
      setImportError(e.message || "Failed to parse resume. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  // ── AI enhance ────────────────────────────────────────────────────────
  const aiEnhance = async (type: "summary"|"bullet", expId?: string, bulletIdx?: number) => {
    setAiLoading(type+(expId||""));
    try {
      const exp = resume.experience.find(e => e.id === expId);
      const token = JSON.parse(localStorage.getItem("interviewai-auth")||"{}").state?.accessToken||"";
      const prompt = type === "summary"
        ? `Write a 3-sentence ATS-friendly professional summary for a ${resume.targetRole}. Experience: ${resume.experience.map(e=>e.company).filter(Boolean).join(", ")}. Return ONLY the summary text.`
        : `Improve this resume bullet for ${exp?.role} at ${exp?.company}: "${exp?.bullets[bulletIdx!]||"developed features"}". Make it ATS-friendly with action verb + metric. Return ONLY the improved bullet.`;

      const res = await fetch("https://interviewai-backend-yaci.onrender.com/agents/quick-question", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body:JSON.stringify({ agent_type:"hr", job_role:prompt, experience_level:"mid", company:"" }),
      });
      const data = await res.json();
      const text = typeof data.question === "string" ? data.question : data.question?.problem || "";

      if (type === "summary") {
        update("summary", text.slice(0,500));
      } else if (expId && bulletIdx !== undefined) {
        update("experience", resume.experience.map(e =>
          e.id===expId ? {...e, bullets:e.bullets.map((b,i)=>i===bulletIdx?text.slice(0,200):b)} : e
        ));
      }
    } catch {}
    finally { setAiLoading(null); }
  };

  // ── Download PDF ──────────────────────────────────────────────────────
  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
      const W=210, margin=18, usableW=W-margin*2;
      let y=18;
      const tpl = TEMPLATES.find(t=>t.id===template);
      const rgb = hexToRgb(tpl?.color||"#6366f1");

      doc.setFillColor(255,255,255); doc.rect(0,0,W,297,"F");

      const newPage = () => { doc.addPage(); y=18; doc.setFillColor(255,255,255); doc.rect(0,0,W,297,"F"); };
      const checkY = (n=10) => { if(y+n>278) newPage(); };

      // Header
      if (template!=="minimal") {
        doc.setFillColor(rgb.r,rgb.g,rgb.b); doc.rect(0,0,W,38,"F");
        doc.setFontSize(20); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
        doc.text(resume.fullName||"Your Name", margin, 16);
        doc.setFontSize(11); doc.setFont("helvetica","normal");
        doc.text(resume.targetRole, margin, 23);
        doc.setFontSize(8); doc.setTextColor(220,220,255);
        doc.text([resume.email,resume.phone,resume.location].filter(Boolean).join("  |  "), margin, 30);
        y=46;
      } else {
        doc.setFontSize(22); doc.setTextColor(30,30,30); doc.setFont("helvetica","bold");
        doc.text(resume.fullName||"Your Name", W/2, y, {align:"center"}); y+=6;
        doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
        doc.text(resume.targetRole, W/2, y, {align:"center"}); y+=5;
        doc.setFontSize(8); doc.setTextColor(120,120,120);
        doc.text([resume.email,resume.phone,resume.location].filter(Boolean).join("  ·  "), W/2, y, {align:"center"});
        y+=10;
      }

      const section = (title: string) => {
        checkY(12); y+=3;
        doc.setFillColor(rgb.r,rgb.g,rgb.b); doc.rect(margin,y-3,usableW,0.5,"F");
        doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(rgb.r,rgb.g,rgb.b);
        doc.text(title.toUpperCase(), margin, y); y+=6;
      };

      if (resume.summary) {
        section("Professional Summary");
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
        doc.splitTextToSize(resume.summary, usableW).forEach((l: string) => { checkY(); doc.text(l,margin,y); y+=4.5; });
        y+=3;
      }

      const exp = resume.experience.filter(e=>e.company||e.role);
      if (exp.length) {
        section("Work Experience");
        exp.forEach(e => {
          checkY(12);
          doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
          doc.text(e.role||"Role", margin, y);
          doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
          doc.text(`${e.startDate}${e.startDate?" – ":""}${e.current?"Present":e.endDate}`, W-margin, y, {align:"right"});
          y+=5;
          doc.setFontSize(9.5); doc.setFont("helvetica","bold"); doc.setTextColor(rgb.r,rgb.g,rgb.b);
          doc.text(`${e.company}${e.location?" · "+e.location:""}`, margin, y); y+=5;
          e.bullets.filter(Boolean).forEach(b => {
            checkY();
            doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
            doc.splitTextToSize(`• ${b}`, usableW-3).forEach((bl: string) => { doc.text(bl,margin+2,y); y+=4; });
          });
          y+=3;
        });
      }

      const edu = resume.education.filter(e=>e.institution||e.degree);
      if (edu.length) {
        section("Education");
        edu.forEach(e => {
          checkY(10);
          doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
          doc.text(`${e.degree}${e.field?" in "+e.field:""}`, margin, y);
          doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
          doc.text(`${e.startDate}${e.startDate&&e.endDate?" – ":""}${e.endDate}`, W-margin, y, {align:"right"});
          y+=5;
          doc.setFontSize(9); doc.setTextColor(rgb.r,rgb.g,rgb.b);
          doc.text(`${e.institution}${e.grade?" · "+e.grade:""}`, margin, y); y+=6;
        });
      }

      const skills = resume.skills.filter(s=>s.items.trim());
      if (skills.length) {
        section("Skills");
        skills.forEach(s => {
          checkY();
          doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(50,50,50);
          const lw = doc.getTextWidth(`${s.category}: `);
          doc.text(`${s.category}: `, margin, y);
          doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
          const lines = doc.splitTextToSize(s.items, usableW-lw-2);
          doc.text(lines[0]||"", margin+lw, y); y+=4.5;
          lines.slice(1).forEach((l: string) => { doc.text(l,margin,y); y+=4.5; });
        });
        y+=2;
      }

      const proj = resume.projects.filter(p=>p.name||p.description);
      if (proj.length) {
        section("Projects");
        proj.forEach(p => {
          checkY(10);
          doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
          doc.text(p.name||"Project", margin, y);
          if (p.link) { doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(rgb.r,rgb.g,rgb.b); doc.text(p.link,W-margin,y,{align:"right"}); }
          y+=5;
          if (p.tech) { doc.setFontSize(8.5); doc.setFont("helvetica","italic"); doc.setTextColor(rgb.r,rgb.g,rgb.b); doc.text(`Tech: ${p.tech}`,margin,y); y+=4; }
          if (p.description) {
            doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(60,60,60);
            doc.splitTextToSize(p.description,usableW).forEach((l: string) => { checkY(); doc.text(l,margin,y); y+=4; });
          }
          y+=3;
        });
      }

      const certs = resume.certifications.filter(c=>c.name);
      if (certs.length) {
        section("Certifications");
        certs.forEach(c => {
          checkY();
          doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(50,50,50);
          doc.text(`• ${c.name}`, margin, y);
          doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
          doc.text(`${c.issuer}${c.date?" · "+c.date:""}`, W-margin, y, {align:"right"});
          y+=5;
        });
      }

      const total = (doc as any).internal.getNumberOfPages();
      for (let p=1;p<=total;p++) {
        doc.setPage(p); doc.setFontSize(7); doc.setTextColor(180,180,180);
        doc.text(`${resume.fullName} · Resume · Page ${p}/${total}`, W/2, 292, {align:"center"});
      }
      doc.save(`${(resume.fullName||"Resume").replace(/\s/g,"_")}_${template}.pdf`);
    } catch(e) { alert("PDF generation failed. Try again."); }
    finally { setDownloading(false); }
  };

  const downloadTXT = () => {
    const lines: string[] = [];
    lines.push(resume.fullName.toUpperCase());
    lines.push([resume.email,resume.phone,resume.location].filter(Boolean).join(" | "));
    if (resume.linkedin) lines.push(`LinkedIn: ${resume.linkedin}`);
    if (resume.github) lines.push(`GitHub: ${resume.github}`);
    lines.push("");
    if (resume.summary) { lines.push("PROFESSIONAL SUMMARY"); lines.push("=".repeat(40)); lines.push(resume.summary); lines.push(""); }
    resume.experience.filter(e=>e.company||e.role).forEach(e => {
      lines.push(`${e.role} | ${e.company} | ${e.location}`);
      lines.push(`${e.startDate} - ${e.current?"Present":e.endDate}`);
      e.bullets.filter(Boolean).forEach(b => lines.push(`• ${b}`));
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], {type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${(resume.fullName||"Resume").replace(/\s/g,"_")}_ATS.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const Input = ({label,value,onChange,placeholder="",className="",type="text"}: any) => (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/40 placeholder:text-slate-700"/>
    </div>
  );

  const SectionBtn = ({id,icon,title}: any) => (
    <button onClick={()=>setActiveSection(activeSection===id?"":id)}
      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm font-medium transition-all ${activeSection===id?"bg-brand-600/10 border-brand-500/30 text-brand-400":"glass border-white/5 text-slate-300 hover:border-white/10"}`}>
      <div className="flex items-center gap-2">{icon}<span>{title}</span></div>
      <span className="text-xs text-slate-600">{activeSection===id?"▲":"▼"}</span>
    </button>
  );

  const tpl = TEMPLATES.find(t=>t.id===template);
  const tplColor = tpl?.color||"#6366f1";

  // ── HOME SCREEN ───────────────────────────────────────────────────────
  if (importPhase === "home") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <button onClick={()=>router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8">
          <ChevronLeft size={15}/>Back
        </button>
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-2xl mx-auto mb-4">📄</div>
          <h1 className="text-3xl font-bold mb-2">AI Resume Builder</h1>
          <p className="text-slate-400">Import your existing resume or start fresh</p>
        </div>
        <div className="grid grid-cols-2 gap-5">
          {/* Import existing */}
          <button onClick={()=>setImportPhase("upload")}
            className="glass rounded-2xl p-8 border border-white/8 hover:border-brand-500/40 transition-all group text-left">
            <div className="w-12 h-12 rounded-xl bg-brand-600/15 border border-brand-500/25 flex items-center justify-center mb-4 group-hover:bg-brand-600/25 transition-colors">
              <Upload size={22} className="text-brand-400"/>
            </div>
            <h2 className="font-bold text-base mb-2">Import Resume</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Upload your existing PDF resume. AI will extract all information and auto-fill the form.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-brand-400">
              <Sparkles size={12}/>AI powered extraction
            </div>
          </button>
          {/* Create new */}
          <button onClick={()=>{ setResume(EMPTY); setImportPhase("editor"); }}
            className="glass rounded-2xl p-8 border border-white/8 hover:border-emerald-500/40 transition-all group text-left">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/15 border border-emerald-500/25 flex items-center justify-center mb-4 group-hover:bg-emerald-600/25 transition-colors">
              <Plus size={22} className="text-emerald-400"/>
            </div>
            <h2 className="font-bold text-base mb-2">Create New</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Start from scratch and build a professional ATS-friendly resume from the ground up.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle size={12}/>3 professional templates
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  // ── UPLOAD SCREEN ─────────────────────────────────────────────────────
  if (importPhase === "upload") return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <button onClick={()=>setImportPhase("home")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8">
          <ChevronLeft size={15}/>Back
        </button>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Import your Resume</h1>
          <p className="text-slate-400 text-sm">AI will extract your information and auto-fill all fields</p>
        </div>

        {importError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            <AlertCircle size={14}/>{importError}
            <button onClick={()=>setImportError("")} className="ml-auto"><X size={13}/></button>
          </div>
        )}

        <div
          onDragOver={e=>{e.preventDefault();setDragOver(true)}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={onDrop}
          onClick={()=>!importing&&fileRef.current?.click()}
          className={`relative glass rounded-2xl p-12 border-2 border-dashed transition-all cursor-pointer text-center ${dragOver?"border-brand-500/60 bg-brand-600/10":"border-white/15 hover:border-brand-500/40 hover:bg-white/2"}`}>

          <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden"
            onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}}/>

          {importing ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 size={40} className="animate-spin text-brand-400"/>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">Extracting resume information…</p>
                <p className="text-xs text-slate-500">AI is reading your resume and filling all fields</p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-5">
                <Upload size={28} className="text-brand-400"/>
              </div>
              <p className="font-semibold text-base mb-2">Drag and drop your resume here</p>
              <p className="text-slate-500 text-sm mb-5">or</p>
              <div className="inline-flex items-center gap-2 btn-primary px-6 py-2.5 text-sm">
                <Upload size={14}/>Choose a file
              </div>
              <p className="text-xs text-slate-600 mt-4">Supports PDF and TXT files</p>
            </>
          )}
        </div>

        <div className="mt-4 glass rounded-xl p-4 border border-white/5">
          <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <Sparkles size={12} className="text-brand-400"/>What AI extracts automatically:
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {["Name & contact info","Work experience & bullets","Education details","Skills & technologies","Projects","Certifications"].map((t,i)=>(
              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                <CheckCircle size={10} className="text-emerald-400 shrink-0"/>{t}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center">
          <button onClick={()=>{setResume(EMPTY);setImportPhase("editor")}}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Skip import → Start with empty form
          </button>
        </div>
      </div>
    </div>
  );

  // ── EDITOR ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <div className="glass border-b border-white/5 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={()=>setImportPhase("home")} className="text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20}/>
          </button>
          <div>
            <h1 className="font-bold text-sm">AI Resume Builder</h1>
            <p className="text-xs text-slate-500">Edit your details · Live preview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setImportPhase("upload")}
            className="flex items-center gap-1.5 glass border border-white/10 hover:bg-white/5 px-3 py-2 rounded-lg text-xs text-slate-400 transition-all">
            <Upload size={12}/>Re-import
          </button>
          <button onClick={()=>setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${showPreview?"bg-brand-600/20 border-brand-500/30 text-brand-400":"glass border-white/10 text-slate-400"}`}>
            {showPreview?<EyeOff size={12}/>:<Eye size={12}/>}{showPreview?"Edit":"Preview"}
          </button>
          <button onClick={downloadTXT}
            className="flex items-center gap-1.5 glass border border-white/10 hover:bg-white/5 px-3 py-2 rounded-lg text-xs text-slate-300 transition-all">
            <FileText size={12}/>TXT (ATS)
          </button>
          <button onClick={downloadPDF} disabled={downloading}
            className="flex items-center gap-1.5 btn-primary px-4 py-2 text-xs disabled:opacity-50">
            {downloading?<Loader2 size={12} className="animate-spin"/>:<Download size={12}/>}
            {downloading?"Generating…":"Download PDF"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-57px)]">
        {/* Left: Editor */}
        <div className={`${showPreview?"hidden md:flex":"flex"} flex-col w-full md:w-[460px] shrink-0 overflow-y-auto border-r border-white/5 p-4 space-y-2.5`}>

          {/* Template */}
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Template</p>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map(t=>(
                <button key={t.id} onClick={()=>setTemplate(t.id)}
                  className={`p-2.5 rounded-xl border text-xs transition-all text-left ${template===t.id?"border-brand-500/50 bg-brand-600/10":"border-white/8 hover:border-white/15"}`}>
                  <div className="w-4 h-4 rounded mb-1" style={{background:t.color}}/>
                  <p className="font-medium text-white">{t.label}</p>
                  <p className="text-slate-600">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Target Role */}
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide">Target Role</label>
            <select value={resume.targetRole} onChange={e=>update("targetRole",e.target.value)}
              className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {TARGET_ROLES.map(r=><option key={r}>{r}</option>)}
            </select>
          </div>

          {/* Personal */}
          <SectionBtn id="personal" icon={<User size={13}/>} title="Personal Information"/>
          {activeSection==="personal" && (
            <div className="glass rounded-xl p-4 border border-white/5 space-y-3">
              <Input label="Full Name *" value={resume.fullName} onChange={(v:string)=>update("fullName",v)} placeholder="Pranay Kumbhare"/>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email *" value={resume.email} onChange={(v:string)=>update("email",v)} placeholder="pranay@email.com"/>
                <Input label="Phone *" value={resume.phone} onChange={(v:string)=>update("phone",v)} placeholder="+91 9876543210"/>
              </div>
              <Input label="Location" value={resume.location} onChange={(v:string)=>update("location",v)} placeholder="Pune, Maharashtra"/>
              <div className="grid grid-cols-2 gap-3">
                <Input label="LinkedIn" value={resume.linkedin} onChange={(v:string)=>update("linkedin",v)} placeholder="linkedin.com/in/pranay"/>
                <Input label="GitHub" value={resume.github} onChange={(v:string)=>update("github",v)} placeholder="github.com/pranay"/>
              </div>
              <Input label="Portfolio" value={resume.website} onChange={(v:string)=>update("website",v)} placeholder="pranay.dev"/>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-500">Professional Summary</label>
                  <button onClick={()=>aiEnhance("summary")} disabled={aiLoading==="summary"}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50">
                    {aiLoading==="summary"?<Loader2 size={10} className="animate-spin"/>:<Sparkles size={10}/>}AI Write
                  </button>
                </div>
                <textarea value={resume.summary} onChange={e=>update("summary",e.target.value)} rows={4}
                  placeholder="Results-driven Software Engineer with 3+ years experience…"
                  className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/40 resize-none placeholder:text-slate-700"/>
              </div>
            </div>
          )}

          {/* Experience */}
          <SectionBtn id="experience" icon={<Briefcase size={13}/>} title="Work Experience"/>
          {activeSection==="experience" && (
            <div className="space-y-3">
              {resume.experience.map((exp,ei)=>(
                <div key={exp.id} className="glass rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400">Experience {ei+1}</p>
                    {resume.experience.length>1&&<button onClick={()=>update("experience",resume.experience.filter(e=>e.id!==exp.id))} className="text-red-400 p-1 rounded"><Trash2 size={12}/></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Job Title *" value={exp.role} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,role:v}:e))} placeholder="Software Engineer"/>
                    <Input label="Company *" value={exp.company} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,company:v}:e))} placeholder="Google"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Location" value={exp.location} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,location:v}:e))} placeholder="Bangalore"/>
                    <Input label="Start Date" value={exp.startDate} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,startDate:v}:e))} placeholder="Jan 2022"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="End Date" value={exp.endDate} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,endDate:v}:e))} placeholder="Dec 2024"/>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={exp.current} onChange={ev=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,current:ev.target.checked}:e))} className="rounded"/>
                        Currently working
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Bullet points (use numbers & metrics)</p>
                    {exp.bullets.map((b,bi)=>(
                      <div key={bi} className="flex gap-2 mb-1.5">
                        <input value={b} onChange={ev=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,bullets:e.bullets.map((bv,i)=>i===bi?ev.target.value:bv)}:e))}
                          placeholder="• Improved system performance by 40%..."
                          className="flex-1 bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-slate-700"/>
                        <button onClick={()=>aiEnhance("bullet",exp.id,bi)} disabled={aiLoading==="bullet"+exp.id}
                          className="shrink-0 text-brand-400 hover:text-brand-300 disabled:opacity-50 p-1.5 glass rounded-lg border border-white/5">
                          {aiLoading==="bullet"+exp.id?<Loader2 size={10} className="animate-spin"/>:<Sparkles size={10}/>}
                        </button>
                      </div>
                    ))}
                    <button onClick={()=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,bullets:[...e.bullets,""]}:e))}
                      className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-1">
                      <Plus size={10}/>Add bullet
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={()=>update("experience",[...resume.experience,{id:uid(),company:"",role:"",location:"",startDate:"",endDate:"",current:false,bullets:["",""]}])}
                className="w-full glass border border-dashed border-white/10 hover:border-brand-500/30 rounded-xl py-2.5 text-sm text-slate-500 hover:text-brand-400 transition-all flex items-center justify-center gap-2">
                <Plus size={13}/>Add Experience
              </button>
            </div>
          )}

          {/* Education */}
          <SectionBtn id="education" icon={<GraduationCap size={13}/>} title="Education"/>
          {activeSection==="education" && (
            <div className="space-y-3">
              {resume.education.map((edu,ei)=>(
                <div key={edu.id} className="glass rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400">Education {ei+1}</p>
                    {resume.education.length>1&&<button onClick={()=>update("education",resume.education.filter(e=>e.id!==edu.id))} className="text-red-400 p-1"><Trash2 size={12}/></button>}
                  </div>
                  <Input label="Institution *" value={edu.institution} onChange={(v:string)=>update("education",resume.education.map(e=>e.id===edu.id?{...e,institution:v}:e))} placeholder="IIT Bombay / Pune University"/>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Degree" value={edu.degree} onChange={(v:string)=>update("education",resume.education.map(e=>e.id===edu.id?{...e,degree:v}:e))} placeholder="B.Tech / MCA"/>
                    <Input label="Field" value={edu.field} onChange={(v:string)=>update("education",resume.education.map(e=>e.id===edu.id?{...e,field:v}:e))} placeholder="Computer Science"/>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Start" value={edu.startDate} onChange={(v:string)=>update("education",resume.education.map(e=>e.id===edu.id?{...e,startDate:v}:e))} placeholder="2018"/>
                    <Input label="End" value={edu.endDate} onChange={(v:string)=>update("education",resume.education.map(e=>e.id===edu.id?{...e,endDate:v}:e))} placeholder="2022"/>
                    <Input label="Grade" value={edu.grade} onChange={(v:string)=>update("education",resume.education.map(e=>e.id===edu.id?{...e,grade:v}:e))} placeholder="8.5 CGPA"/>
                  </div>
                </div>
              ))}
              <button onClick={()=>update("education",[...resume.education,{id:uid(),institution:"",degree:"",field:"",startDate:"",endDate:"",grade:""}])}
                className="w-full glass border border-dashed border-white/10 hover:border-brand-500/30 rounded-xl py-2.5 text-sm text-slate-500 hover:text-brand-400 transition-all flex items-center justify-center gap-2">
                <Plus size={13}/>Add Education
              </button>
            </div>
          )}

          {/* Skills */}
          <SectionBtn id="skills" icon={<Code2 size={13}/>} title="Skills"/>
          {activeSection==="skills" && (
            <div className="glass rounded-xl p-4 border border-white/5 space-y-2.5">
              <p className="text-xs text-slate-500">Comma-separated skills — ATS reads these as keywords</p>
              {resume.skills.map((s,i)=>(
                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                  <input value={s.category} onChange={e=>update("skills",resume.skills.map((sk,j)=>j===i?{...sk,category:e.target.value}:sk))}
                    className="bg-dark-900 border border-white/8 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"/>
                  <input value={s.items} className="col-span-2 bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-slate-700"
                    placeholder="Python, JavaScript, React" onChange={e=>update("skills",resume.skills.map((sk,j)=>j===i?{...sk,items:e.target.value}:sk))}/>
                </div>
              ))}
              <button onClick={()=>update("skills",[...resume.skills,{category:"Other",items:""}])}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                <Plus size={10}/>Add category
              </button>
            </div>
          )}

          {/* Projects */}
          <SectionBtn id="projects" icon={<Code2 size={13}/>} title="Projects"/>
          {activeSection==="projects" && (
            <div className="space-y-3">
              {resume.projects.map((p,pi)=>(
                <div key={p.id} className="glass rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400">Project {pi+1}</p>
                    <button onClick={()=>update("projects",resume.projects.filter(pr=>pr.id!==p.id))} className="text-red-400 p-1"><Trash2 size={12}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Name" value={p.name} onChange={(v:string)=>update("projects",resume.projects.map(pr=>pr.id===p.id?{...pr,name:v}:pr))} placeholder="E-commerce Platform"/>
                    <Input label="Link" value={p.link} onChange={(v:string)=>update("projects",resume.projects.map(pr=>pr.id===p.id?{...pr,link:v}:pr))} placeholder="github.com/user/project"/>
                  </div>
                  <Input label="Technologies" value={p.tech} onChange={(v:string)=>update("projects",resume.projects.map(pr=>pr.id===p.id?{...pr,tech:v}:pr))} placeholder="React, Node.js, MongoDB"/>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Description</label>
                    <textarea value={p.description} rows={2} onChange={e=>update("projects",resume.projects.map(pr=>pr.id===p.id?{...pr,description:e.target.value}:pr))}
                      placeholder="Built a platform handling 10K+ daily users..."
                      className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none resize-none placeholder:text-slate-700"/>
                  </div>
                </div>
              ))}
              <button onClick={()=>update("projects",[...resume.projects,{id:uid(),name:"",description:"",tech:"",link:""}])}
                className="w-full glass border border-dashed border-white/10 hover:border-brand-500/30 rounded-xl py-2.5 text-sm text-slate-500 hover:text-brand-400 transition-all flex items-center justify-center gap-2">
                <Plus size={13}/>Add Project
              </button>
            </div>
          )}

          {/* Certifications */}
          <SectionBtn id="certs" icon={<Award size={13}/>} title="Certifications"/>
          {activeSection==="certs" && (
            <div className="space-y-3">
              {resume.certifications.map((c,ci)=>(
                <div key={c.id} className="glass rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-slate-400">Cert {ci+1}</p>
                    <button onClick={()=>update("certifications",resume.certifications.filter(cert=>cert.id!==c.id))} className="text-red-400 p-1"><Trash2 size={12}/></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={c.name} onChange={e=>update("certifications",resume.certifications.map(cert=>cert.id===c.id?{...cert,name:e.target.value}:cert))}
                      placeholder="AWS Solutions Architect" className="col-span-1 bg-dark-900 border border-white/8 rounded-lg px-2 py-2 text-xs text-white focus:outline-none placeholder:text-slate-700"/>
                    <input value={c.issuer} onChange={e=>update("certifications",resume.certifications.map(cert=>cert.id===c.id?{...cert,issuer:e.target.value}:cert))}
                      placeholder="Amazon" className="bg-dark-900 border border-white/8 rounded-lg px-2 py-2 text-xs text-white focus:outline-none placeholder:text-slate-700"/>
                    <input value={c.date} onChange={e=>update("certifications",resume.certifications.map(cert=>cert.id===c.id?{...cert,date:e.target.value}:cert))}
                      placeholder="2024" className="bg-dark-900 border border-white/8 rounded-lg px-2 py-2 text-xs text-white focus:outline-none placeholder:text-slate-700"/>
                  </div>
                </div>
              ))}
              <button onClick={()=>update("certifications",[...resume.certifications,{id:uid(),name:"",issuer:"",date:""}])}
                className="w-full glass border border-dashed border-white/10 hover:border-brand-500/30 rounded-xl py-2.5 text-sm text-slate-500 hover:text-brand-400 transition-all flex items-center justify-center gap-2">
                <Plus size={13}/>Add Certification
              </button>
            </div>
          )}
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 overflow-y-auto bg-slate-200 p-6">
          <div className="max-w-[680px] mx-auto bg-white shadow-2xl rounded-lg overflow-hidden" style={{minHeight:"900px",fontFamily:"Arial,sans-serif"}}>
            {/* Preview header */}
            {template!=="minimal" ? (
              <div style={{background:tplColor,padding:"24px 28px 20px"}}>
                <h1 style={{color:"#fff",fontSize:22,fontWeight:700,margin:0}}>{resume.fullName||"Your Name"}</h1>
                <p style={{color:"rgba(255,255,255,0.85)",fontSize:12,margin:"4px 0 0"}}>{resume.targetRole}</p>
                <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
                  {[resume.email,resume.phone,resume.location].filter(Boolean).map((c,i)=>(
                    <span key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:10}}>{c}</span>
                  ))}
                  {resume.linkedin&&<span style={{color:"rgba(255,255,255,0.75)",fontSize:10}}>{resume.linkedin}</span>}
                </div>
              </div>
            ) : (
              <div style={{textAlign:"center",padding:"24px 28px 12px",borderBottom:"2px solid #e5e7eb"}}>
                <h1 style={{color:"#111",fontSize:22,fontWeight:700,margin:0}}>{resume.fullName||"Your Name"}</h1>
                <p style={{color:"#6b7280",fontSize:12,margin:"4px 0"}}>{resume.targetRole}</p>
                <p style={{color:"#9ca3af",fontSize:10}}>{[resume.email,resume.phone,resume.location,resume.linkedin].filter(Boolean).join(" · ")}</p>
              </div>
            )}

            <div style={{padding:"20px 28px"}}>
              {/* Summary */}
              {resume.summary&&(
                <div style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:10,fontWeight:700,color:tplColor,textTransform:"uppercase",letterSpacing:1}}>Professional Summary</span>
                    <div style={{flex:1,height:1,background:tplColor,opacity:0.3}}/>
                  </div>
                  <p style={{color:"#374151",fontSize:11,lineHeight:1.6,margin:0}}>{resume.summary}</p>
                </div>
              )}

              {/* Experience */}
              {resume.experience.filter(e=>e.company||e.role).length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:tplColor,textTransform:"uppercase",letterSpacing:1}}>Work Experience</span>
                    <div style={{flex:1,height:1,background:tplColor,opacity:0.3}}/>
                  </div>
                  {resume.experience.filter(e=>e.company||e.role).map(exp=>(
                    <div key={exp.id} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                        <strong style={{fontSize:12,color:"#111"}}>{exp.role||"Role"}</strong>
                        <span style={{fontSize:10,color:"#9ca3af"}}>{exp.startDate}{exp.startDate?" – ":""}{exp.current?"Present":exp.endDate}</span>
                      </div>
                      <div style={{fontSize:11,color:tplColor,fontWeight:600,marginBottom:3}}>{exp.company}{exp.location?" · "+exp.location:""}</div>
                      {exp.bullets.filter(Boolean).map((b,i)=>(
                        <div key={i} style={{fontSize:10.5,color:"#374151",marginBottom:2}}>• {b}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Education */}
              {resume.education.filter(e=>e.institution).length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:tplColor,textTransform:"uppercase",letterSpacing:1}}>Education</span>
                    <div style={{flex:1,height:1,background:tplColor,opacity:0.3}}/>
                  </div>
                  {resume.education.filter(e=>e.institution).map(edu=>(
                    <div key={edu.id} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <strong style={{fontSize:12,color:"#111"}}>{edu.degree}{edu.field?" in "+edu.field:""}</strong>
                        <span style={{fontSize:10,color:"#9ca3af"}}>{edu.startDate}{edu.startDate&&edu.endDate?" – ":""}{edu.endDate}</span>
                      </div>
                      <div style={{fontSize:11,color:tplColor}}>{edu.institution}{edu.grade?" · "+edu.grade:""}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills */}
              {resume.skills.filter(s=>s.items).length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:tplColor,textTransform:"uppercase",letterSpacing:1}}>Skills</span>
                    <div style={{flex:1,height:1,background:tplColor,opacity:0.3}}/>
                  </div>
                  {resume.skills.filter(s=>s.items).map((s,i)=>(
                    <div key={i} style={{fontSize:11,color:"#374151",marginBottom:3}}>
                      <strong>{s.category}:</strong> {s.items}
                    </div>
                  ))}
                </div>
              )}

              {/* Projects */}
              {resume.projects.filter(p=>p.name).length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:tplColor,textTransform:"uppercase",letterSpacing:1}}>Projects</span>
                    <div style={{flex:1,height:1,background:tplColor,opacity:0.3}}/>
                  </div>
                  {resume.projects.filter(p=>p.name).map(p=>(
                    <div key={p.id} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <strong style={{fontSize:12,color:"#111"}}>{p.name}</strong>
                        {p.link&&<span style={{fontSize:9,color:tplColor}}>{p.link}</span>}
                      </div>
                      {p.tech&&<div style={{fontSize:10,color:"#9ca3af",fontStyle:"italic"}}>Tech: {p.tech}</div>}
                      {p.description&&<div style={{fontSize:10.5,color:"#374151"}}>{p.description}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Certifications */}
              {resume.certifications.filter(c=>c.name).length>0&&(
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:tplColor,textTransform:"uppercase",letterSpacing:1}}>Certifications</span>
                    <div style={{flex:1,height:1,background:tplColor,opacity:0.3}}/>
                  </div>
                  {resume.certifications.filter(c=>c.name).map(c=>(
                    <div key={c.id} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:11,color:"#374151"}}>• {c.name}{c.issuer?" — "+c.issuer:""}</span>
                      <span style={{fontSize:10,color:"#9ca3af"}}>{c.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ATS tips */}
          <div className="max-w-[680px] mx-auto mt-4 glass rounded-xl p-4 border border-white/5">
            <p className="text-xs font-medium text-brand-400 mb-2">✅ ATS Tips</p>
            <div className="grid grid-cols-2 gap-1.5">
              {["Use keywords from job description","Quantify with numbers/metrics","No tables or images in PDF","Standard section names","Download TXT for best ATS score","Keep to 1-2 pages max"].map((t,i)=>(
                <p key={i} className="text-xs text-slate-500 flex items-start gap-1">
                  <span className="text-emerald-400 shrink-0">•</span>{t}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
