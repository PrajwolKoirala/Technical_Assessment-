"use client";

import { DataPoint } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { ExternalLink, Clock, Shield } from "lucide-react";

export function DataPointCard({ point }: { point: DataPoint }) {
  return (
    <div className="group rounded-xl border border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-200 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <RiskBadge level={point.riskLevel} size="xs" />
          <span className="text-sm font-semibold text-slate-200">{point.title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-500 font-mono capitalize flex items-center gap-1">
            <Shield size={10} />
            {point.confidence}
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-300 font-mono break-all leading-relaxed">{point.value}</p>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Clock size={11} />
          {new Date(point.timestamp).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric",
          })}
        </span>
        {point.sourceUrl && (
          <a
            href={point.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-500 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            Source <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
