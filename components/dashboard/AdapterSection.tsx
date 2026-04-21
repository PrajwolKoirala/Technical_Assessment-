"use client";

import { AdapterResult } from "@/types";
import { DataPointCard } from "./DataPointCard";
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const STATUS_ICON = {
  success: <CheckCircle size={14} className="text-emerald-400" />,
  partial: <AlertCircle size={14} className="text-yellow-400" />,
  error: <XCircle size={14} className="text-red-400" />,
};

export function AdapterSection({ adapter }: { adapter: AdapterResult }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {STATUS_ICON[adapter.status]}
          <span className="font-semibold text-slate-200">{adapter.adapterName}</span>
          <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
            {adapter.data.length} finding{adapter.data.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-xs font-mono hidden sm:block">
            {new Date(adapter.fetchedAt).toLocaleTimeString()}
          </span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 space-y-3">
          {adapter.status === "error" && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 font-mono">
              ❌ {adapter.error ?? "Unknown error"}
            </div>
          )}
          {adapter.data.length === 0 && adapter.status !== "error" && (
            <p className="text-sm text-slate-500 italic">No data collected from this source.</p>
          )}
          {adapter.data.map((dp) => (
            <DataPointCard key={dp.id} point={dp} />
          ))}
        </div>
      )}
    </div>
  );
}
