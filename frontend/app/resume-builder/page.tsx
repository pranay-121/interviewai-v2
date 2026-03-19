"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Plus, Trash2, Download, FileText,
  Briefcase, GraduationCap, Code2, Award, User,
  Phone, Mail, MapPin, Globe, Linkedin, Github,
  ChevronDown, ChevronUp, Sparkles, Loader2, Eye
} from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
interface Experience {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  grade: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  tech: string;
  link: string;
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

interface ResumeData {
  // Personal
  fullName: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  github: string;
  summary: string;
  targetRole: string;
  // Sections
  experience: Experience[];
  education: Education[];
  skills: { category: string; items: string }[];
  projects: Project[];
  certifications: Certification[];
}

// ── Constants ──────────────────────────────────────────────────────────────
const TARGET_ROLES = [
  "Software Engineer", "Senior Software Engineer", "Staff Engineer",
  "Frontend Engineer", "Backend Engineer", "Full Stack Engineer",
  "Mobile Engineer", "DevOps Engineer", "Site Reliability Engineer",
  "Cloud Architect", "Data Scientist", "ML Engineer", "AI Engineer",
  "Data Engineer", "Data Analyst", "Product Manager",
  "Engineering Manager", "Technical Lead", "Solutions Architect",
  "QA Engineer", "Security Engineer", "Blockchain Developer",
  "SAP Consultant", "SAP Basis", "SAP ABAP Developer",
  "Business Analyst", "Scrum Master", "UX Designer",
];

const TEMPLATES = [
  { id: "modern",      label: "Modern",      desc: "Clean & professional",    color: "#6366f1" },
  { id: "minimal",     label: "Minimal",     desc: "ATS optimized, plain",    color: "#10b981" },
  { id: "professional",label: "Professional",desc: "Traditional corporate",   color: "#3b82f6" },
];

const SKILL_CATEGORIES = [
  "Programming Languages", "Frameworks & Libraries", "Databases",
  "Cloud & DevOps", "Tools & Platforms", "Soft Skills",
];

const uid = () => Math.random().toString(36).slice(2, 8);

const EMPTY_RESUME: ResumeData = {
  fullName: "", email: "", phone: "", location: "",
  website: "", linkedin: "", github: "", summary: "",
  targetRole: "Software Engineer",
  experience: [{
    id: uid(), company: "", role: "", location: "",
    startDate: "", endDate: "", current: false,
    bullets: ["", "", ""],
  }],
  education: [{
    id: uid(), institution: "", degree: "", field: "",
    startDate: "", endDate: "", grade: "",
  }],
  skills: [
    { category: "Programming Languages", items: "" },
    { category: "Frameworks & Libraries", items: "" },
    { category: "Tools & Platforms", items: "" },
  ],
  projects: [{
    id: uid(), name: "", description: "", tech: "", link: "",
  }],
  certifications: [],
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function ResumeBuilderPage() {
  const router = useRouter();
  const [resume, setResume] = useState<ResumeData>(EMPTY_RESUME);
  const [template, setTemplate] = useState("modern");
  const [activeSection, setActiveSection] = useState("personal");
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const update = (field: keyof ResumeData, val: any) =>
    setResume(p => ({ ...p, [field]: val }));

  // ── AI Enhance ─────────────────────────────────────────────────────────
  const aiEnhance = async (type: "summary" | "bullet", expId?: string, bulletIdx?: number) => {
    setAiLoading(type + (expId || ""));
    try {
      const exp = resume.experience.find(e => e.id === expId);
      const prompt = type === "summary"
        ? `Write a 3-sentence professional summary for a ${resume.targetRole} with experience at: ${resume.experience.map(e => e.company).filter(Boolean).join(", ")}. Make it ATS-friendly, quantified, and impactful. Return ONLY the summary text, no quotes.`
        : `Improve this resume bullet point for a ${exp?.role} at ${exp?.company}: "${exp?.bullets[bulletIdx!] || "developed features"}". Make it ATS-friendly with action verb + metric + impact. Return ONLY the improved bullet, no quotes.`;

      const { data } = await api.post("/agents/quick-question", {
        agent_type: "hr",
        job_role: resume.targetRole,
        experience_level: "mid",
        company: "",
      });

      // Use Groq directly via our backend
      const res = await fetch("https://interviewai-backend-yaci.onrender.com/agents/quick-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${JSON.parse(localStorage.getItem("interviewai-auth") || "{}").state?.accessToken || ""}`,
        },
        body: JSON.stringify({
          agent_type: "hr",
          job_role: prompt,
          experience_level: "mid",
          company: "",
        }),
      });
      const result = await res.json();
      const text = typeof result.question === "string" ? result.question : result.question?.problem || "";

      if (type === "summary") {
        update("summary", text.slice(0, 500));
      } else if (expId && bulletIdx !== undefined) {
        const newExp = resume.experience.map(e =>
          e.id === expId
            ? { ...e, bullets: e.bullets.map((b, i) => i === bulletIdx ? text.slice(0, 200) : b) }
            : e
        );
        update("experience", newExp);
      }
    } catch {}
    finally { setAiLoading(null); }
  };

  // ── Download PDF ────────────────────────────────────────────────────────
  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const margin = 18;
      let y = 18;
      const usableW = W - margin * 2;

      const tplColor = TEMPLATES.find(t => t.id === template)?.color || "#6366f1";
      const rgb = hexToRgb(tplColor);

      // Background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, W, 297, "F");

      const newPage = () => {
        doc.addPage();
        y = 18;
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, W, 297, "F");
      };

      const checkY = (needed = 10) => { if (y + needed > 278) newPage(); };

      const text = (t: string, x: number, size: number, color: [number,number,number] = [30,30,30], bold = false, align: "left"|"right"|"center" = "left") => {
        doc.setFontSize(size);
        doc.setTextColor(...color);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.text(t, x, y, { align });
      };

      const section = (title: string) => {
        checkY(12);
        y += 4;
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(margin, y - 4, usableW, 0.5, "F");
        text(title.toUpperCase(), margin, 9, [rgb.r, rgb.g, rgb.b], true);
        y += 6;
      };

      // ── Header ──
      if (template !== "minimal") {
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(0, 0, W, 38, "F");
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(resume.fullName || "Your Name", margin, 16);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(resume.targetRole, margin, 23);
        // Contact line
        const contacts = [resume.email, resume.phone, resume.location].filter(Boolean).join("  |  ");
        doc.setFontSize(8);
        doc.setTextColor(220, 220, 255);
        doc.text(contacts, margin, 30);
        y = 46;
      } else {
        doc.setFontSize(22);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.text(resume.fullName || "Your Name", W/2, y, { align: "center" });
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(resume.targetRole, W/2, y, { align: "center" });
        y += 5;
        const contacts = [resume.email, resume.phone, resume.location, resume.linkedin].filter(Boolean).join("  ·  ");
        doc.setFontSize(8);
        doc.text(contacts, W/2, y, { align: "center" });
        y += 10;
      }

      // ── Summary ──
      if (resume.summary) {
        section("Professional Summary");
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const lines = doc.splitTextToSize(resume.summary, usableW);
        lines.forEach((l: string) => { checkY(); doc.text(l, margin, y); y += 4.5; });
        y += 3;
      }

      // ── Experience ──
      const validExp = resume.experience.filter(e => e.company || e.role);
      if (validExp.length) {
        section("Work Experience");
        validExp.forEach(exp => {
          checkY(12);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 30, 30);
          doc.text(exp.role || "Role", margin, y);
          const dateStr = `${exp.startDate || ""}${exp.startDate ? " – " : ""}${exp.current ? "Present" : exp.endDate || ""}`;
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(dateStr, W - margin, y, { align: "right" });
          y += 5;
          doc.setFontSize(9.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(rgb.r, rgb.g, rgb.b);
          doc.text(`${exp.company}${exp.location ? "  ·  " + exp.location : ""}`, margin, y);
          y += 5;
          exp.bullets.filter(Boolean).forEach(b => {
            checkY();
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(50, 50, 50);
            const bLines = doc.splitTextToSize(`• ${b}`, usableW - 3);
            bLines.forEach((bl: string) => { doc.text(bl, margin + 2, y); y += 4; });
          });
          y += 3;
        });
      }

      // ── Education ──
      const validEdu = resume.education.filter(e => e.institution || e.degree);
      if (validEdu.length) {
        section("Education");
        validEdu.forEach(edu => {
          checkY(10);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 30, 30);
          doc.text(`${edu.degree}${edu.field ? " in " + edu.field : ""}`, margin, y);
          const dateStr = `${edu.startDate || ""}${edu.startDate && edu.endDate ? " – " : ""}${edu.endDate || ""}`;
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(dateStr, W - margin, y, { align: "right" });
          y += 5;
          doc.setFontSize(9);
          doc.setTextColor(rgb.r, rgb.g, rgb.b);
          doc.text(edu.institution + (edu.grade ? `  ·  ${edu.grade}` : ""), margin, y);
          y += 6;
        });
      }

      // ── Skills ──
      const validSkills = resume.skills.filter(s => s.items.trim());
      if (validSkills.length) {
        section("Skills");
        validSkills.forEach(s => {
          checkY();
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          doc.text(`${s.category}: `, margin, y);
          const labelW = doc.getTextWidth(`${s.category}: `);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 80, 80);
          const skillLines = doc.splitTextToSize(s.items, usableW - labelW - 2);
          doc.text(skillLines[0] || "", margin + labelW, y);
          y += 4.5;
          skillLines.slice(1).forEach((l: string) => { doc.text(l, margin, y); y += 4.5; });
        });
        y += 2;
      }

      // ── Projects ──
      const validProj = resume.projects.filter(p => p.name || p.description);
      if (validProj.length) {
        section("Projects");
        validProj.forEach(p => {
          checkY(10);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 30, 30);
          doc.text(p.name || "Project", margin, y);
          if (p.link) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(rgb.r, rgb.g, rgb.b);
            doc.text(p.link, W - margin, y, { align: "right" });
          }
          y += 5;
          if (p.tech) {
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(rgb.r, rgb.g, rgb.b);
            doc.text(`Tech: ${p.tech}`, margin, y);
            y += 4;
          }
          if (p.description) {
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(60, 60, 60);
            const dLines = doc.splitTextToSize(p.description, usableW);
            dLines.forEach((l: string) => { checkY(); doc.text(l, margin, y); y += 4; });
          }
          y += 3;
        });
      }

      // ── Certifications ──
      const validCerts = resume.certifications.filter(c => c.name);
      if (validCerts.length) {
        section("Certifications");
        validCerts.forEach(c => {
          checkY();
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          doc.text(`• ${c.name}`, margin, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(`${c.issuer}${c.date ? "  ·  " + c.date : ""}`, W - margin, y, { align: "right" });
          y += 5;
        });
      }

      // Footer
      const total = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.text(`${resume.fullName} · Resume · Page ${p}/${total}`, W/2, 292, { align: "center" });
      }

      doc.save(`${(resume.fullName || "Resume").replace(/\s/g,"_")}_${template}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF generation failed. Try again.");
    } finally { setDownloading(false); }
  };

  // ── Download Plain Text (ATS) ───────────────────────────────────────────
  const downloadTXT = () => {
    const lines: string[] = [];
    lines.push(resume.fullName.toUpperCase());
    lines.push([resume.email, resume.phone, resume.location].filter(Boolean).join(" | "));
    if (resume.linkedin) lines.push(`LinkedIn: ${resume.linkedin}`);
    if (resume.github) lines.push(`GitHub: ${resume.github}`);
    lines.push("");
    if (resume.summary) {
      lines.push("PROFESSIONAL SUMMARY");
      lines.push("=".repeat(40));
      lines.push(resume.summary);
      lines.push("");
    }
    const exp = resume.experience.filter(e => e.company || e.role);
    if (exp.length) {
      lines.push("WORK EXPERIENCE");
      lines.push("=".repeat(40));
      exp.forEach(e => {
        lines.push(`${e.role} | ${e.company} | ${e.location}`);
        lines.push(`${e.startDate} - ${e.current ? "Present" : e.endDate}`);
        e.bullets.filter(Boolean).forEach(b => lines.push(`• ${b}`));
        lines.push("");
      });
    }
    const edu = resume.education.filter(e => e.institution);
    if (edu.length) {
      lines.push("EDUCATION");
      lines.push("=".repeat(40));
      edu.forEach(e => {
        lines.push(`${e.degree} in ${e.field} | ${e.institution}`);
        lines.push(`${e.startDate} - ${e.endDate}${e.grade ? " | " + e.grade : ""}`);
        lines.push("");
      });
    }
    const skills = resume.skills.filter(s => s.items);
    if (skills.length) {
      lines.push("SKILLS");
      lines.push("=".repeat(40));
      skills.forEach(s => lines.push(`${s.category}: ${s.items}`));
      lines.push("");
    }
    const proj = resume.projects.filter(p => p.name);
    if (proj.length) {
      lines.push("PROJECTS");
      lines.push("=".repeat(40));
      proj.forEach(p => {
        lines.push(p.name);
        if (p.tech) lines.push(`Technologies: ${p.tech}`);
        if (p.description) lines.push(p.description);
        lines.push("");
      });
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(resume.fullName || "Resume").replace(/\s/g,"_")}_ATS.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Section components ─────────────────────────────────────────────────
  const SectionHeader = ({ id, icon, title }: { id: string; icon: any; title: string }) => (
    <button onClick={() => setActiveSection(activeSection === id ? "" : id)}
      className={`w-full flex items-center justify-between p-4 rounded-xl border text-sm font-medium transition-all ${activeSection === id ? "bg-brand-600/10 border-brand-500/30 text-brand-400" : "glass border-white/5 text-slate-300 hover:border-white/10"}`}>
      <div className="flex items-center gap-2">{icon}{title}</div>
      {activeSection === id ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
    </button>
  );

  const Input = ({ label, value, onChange, placeholder = "", type = "text", className = "" }: any) => (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/40 placeholder:text-slate-700"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")}
            className="text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20}/>
          </button>
          <div>
            <h1 className="font-bold text-base">AI Resume Builder</h1>
            <p className="text-xs text-slate-500">ATS-optimized · Multiple formats · AI-enhanced</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreview(!preview)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${preview ? "bg-brand-600/20 border-brand-500/30 text-brand-400" : "glass border-white/10 text-slate-400"}`}>
            <Eye size={13}/>{preview ? "Edit" : "Preview"}
          </button>
          <button onClick={downloadTXT}
            className="flex items-center gap-1.5 glass border border-white/10 hover:bg-white/5 px-3 py-2 rounded-lg text-xs text-slate-300 transition-all">
            <FileText size={13}/>TXT (ATS)
          </button>
          <button onClick={downloadPDF} disabled={downloading}
            className="flex items-center gap-1.5 btn-primary px-4 py-2 text-xs disabled:opacity-50">
            {downloading ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>}
            {downloading ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Left: Editor */}
        <div className={`${preview ? "hidden" : "flex"} md:flex flex-col w-full md:w-[480px] shrink-0 overflow-y-auto border-r border-white/5 p-4 space-y-3`}>

          {/* Template selector */}
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Template</p>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)}
                  className={`p-2.5 rounded-xl border text-xs transition-all text-left ${template===t.id?"border-brand-500/50 bg-brand-600/10":"border-white/8 hover:border-white/15"}`}>
                  <div className="w-4 h-4 rounded mb-1" style={{ background: t.color }}/>
                  <p className="font-medium text-white">{t.label}</p>
                  <p className="text-slate-600 text-xs">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Target Role */}
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide">Target Role</label>
            <select value={resume.targetRole} onChange={e => update("targetRole", e.target.value)}
              className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/40">
              {TARGET_ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          {/* Personal Info */}
          <SectionHeader id="personal" icon={<User size={14}/>} title="Personal Information"/>
          {activeSection === "personal" && (
            <div className="glass rounded-xl p-4 border border-white/5 space-y-3">
              <Input label="Full Name *" value={resume.fullName} onChange={(v: string) => update("fullName", v)} placeholder="Pranay Kumbhare"/>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email *" value={resume.email} onChange={(v: string) => update("email", v)} placeholder="pranay@email.com"/>
                <Input label="Phone *" value={resume.phone} onChange={(v: string) => update("phone", v)} placeholder="+91 9876543210"/>
              </div>
              <Input label="Location" value={resume.location} onChange={(v: string) => update("location", v)} placeholder="Pune, Maharashtra"/>
              <div className="grid grid-cols-2 gap-3">
                <Input label="LinkedIn" value={resume.linkedin} onChange={(v: string) => update("linkedin", v)} placeholder="linkedin.com/in/pranay"/>
                <Input label="GitHub" value={resume.github} onChange={(v: string) => update("github", v)} placeholder="github.com/pranay"/>
              </div>
              <Input label="Portfolio / Website" value={resume.website} onChange={(v: string) => update("website", v)} placeholder="pranay.dev"/>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-500">Professional Summary *</label>
                  <button onClick={() => aiEnhance("summary")} disabled={aiLoading === "summary"}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50">
                    {aiLoading === "summary" ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}
                    AI Write
                  </button>
                </div>
                <textarea value={resume.summary} onChange={e => update("summary", e.target.value)} rows={4}
                  placeholder={`Results-driven ${resume.targetRole} with 3+ years experience building scalable applications...`}
                  className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/40 resize-none placeholder:text-slate-700"/>
              </div>
            </div>
          )}

          {/* Experience */}
          <SectionHeader id="experience" icon={<Briefcase size={14}/>} title="Work Experience"/>
          {activeSection === "experience" && (
            <div className="space-y-3">
              {resume.experience.map((exp, ei) => (
                <div key={exp.id} className="glass rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400">Experience {ei + 1}</p>
                    {resume.experience.length > 1 && (
                      <button onClick={() => update("experience", resume.experience.filter(e => e.id !== exp.id))}
                        className="text-red-400 hover:text-red-300 p-1 rounded">
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Job Title *" value={exp.role}
                      onChange={(v: string) => update("experience", resume.experience.map(e => e.id===exp.id?{...e,role:v}:e))}
                      placeholder="Software Engineer"/>
                    <Input label="Company *" value={exp.company}
                      onChange={(v: string) => update("experience", resume.experience.map(e => e.id===exp.id?{...e,company:v}:e))}
                      placeholder="Google"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Location" value={exp.location}
                      onChange={(v: string) => update("experience", resume.experience.map(e => e.id===exp.id?{...e,location:v}:e))}
                      placeholder="Bangalore"/>
                    <Input label="Start Date" value={exp.startDate}
                      onChange={(v: string) => update("experience", resume.experience.map(e => e.id===exp.id?{...e,startDate:v}:e))}
                      placeholder="Jan 2022"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="End Date" value={exp.endDate}
                      onChange={(v: string) => update("experience", resume.experience.map(e => e.id===exp.id?{...e,endDate:v}:e))}
                      placeholder="Present"/>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={exp.current}
                          onChange={ev => update("experience", resume.experience.map(e => e.id===exp.id?{...e,current:ev.target.checked}:e))}
                          className="rounded"/>
                        Currently working here
                      </label>
                    </div>
                  </div>
                  {/* Bullets */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Bullet Points (use numbers/metrics)</p>
                    {exp.bullets.map((b, bi) => (
                      <div key={bi} className="flex gap-2 mb-1.5">
                        <input value={b}
                          onChange={ev => update("experience", resume.experience.map(e => e.id===exp.id?{...e,bullets:e.bullets.map((bv,i)=>i===bi?ev.target.value:bv)}:e))}
                          placeholder={`• Improved system performance by 40%...`}
                          className="flex-1 bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500/40 placeholder:text-slate-700"/>
                        <button onClick={() => aiEnhance("bullet", exp.id, bi)}
                          disabled={aiLoading === "bullet"+exp.id}
                          title="AI enhance this bullet"
                          className="shrink-0 text-brand-400 hover:text-brand-300 disabled:opacity-50 p-1.5 glass rounded-lg border border-white/5">
                          {aiLoading === "bullet"+exp.id ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                        </button>
                      </div>
                    ))}
                    <button onClick={() => update("experience", resume.experience.map(e => e.id===exp.id?{...e,bullets:[...e.bullets,""]}:e))}
                      className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-1">
                      <Plus size={11}/>Add bullet
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => update("experience", [...resume.experience, { id:uid(), company:"", role:"", location:"", startDate:"", endDate:"", current:false, bullets:["","",""] }])}
                className="w-full glass border border-dashed border-white/10 hover:border-brand-500/30 rounded-xl py-2.5 text-sm text-slate-500 hover:text-brand-400 transition-all flex items-center justify-center gap-2">
                <Plus size={14}/>Add Experience
              </button>
            </div>
          )}

          {/* Education */}
          <SectionHeader id="education" icon={<GraduationCap size={14}/>} title="Education"/>
          {activeSection === "education" && (
            <div className="space-y-3">
              {resume.education.map((edu, ei) => (
                <div key={edu.id} className="glass rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400">Education {ei + 1}</p>
                    {resume.education.length > 1 && (
                      <button onClick={() => update("education", resume.education.filter(e => e.id !== edu.id))}
                        className="text-red-400 p-1 rounded"><Trash2 size={13}/></button>
                    )}
                  </div>
                  <Input label="Institution *" value={edu.institution}
                    onChange={(v: string) => update("education", resume.education.map(e => e.id===edu.id?{...e,institution:v}:e))}
                    placeholder="IIT Bombay / Pune University"/>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Degree" value={edu.degree}
                      onChange={(v: string) => update("education", resume.education.map(e => e.id===edu.id?{...e,degree:v}:e))}
                      placeholder="B.Tech / B.E. / MCA"/>
                    <Input label="Field of Study" value={edu.field}
                      onChange={(v: string) => update("education", resume.education.map(e => e.id===edu.id?{...e,field:v}:e))}
                      placeholder="Computer Science"/>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="Start" value={edu.startDate}
                      onChange={(v: string) => update("education", resume.education.map(e => e.id===edu.id?{...e,startDate:v}:e))}
                      placeholder="2018"/>
                    <Input label="End" value={edu.endDate}
                      onChange={(v: string) => update("education", resume.education.map(e => e.id===edu.id?{...e,endDate:v}:e))}
                      placeholder="2022"/>
                    <Input label="Grade / GPA" value={edu.grade}
                      onChange={(v: string) => update("education", resume.education.map(e => e.id===edu.id?{...e,grade:v}:e))}
                      placeholder="8.5 CGPA"/>
                  </div>
                </div>
              ))}
              <button onClick={() => update("education", [...resume.education, { id:uid(), institution:"", degree:"", field:"", startDate:"", endDate:"", grade:"" }])}
                className="w-full glass border border-dashed border-white/10 hover:border-brand-500/30 rounded-xl py-2.5 text-sm text-slate-500 hover:text-brand-400 transition-all flex items-center justify-center gap-2">
                <Plus size={14}/>Add Education
              </button>
            </div>
          )}

          {/* Skills */}
          <SectionHeader id="skills" icon={<Code2 size={14}/>} title="Skills"/>
          {activeSection === "skills" && (
            <div className="glass rounded-xl p-4 border border-white/5 space-y-3">
              <p className="text-xs text-slate-500">List skills separated by commas — ATS reads these keywords</p>
              {resume.skills.map((s, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-start">
                  <select value={s.category}
                    onChange={e => update("skills", resume.skills.map((sk,j)=>j===i?{...sk,category:e.target.value}:sk))}
                    className="bg-dark-900 border border-white/8 rounded-lg px-2 py-2 text-xs text-white focus:outline-none">
                    {SKILL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input value={s.items} className="col-span-2 bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500/40 placeholder:text-slate-700"
                    placeholder="Python, JavaScript, React, Node.js"
                    onChange={e => update("skills", resume.skills.map((sk,j)=>j===i?{...sk,items:e.target.value}:sk))}/>
                </div>
              ))}
              <button onClick={() => update("skills", [...resume.skills, { category: "Databases", items: "" }])}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                <Plus size={11}/>Add skill category
              </button>
            </div>
          )}

          {/* Projects */}
          <SectionHeader id="projects" icon={<Code2 size={14}/>} title="Projects"/>
          {activeSection === "projects" && (
            <div className="space-y-3">
              {resume.projects.map((p, pi) => (
                <div key={p.id} className="glass rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400">Project {pi + 1}</p>
                    <button onClick={() => update("projects", resume.projects.filter(pr => pr.id !== p.id))}
                      className="text-red-400 p-1 rounded"><Trash2 size={13}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Project Name" value={p.name}
                      onChange={(v: string) => update("projects", resume.projects.map(pr => pr.id===p.id?{...pr,name:v}:pr))}
                      placeholder="E-commerce Platform"/>
                    <Input label="Live Link" value={p.link}
                      onChange={(v: string) => update("projects", resume.projects.map(pr => pr.id===p.id?{...pr,link:v}:pr))}
                      placeholder="github.com/pranay/project"/>
                  </div>
                  <Input label="Technologies Used" value={p.tech}
                    onChange={(v: string) => update("projects", resume.projects.map(pr => pr.id===p.id?{...pr,tech:v}:pr))}
                    placeholder="React, Node.js, MongoDB, AWS"/>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Description</label>
                    <textarea value={p.description} rows={2}
                      onChange={e => update("projects", resume.projects.map(pr => pr.id===p.id?{...pr,description:e.target.value}:pr))}
                      placeholder="Built a full-stack platform that handles 10K+ daily users..."
                      className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500/40 resize-none placeholder:text-slate-700"/>
                  </div>
                </div>
              ))}
              <button onClick={() => update("projects", [...resume.projects, { id:uid(), name:"", description:"", tech:"", link:"" }])}
                className="w-full glass border border-dashed border-white/10 hover:border-brand-500/30 rounded-xl py-2.5 text-sm text-slate-500 hover:text-brand-400 transition-all flex items-center justify-center gap-2">
                <Plus size={14}/>Add Project
              </button>
            </div>
          )}

          {/* Certifications */}
          <SectionHeader id="certs" icon={<Award size={14}/>} title="Certifications"/>
          {activeSection === "certs" && (
            <div className="space-y-3">
              {resume.certifications.map((c, ci) => (
                <div key={c.id} className="glass rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-slate-400">Certification {ci + 1}</p>
                    <button onClick={() => update("certifications", resume.certifications.filter(cert => cert.id !== c.id))}
                      className="text-red-400 p-1 rounded"><Trash2 size={13}/></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Name" className="col-span-1" value={c.name}
                      onChange={(v: string) => update("certifications", resume.certifications.map(cert => cert.id===c.id?{...cert,name:v}:cert))}
                      placeholder="AWS Solutions Architect"/>
                    <Input label="Issuer" value={c.issuer}
                      onChange={(v: string) => update("certifications", resume.certifications.map(cert => cert.id===c.id?{...cert,issuer:v}:cert))}
                      placeholder="Amazon"/>
                    <Input label="Date" value={c.date}
                      onChange={(v: string) => update("certifications", resume.certifications.map(cert => cert.id===c.id?{...cert,date:v}:cert))}
                      placeholder="2024"/>
                  </div>
                </div>
              ))}
              <button onClick={() => update("certifications", [...resume.certifications, { id:uid(), name:"", issuer:"", date:"" }])}
                className="w-full glass border border-dashed border-white/10 hover:border-brand-500/30 rounded-xl py-2.5 text-sm text-slate-500 hover:text-brand-400 transition-all flex items-center justify-center gap-2">
                <Plus size={14}/>Add Certification
              </button>
            </div>
          )}
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 overflow-y-auto bg-slate-200 p-6">
          <div className="max-w-[700px] mx-auto bg-white shadow-2xl rounded-lg overflow-hidden"
            style={{ minHeight: "900px", fontFamily: "Arial, sans-serif" }}>

            {/* Preview Header */}
            {template !== "minimal" ? (
              <div style={{ background: TEMPLATES.find(t=>t.id===template)?.color || "#6366f1", padding:"24px 28px 20px" }}>
                <h1 style={{ color:"#fff", fontSize:24, fontWeight:700, margin:0 }}>{resume.fullName || "Your Name"}</h1>
                <p style={{ color:"rgba(255,255,255,0.85)", fontSize:13, margin:"4px 0 0" }}>{resume.targetRole}</p>
                <div style={{ display:"flex", gap:16, marginTop:8, flexWrap:"wrap" }}>
                  {[resume.email, resume.phone, resume.location].filter(Boolean).map((c,i) => (
                    <span key={i} style={{ color:"rgba(255,255,255,0.75)", fontSize:11 }}>{c}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign:"center", padding:"24px 28px 12px", borderBottom:"2px solid #e5e7eb" }}>
                <h1 style={{ color:"#111", fontSize:24, fontWeight:700, margin:0 }}>{resume.fullName || "Your Name"}</h1>
                <p style={{ color:"#6b7280", fontSize:13, margin:"4px 0" }}>{resume.targetRole}</p>
                <p style={{ color:"#9ca3af", fontSize:11 }}>
                  {[resume.email, resume.phone, resume.location, resume.linkedin].filter(Boolean).join(" · ")}
                </p>
              </div>
            )}

            <div style={{ padding:"20px 28px" }}>
              {/* Summary */}
              {resume.summary && (
                <Section title="Professional Summary" color={TEMPLATES.find(t=>t.id===template)?.color || "#6366f1"}>
                  <p style={{ color:"#374151", fontSize:12, lineHeight:1.6, margin:0 }}>{resume.summary}</p>
                </Section>
              )}

              {/* Experience */}
              {resume.experience.filter(e => e.company || e.role).length > 0 && (
                <Section title="Work Experience" color={TEMPLATES.find(t=>t.id===template)?.color || "#6366f1"}>
                  {resume.experience.filter(e => e.company || e.role).map(exp => (
                    <div key={exp.id} style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                        <strong style={{ fontSize:13, color:"#111" }}>{exp.role || "Role"}</strong>
                        <span style={{ fontSize:11, color:"#9ca3af" }}>
                          {exp.startDate}{exp.startDate ? " – " : ""}{exp.current ? "Present" : exp.endDate}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color: TEMPLATES.find(t=>t.id===template)?.color || "#6366f1", fontWeight:600, marginBottom:4 }}>
                        {exp.company}{exp.location ? ` · ${exp.location}` : ""}
                      </div>
                      {exp.bullets.filter(Boolean).map((b,i) => (
                        <div key={i} style={{ fontSize:11.5, color:"#374151", marginBottom:2 }}>• {b}</div>
                      ))}
                    </div>
                  ))}
                </Section>
              )}

              {/* Education */}
              {resume.education.filter(e => e.institution).length > 0 && (
                <Section title="Education" color={TEMPLATES.find(t=>t.id===template)?.color || "#6366f1"}>
                  {resume.education.filter(e => e.institution).map(edu => (
                    <div key={edu.id} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <strong style={{ fontSize:13, color:"#111" }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</strong>
                        <span style={{ fontSize:11, color:"#9ca3af" }}>{edu.startDate}{edu.startDate&&edu.endDate?" – ":""}{edu.endDate}</span>
                      </div>
                      <div style={{ fontSize:12, color: TEMPLATES.find(t=>t.id===template)?.color || "#6366f1" }}>
                        {edu.institution}{edu.grade ? ` · ${edu.grade}` : ""}
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {/* Skills */}
              {resume.skills.filter(s => s.items).length > 0 && (
                <Section title="Skills" color={TEMPLATES.find(t=>t.id===template)?.color || "#6366f1"}>
                  {resume.skills.filter(s => s.items).map((s,i) => (
                    <div key={i} style={{ fontSize:12, color:"#374151", marginBottom:4 }}>
                      <strong>{s.category}:</strong> {s.items}
                    </div>
                  ))}
                </Section>
              )}

              {/* Projects */}
              {resume.projects.filter(p => p.name).length > 0 && (
                <Section title="Projects" color={TEMPLATES.find(t=>t.id===template)?.color || "#6366f1"}>
                  {resume.projects.filter(p => p.name).map(p => (
                    <div key={p.id} style={{ marginBottom:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <strong style={{ fontSize:13, color:"#111" }}>{p.name}</strong>
                        {p.link && <span style={{ fontSize:10, color: TEMPLATES.find(t=>t.id===template)?.color }}>{p.link}</span>}
                      </div>
                      {p.tech && <div style={{ fontSize:11, color:"#9ca3af", marginBottom:3, fontStyle:"italic" }}>Tech: {p.tech}</div>}
                      {p.description && <div style={{ fontSize:11.5, color:"#374151" }}>{p.description}</div>}
                    </div>
                  ))}
                </Section>
              )}

              {/* Certifications */}
              {resume.certifications.filter(c => c.name).length > 0 && (
                <Section title="Certifications" color={TEMPLATES.find(t=>t.id===template)?.color || "#6366f1"}>
                  {resume.certifications.filter(c => c.name).map(c => (
                    <div key={c.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"#374151" }}>• {c.name} — {c.issuer}</span>
                      <span style={{ fontSize:11, color:"#9ca3af" }}>{c.date}</span>
                    </div>
                  ))}
                </Section>
              )}
            </div>
          </div>

          {/* ATS tips */}
          <div className="max-w-[700px] mx-auto mt-4 glass rounded-xl p-4 border border-white/5">
            <p className="text-xs font-medium text-brand-400 mb-2">✅ ATS Optimization Tips</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                "Use keywords from the job description",
                "Quantify achievements with numbers",
                "Avoid tables, images, or headers",
                "Use standard section names",
                "Download TXT format for best ATS score",
                "Keep to 1-2 pages maximum",
              ].map((t,i) => (
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

// ── Preview Section Component ──────────────────────────────────────────────
function Section({ title, color, children }: { title: string; color: string; children: any }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color, textTransform:"uppercase", letterSpacing:1 }}>{title}</span>
        <div style={{ flex:1, height:1, background:color, opacity:0.4 }}/>
      </div>
      {children}
    </div>
  );
}

// ── Hex to RGB ─────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}
