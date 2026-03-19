"use client";
import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

interface QA {
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

interface Props {
  role: string;
  company: string;
  agentType: string;
  level: string;
  overallScore: number;
  summary: any;
  qaHistory: QA[];
  date?: string;
}

export default function InterviewPDF(props: Props) {
  const [loading, setLoading] = useState(false);

  const generatePDF = async () => {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const margin = 20;
      let y = 20;

      const addText = (text: string, x: number, size: number, color: [number,number,number] = [255,255,255], bold = false) => {
        doc.setFontSize(size);
        doc.setTextColor(...color);
        if (bold) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");
        doc.text(text, x, y);
      };

      const newPage = () => {
        doc.addPage();
        y = 20;
        // Dark background on each page
        doc.setFillColor(10, 10, 15);
        doc.rect(0, 0, W, 297, "F");
      };

      // Dark background
      doc.setFillColor(10, 10, 15);
      doc.rect(0, 0, W, 297, "F");

      // Header bar
      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, W, 40, "F");

      // Title
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("InterviewAI", margin, 16);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Mock Interview Performance Report", margin, 24);
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 255);
      doc.text(props.date || new Date().toLocaleDateString("en-IN"), W - margin, 16, { align: "right" });

      y = 55;

      // Score box
      const scoreColor: [number,number,number] = props.overallScore >= 7 ? [16,185,129] : props.overallScore >= 5 ? [245,158,11] : [239,68,68];
      doc.setFillColor(30, 30, 45);
      doc.roundedRect(margin, y, W - margin*2, 36, 4, 4, "F");
      doc.setFontSize(32);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...scoreColor);
      doc.text(`${props.overallScore.toFixed(1)}/10`, margin + 10, y + 22);
      doc.setFontSize(11);
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "normal");
      doc.text("Overall Score", margin + 10, y + 32);

      // Details column
      doc.setFontSize(10);
      const details = [
        `Role: ${props.role}`,
        `Company: ${props.company || "General"}`,
        `Type: ${props.agentType.replace("_"," ")}`,
        `Level: ${props.level}`,
      ];
      details.forEach((d, i) => {
        doc.setTextColor(226, 232, 240);
        doc.text(d, W/2 + 10, y + 10 + i * 7);
      });

      y += 46;

      // Summary section
      if (props.summary?.performance_summary) {
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(99, 102, 241);
        doc.text("Performance Summary", margin, y);
        y += 7;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        const summaryLines = doc.splitTextToSize(
          typeof props.summary.performance_summary === "string"
            ? props.summary.performance_summary
            : "See detailed feedback below.",
          W - margin * 2
        );
        summaryLines.forEach((line: string) => {
          if (y > 270) newPage();
          doc.text(line, margin, y);
          y += 5;
        });
        y += 5;
      }

      // Strengths
      if (props.summary?.top_strengths?.length) {
        if (y > 260) newPage();
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129);
        doc.text("✓ Strengths", margin, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        props.summary.top_strengths.forEach((s: string) => {
          if (y > 275) newPage();
          doc.text(`• ${s}`, margin + 3, y);
          y += 5;
        });
        y += 4;
      }

      // Areas to improve
      if (props.summary?.areas_to_improve?.length) {
        if (y > 260) newPage();
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(245, 158, 11);
        doc.text("→ Areas to Improve", margin, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        props.summary.areas_to_improve.forEach((s: string) => {
          if (y > 275) newPage();
          doc.text(`• ${s}`, margin + 3, y);
          y += 5;
        });
        y += 6;
      }

      // Q&A section
      if (props.qaHistory?.length) {
        if (y > 240) newPage();
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(99, 102, 241);
        doc.text("Question by Question Review", margin, y);
        y += 8;

        props.qaHistory.forEach((qa, i) => {
          if (y > 240) newPage();

          const qColor: [number,number,number] = qa.score >= 7 ? [16,185,129] : qa.score >= 5 ? [245,158,11] : [239,68,68];
          doc.setFillColor(20, 20, 35);
          doc.roundedRect(margin, y - 4, W - margin*2, 4, 1, 1, "F");

          // Q number + score
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255,255,255);
          doc.text(`Q${i+1}`, margin, y + 3);
          doc.setTextColor(...qColor);
          doc.text(`${qa.score.toFixed(1)}/10`, W - margin, y + 3, { align:"right" });

          y += 8;

          // Question
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(226, 232, 240);
          const qLines = doc.splitTextToSize(qa.question, W - margin*2);
          qLines.slice(0, 3).forEach((l: string) => {
            if (y > 275) newPage();
            doc.text(l, margin, y);
            y += 5;
          });

          // Feedback
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100, 116, 139);
          const fLines = doc.splitTextToSize(`Feedback: ${qa.feedback}`, W - margin*2);
          fLines.slice(0, 3).forEach((l: string) => {
            if (y > 275) newPage();
            doc.text(l, margin, y);
            y += 4.5;
          });

          y += 4;
        });
      }

      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`InterviewAI • ${APP_URL} • Page ${p}/${totalPages}`, W/2, 290, { align:"center" });
      }

      doc.save(`InterviewAI_${props.role.replace(/\s/g,"_")}_${props.overallScore.toFixed(1)}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={generatePDF} disabled={loading}
      className="flex items-center gap-2 glass border border-white/10 hover:bg-white/5 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
      {loading ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
      {loading ? "Generating PDF…" : "Download PDF Report"}
    </button>
  );
}

const APP_URL = "https://interviewai-beta-one.vercel.app";
