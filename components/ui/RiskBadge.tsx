"use client";
import { RiskLevel } from "@/types";

const CONFIG: Record<RiskLevel, { label: string; classes: string }> = {
  critical: { label: "CRITICAL", classes: "bg-red-500/20 text-red-400 border border-red-500/40" },
  high:     { label: "HIGH",     classes: "bg-orange-500/20 text-orange-400 border border-orange-500/40" },
  medium:   { label: "MEDIUM",   classes: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40" },
  low:      { label: "LOW",      classes: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" },
  unknown:  { label: "UNKNOWN",  classes: "bg-slate-500/20 text-slate-400 border border-slate-500/40" },
};

export function RiskBadge({ level, size = "sm" }: { level: RiskLevel; size?: "xs" | "sm" | "md" }) {
  const c = CONFIG[level];
  const px = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded font-mono font-bold tracking-widest ${px} ${c.classes}`}>
      {c.label}
    </span>
  );
}
