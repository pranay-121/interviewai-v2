"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Plus, Trash2, Download, FileText,
  Briefcase, GraduationCap, Code2, Award, User,
  Sparkles, Loader2, Eye, EyeOff
} from "lucide-react";
import api from "@/lib/api";

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

const TARGET_ROLES = [
  "Software Engineer","Senior Software Engineer","Staff Engineer",
  "Frontend Engineer","Backend Engineer","Full Stack Engineer",
  "Mobile Engineer","DevOps Engineer","Data Scientist","ML Engineer",
  "AI Engineer","Data Engineer","Product Manager","Engineering Manager",
  "Business Analyst","SAP Consultant","SAP Basis","SAP ABAP Developer",
  "QA Engineer","Security Engineer","UX Designer","Solutions Architect",
];

const TEMPLATES = [
  { id:"modern",       label:"Modern",       color:"#6366f1", desc:"Clean & professional" },
  { id:"minimal",      label:"Minimal",      color:"#10b981", desc:"ATS optimized" },
  { id:"professional", label:"Professional", color:"#3b82f6", desc:"Traditional" },
];

const uid = () => Math.random().toString(36).slice(2,8);

const EMPTY: ResumeData = {
  fullName:"", email:"", phone:"", location:"",
  website:"", linkedin:"", github:"", summary:"",
  targetRole:"Software Engineer",
  experience:[{ id:uid(), company:"", role:"", location:"", startDate:"", endDate:"", current:false, bullets:["","",""] }],
  education:[{ id:uid(), institution:"", degree:"", field:"", startDate:"", endDate:"", grade:"" }],
  skills:[
    { category:"Programming Languages", items:"" },
    { category:"Frameworks & Libraries", items:"" },
    { category:"Tools & Platforms", items:"" },
  ],
  projects:[{ id:uid(), name:"", description:"", tech:"", link:"" }],
  certifications:[],
};

function hexToRgb(hex: string) {
  return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16) };
}

export default function ResumeBuilderPage() {
  const router = useRouter();
  const [resume, setResume] = useState<ResumeData>(EMPTY);
  const [template, setTemplate] = useState("modern");
  const [activeSection, setActiveSection] = useState("personal");
  const [downloading, setDownloading] = useState(false);
  const [aiLoading, setAiLoading] = useState<string|null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const update = (field: keyof ResumeData, val: any) =>
    setResume(p => ({ ...p, [field]: val }));

  const aiEnhance = async (type: "summary"|"bullet", expId?: string, bulletIdx?: number) => {
    setAiLoading(type+(expId||""));
    try {
      const exp = resume.experience.find(e => e.id === expId);
      const prompt = type === "summary"
        ? `Write a 3-sentence ATS-friendly professional summary for a ${resume.targetRole}. Companies: ${resume.experience.map(e=>e.company).filter(Boolean).join(", ")}. Return ONLY the summary text, no quotes.`
        : `Improve this resume bullet for ${exp?.role} at ${exp?.company}: "${exp?.bullets[bulletIdx!]||"developed features"}". Use action verb + metric. Return ONLY the bullet, no quotes.`;
      const { data } = await api.post("/agents/quick-question", {
        agent_type: "hr", job_role: prompt, experience_level: "mid", company: "",
      });
      const text = typeof data.question === "string"
        ? data.question
        : data.question?.problem || data.question?.title || "";
      if (type === "summary") update("summary", text.slice(0,500));
      else if (expId && bulletIdx !== undefined) {
        update("experience", resume.experience.map(e =>
          e.id===expId ? {...e, bullets:e.bullets.map((b,i)=>i===bulletIdx?text.slice(0,200):b)} : e
        ));
      }
    } catch {}
    finally { setAiLoading(null); }
  };

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
        doc.splitTextToSize(resume.summary, usableW).forEach((l:string)=>{ checkY(); doc.text(l,margin,y); y+=4.5; });
        y+=3;
      }
      resume.experience.filter(e=>e.company||e.role).forEach(e => {
        if (!e.company && !e.role) return;
        checkY(12);
        if (resume.experience.filter(x=>x.company||x.role).indexOf(e)===0) section("Work Experience");
        doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
        doc.text(e.role||"Role", margin, y);
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
        doc.text(`${e.startDate}${e.startDate?" – ":""}${e.current?"Present":e.endDate}`, W-margin, y, {align:"right"});
        y+=5;
        doc.setFontSize(9.5); doc.setFont("helvetica","bold"); doc.setTextColor(rgb.r,rgb.g,rgb.b);
        doc.text(`${e.company}${e.location?" · "+e.location:""}`, margin, y); y+=5;
        e.bullets.filter(Boolean).forEach(b => {
          checkY(); doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
          doc.splitTextToSize(`• ${b}`, usableW-3).forEach((bl:string)=>{ doc.text(bl,margin+2,y); y+=4; });
        });
        y+=3;
      });
      resume.education.filter(e=>e.institution||e.degree).forEach((e,ei) => {
        if (ei===0) section("Education");
        checkY(10);
        doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
        doc.text(`${e.degree}${e.field?" in "+e.field:""}`, margin, y);
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
        doc.text(`${e.startDate}${e.startDate&&e.endDate?" – ":""}${e.endDate}`, W-margin, y, {align:"right"});
        y+=5;
        doc.setFontSize(9); doc.setTextColor(rgb.r,rgb.g,rgb.b);
        doc.text(`${e.institution}${e.grade?" · "+e.grade:""}`, margin, y); y+=6;
      });
      const skills = resume.skills.filter(s=>s.items.trim());
      if (skills.length) {
        section("Skills");
        skills.forEach(s => {
          checkY(); doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(50,50,50);
          const lw = doc.getTextWidth(`${s.category}: `);
          doc.text(`${s.category}: `, margin, y);
          doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
          const lines = doc.splitTextToSize(s.items, usableW-lw-2);
          doc.text(lines[0]||"", margin+lw, y); y+=4.5;
          lines.slice(1).forEach((l:string)=>{ doc.text(l,margin,y); y+=4.5; });
        });
        y+=2;
      }
      resume.projects.filter(p=>p.name).forEach((p,pi) => {
        if (pi===0) section("Projects");
        checkY(10);
        doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
        doc.text(p.name, margin, y);
        if (p.link) { doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(rgb.r,rgb.g,rgb.b); doc.text(p.link,W-margin,y,{align:"right"}); }
        y+=5;
        if (p.tech) { doc.setFontSize(8.5); doc.setFont("helvetica","italic"); doc.setTextColor(rgb.r,rgb.g,rgb.b); doc.text(`Tech: ${p.tech}`,margin,y); y+=4; }
        if (p.description) {
          doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(60,60,60);
          doc.splitTextToSize(p.description,usableW).forEach((l:string)=>{ checkY(); doc.text(l,margin,y); y+=4; });
        }
        y+=3;
      });
      resume.certifications.filter(c=>c.name).forEach((c,ci) => {
        if (ci===0) section("Certifications");
        checkY(); doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(50,50,50);
        doc.text(`• ${c.name}`, margin, y);
        doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
        doc.text(`${c.issuer}${c.date?" · "+c.date:""}`, W-margin, y, {align:"right"});
        y+=5;
      });
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
      lines.push(`${e.role} | ${e.company}`);
      lines.push(`${e.startDate} - ${e.current?"Present":e.endDate}`);
      e.bullets.filter(Boolean).forEach(b=>lines.push(`• ${b}`));
      lines.push("");
    });
    resume.education.filter(e=>e.institution).forEach(e => {
      lines.push(`${e.degree} in ${e.field} | ${e.institution}`);
      lines.push(`${e.startDate} - ${e.endDate}${e.grade?" | "+e.grade:""}`);
      lines.push("");
    });
    resume.skills.filter(s=>s.items).forEach(s=>lines.push(`${s.category}: ${s.items}`));
    const blob = new Blob([lines.join("\n")], {type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`${(resume.fullName||"Resume").replace(/\s/g,"_")}_ATS.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const Input = ({label,value,onChange,placeholder="",className=""}: any) => (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder}
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

  const tplColor = TEMPLATES.find(t=>t.id===template)?.color||"#6366f1";

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <div className="glass border-b border-white/5 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/dashboard")} className="text-slate-400 hover:text-white">
            <ChevronLeft size={20}/>
          </button>
          <div>
            <h1 className="font-bold text-sm">AI Resume Builder</h1>
            <p className="text-xs text-slate-500">ATS-optimized · 3 templates · AI-enhanced</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${showPreview?"bg-brand-600/20 border-brand-500/30 text-brand-400":"glass border-white/10 text-slate-400"}`}>
            {showPreview?<EyeOff size={12}/>:<Eye size={12}/>}{showPreview?"Edit":"Preview"}
          </button>
          <button onClick={downloadTXT}
            className="flex items-center gap-1.5 glass border border-white/10 px-3 py-2 rounded-lg text-xs text-slate-300">
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
        {/* Editor */}
        <div className={`${showPreview?"hidden md:flex":"flex"} flex-col w-full md:w-[460px] shrink-0 overflow-y-auto border-r border-white/5 p-4 space-y-2.5`}>

          {/* Template */}
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Template</p>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map(t=>(
                <button key={t.id} onClick={()=>setTemplate(t.id)}
                  className={`p-2.5 rounded-xl border text-xs transition-all ${template===t.id?"border-brand-500/50 bg-brand-600/10":"border-white/8 hover:border-white/15"}`}>
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
                <Input label="Phone" value={resume.phone} onChange={(v:string)=>update("phone",v)} placeholder="+91 9876543210"/>
              </div>
              <Input label="Location" value={resume.location} onChange={(v:string)=>update("location",v)} placeholder="Pune, Maharashtra"/>
              <div className="grid grid-cols-2 gap-3">
                <Input label="LinkedIn" value={resume.linkedin} onChange={(v:string)=>update("linkedin",v)} placeholder="linkedin.com/in/pranay"/>
                <Input label="GitHub" value={resume.github} onChange={(v:string)=>update("github",v)} placeholder="github.com/pranay"/>
              </div>
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
                  className="w-full bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none placeholder:text-slate-700"/>
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
                    {resume.experience.length>1&&<button onClick={()=>update("experience",resume.experience.filter(e=>e.id!==exp.id))} className="text-red-400 p-1"><Trash2 size={12}/></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Job Title" value={exp.role} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,role:v}:e))} placeholder="Software Engineer"/>
                    <Input label="Company" value={exp.company} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,company:v}:e))} placeholder="Google"/>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Location" value={exp.location} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,location:v}:e))} placeholder="Bangalore"/>
                    <Input label="Start" value={exp.startDate} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,startDate:v}:e))} placeholder="Jan 2022"/>
                    <Input label="End" value={exp.endDate} onChange={(v:string)=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,endDate:v}:e))} placeholder="Dec 2024"/>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={exp.current} onChange={ev=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,current:ev.target.checked}:e))} className="rounded"/>
                    Currently working here
                  </label>
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Bullet points</p>
                    {exp.bullets.map((b,bi)=>(
                      <div key={bi} className="flex gap-2 mb-1.5">
                        <input value={b} onChange={ev=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,bullets:e.bullets.map((bv,i)=>i===bi?ev.target.value:bv)}:e))}
                          placeholder="• Improved performance by 40%..."
                          className="flex-1 bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-slate-700"/>
                        <button onClick={()=>aiEnhance("bullet",exp.id,bi)} disabled={!!aiLoading}
                          className="shrink-0 text-brand-400 p-1.5 glass rounded-lg border border-white/5 disabled:opacity-50">
                          {aiLoading==="bullet"+exp.id?<Loader2 size={10} className="animate-spin"/>:<Sparkles size={10}/>}
                        </button>
                      </div>
                    ))}
                    <button onClick={()=>update("experience",resume.experience.map(e=>e.id===exp.id?{...e,bullets:[...e.bullets,""]}:e))}
                      className="text-xs text-brand-400 flex items-center gap-1 mt-1">
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
                  <Input label="Institution" value={edu.institution} onChange={(v:string)=>update("education",resume.education.map(e=>e.id===edu.id?{...e,institution:v}:e))} placeholder="IIT Bombay"/>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Degree" value={edu.degree} onChange={(v:string)=>update("education",resume.education.map(e=>e.id===edu.id?{...e,degree:v}:e))} placeholder="B.Tech"/>
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
              <p className="text-xs text-slate-500">Comma-separated — ATS reads these as keywords</p>
              {resume.skills.map((s,i)=>(
                <div key={i} className="grid grid-cols-3 gap-2">
                  <input value={s.category} onChange={e=>update("skills",resume.skills.map((sk,j)=>j===i?{...sk,category:e.target.value}:sk))}
                    className="bg-dark-900 border border-white/8 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"/>
                  <input value={s.items} className="col-span-2 bg-dark-900 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-slate-700"
                    placeholder="Python, React, Node.js" onChange={e=>update("skills",resume.skills.map((sk,j)=>j===i?{...sk,items:e.target.value}:sk))}/>
                </div>
              ))}
              <button onClick={()=>update("skills",[...resume.skills,{category:"Other",items:""}])}
                className="text-xs text-brand-400 flex items-center gap-1">
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
                    <Input label="Name" value={p.name} onChange={(v:string)=>update("projects",resume.projects.map(pr=>pr.id===p.id?{...pr,name:v}:pr))} placeholder="E-commerce App"/>
                    <Input label="Link" value={p.link} onChange={(v:string)=>update("projects",resume.projects.map(pr=>pr.id===p.id?{...pr,link:v}:pr))} placeholder="github.com/user/project"/>
                  </div>
                  <Input label="Tech Stack" value={p.tech} onChange={(v:string)=>update("projects",resume.projects.map(pr=>pr.id===p.id?{...pr,tech:v}:pr))} placeholder="React, Node.js, MongoDB"/>
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
                      placeholder="AWS Solutions Architect" className="bg-dark-900 border border-white/8 rounded-lg px-2 py-2 text-xs text-white focus:outline-none placeholder:text-slate-700"/>
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

        {/* Preview */}
        <div className="flex-1 overflow-y-auto bg-slate-200 p-6">
          <div className="max-w-[680px] mx-auto bg-white shadow-2xl rounded-lg overflow-hidden" style={{minHeight:"900px",fontFamily:"Arial,sans-serif"}}>
            {template!=="minimal" ? (
              <div style={{background:tplColor,padding:"24px 28px 20px"}}>
                <h1 style={{color:"#fff",fontSize:22,fontWeight:700,margin:0}}>{resume.fullName||"Your Name"}</h1>
                <p style={{color:"rgba(255,255,255,0.85)",fontSize:12,margin:"4px 0 0"}}>{resume.targetRole}</p>
                <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
                  {[resume.email,resume.phone,resume.location].filter(Boolean).map((c,i)=>(
                    <span key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:10}}>{c}</span>
                  ))}
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
              {resume.summary&&(
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:10,fontWeight:700,color:tplColor,textTransform:"uppercase",letterSpacing:1}}>Professional Summary</span>
                    <div style={{flex:1,height:1,background:tplColor,opacity:0.3}}/>
                  </div>
                  <p style={{color:"#374151",fontSize:11,lineHeight:1.6,margin:0}}>{resume.summary}</p>
                </div>
              )}
              {resume.experience.filter(e=>e.company||e.role).length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:tplColor,textTransform:"uppercase",letterSpacing:1}}>Work Experience</span>
                    <div style={{flex:1,height:1,background:tplColor,opacity:0.3}}/>
                  </div>
                  {resume.experience.filter(e=>e.company||e.role).map(exp=>(
                    <div key={exp.id} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <strong style={{fontSize:12,color:"#111"}}>{exp.role}</strong>
                        <span style={{fontSize:10,color:"#9ca3af"}}>{exp.startDate}{exp.startDate?" – ":""}{exp.current?"Present":exp.endDate}</span>
                      </div>
                      <div style={{fontSize:11,color:tplColor,fontWeight:600,marginBottom:3}}>{exp.company}{exp.location?" · "+exp.location:""}</div>
                      {exp.bullets.filter(Boolean).map((b,i)=><div key={i} style={{fontSize:10.5,color:"#374151",marginBottom:2}}>• {b}</div>)}
                    </div>
                  ))}
                </div>
              )}
              {resume.education.filter(e=>e.institution).length>0&&(
                <div style={{marginBottom:14}}>
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
              {resume.skills.filter(s=>s.items).length>0&&(
                <div style={{marginBottom:14}}>
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
              {resume.projects.filter(p=>p.name).length>0&&(
                <div style={{marginBottom:14}}>
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
          <div className="max-w-[680px] mx-auto mt-4 glass rounded-xl p-4 border border-white/5">
            <p className="text-xs font-medium text-brand-400 mb-2">✅ ATS Tips</p>
            <div className="grid grid-cols-2 gap-1.5">
              {["Use keywords from job description","Quantify with numbers/metrics","Standard section names","Download TXT for best ATS score","No tables or images","Keep to 1-2 pages"].map((t,i)=>(
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
