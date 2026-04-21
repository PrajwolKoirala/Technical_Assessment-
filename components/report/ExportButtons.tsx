"use client";

import { useState } from "react";
import { SearchResult } from "@/types";
import { Download, FileText, Loader2 } from "lucide-react";

export function ExportButtons({ result }: { result: SearchResult }) {
  const [loading, setLoading] = useState<"md" | "pdf" | null>(null);

  async function exportMarkdown() {
    setLoading("md");
    try {
      const res = await fetch(`/api/report/${result.id}?format=markdown`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `osint-report-${result.entity.name.replace(/\s+/g, "-")}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }

  async function exportPdf() {
    setLoading("pdf");
    try {
      const res = await fetch(`/api/report/${result.id}?format=json`);
      const { data } = await res.json();
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const margin = 15;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let y = margin;

      function checkPage(needed = 8) {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      }

      // Cover
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, pageH, "F");

      doc.setTextColor(6, 182, 212);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("OSINT Intelligence Report", margin, 40);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(11);
      doc.text(`Target: ${result.entity.name}`, margin, 55);
      doc.text(`Type: ${result.entity.type}`, margin, 62);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 69);
      doc.text(`Risk Score: ${result.riskScore.overall}/100`, margin, 76);
      doc.text(`Report ID: ${result.id}`, margin, 83);

      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, pageH, "F");
      y = margin;

      // Summary
      doc.setTextColor(6, 182, 212);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Executive Summary", margin, y);
      y += 8;

      doc.setTextColor(203, 213, 225);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const summaryLines = doc.splitTextToSize(result.summary, pageW - margin * 2);
      doc.text(summaryLines, margin, y);
      y += summaryLines.length * 5 + 8;

      // Risk breakdown
      checkPage(30);
      doc.setTextColor(6, 182, 212);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Risk Breakdown", margin, y);
      y += 7;

      const cats = [
        { label: "Overall", score: result.riskScore.overall },
        { label: "Social", score: result.riskScore.breakdown.social },
        { label: "Technical", score: result.riskScore.breakdown.technical },
        { label: "Regulatory", score: result.riskScore.breakdown.regulatory },
      ];

      for (const cat of cats) {
        checkPage(10);
        const color = cat.score >= 70 ? [239, 68, 68] : cat.score >= 40 ? [249, 115, 22] : [16, 185, 129];
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(9);
        doc.text(`${cat.label}: ${cat.score}/100`, margin, y);
        doc.setFillColor(30, 41, 59);
        doc.rect(margin + 35, y - 3.5, 60, 4, "F");
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(margin + 35, y - 3.5, (cat.score / 100) * 60, 4, "F");
        y += 7;
      }

      // Findings
      for (const adapter of result.results) {
        checkPage(15);
        y += 5;
        doc.setTextColor(6, 182, 212);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${adapter.adapterName} (${adapter.category})`, margin, y);
        y += 6;

        if (adapter.status === "error") {
          doc.setTextColor(239, 68, 68);
          doc.setFontSize(9);
          doc.text(`Error: ${adapter.error}`, margin, y);
          y += 6;
          continue;
        }

        for (const dp of adapter.data) {
          checkPage(12);
          const riskColor =
            dp.riskLevel === "critical" ? [239, 68, 68] :
            dp.riskLevel === "high" ? [249, 115, 22] :
            dp.riskLevel === "medium" ? [234, 179, 8] :
            [16, 185, 129];

          doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.text(`[${dp.riskLevel.toUpperCase()}] ${dp.title}`, margin, y);
          y += 4.5;

          doc.setTextColor(203, 213, 225);
          doc.setFont("helvetica", "normal");
          const valLines = doc.splitTextToSize(dp.value, pageW - margin * 2);
          doc.text(valLines.slice(0, 3), margin + 3, y);
          y += Math.min(valLines.length, 3) * 4 + 2;

          if (dp.sourceUrl) {
            doc.setTextColor(6, 182, 212);
            doc.setFontSize(7);
            doc.text(dp.sourceUrl.slice(0, 80), margin + 3, y);
            y += 4;
          }
        }
      }

      doc.save(`osint-report-${result.entity.name.replace(/\s+/g, "-")}.pdf`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={exportMarkdown}
        disabled={loading !== null}
        className="flex items-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 font-semibold px-4 py-2.5 text-sm transition-all"
      >
        {loading === "md" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        Export MD
      </button>
      <button
        onClick={exportPdf}
        disabled={loading !== null}
        className="flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-900 font-bold px-4 py-2.5 text-sm transition-all"
      >
        {loading === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        Export PDF
      </button>
    </div>
  );
}
