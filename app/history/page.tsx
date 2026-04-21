"use client";

import { useEffect, useState } from "react";
import { useOsintStore } from "@/store/osintStore";
import { useRouter } from "next/navigation";
import { Building2, User, Trash2, Search, ExternalLink, Clock } from "lucide-react";
import { SearchHistoryEntry } from "@/types";

function RiskPill({ score }: { score: number }) {
  const c = score >= 70 ? "text-red-400 bg-red-500/10 border-red-500/30"
    : score >= 40 ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  return (
    <span className={`text-xs font-mono font-bold border rounded px-2 py-0.5 ${c}`}>
      {score}/100
    </span>
  );
}

export default function HistoryPage() {
  const { history, historyLoading, loadHistory, deleteHistoryEntry, loadResult } = useOsintStore();
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => { loadHistory(); }, []);

  const filtered = query
    ? history.filter((h) => h.entityName.toLowerCase().includes(query.toLowerCase()))
    : history;

  async function handleOpen(entry: SearchHistoryEntry) {
    await loadResult(entry.id);
    router.push(`/results/${entry.id}`);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight">Search History</h1>
        <p className="text-slate-400 text-sm">All past OSINT investigations stored locally.</p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name…"
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
        />
      </div>

      {historyLoading && (
        <div className="text-center text-slate-500 font-mono text-sm py-10">Loading history…</div>
      )}

      {!historyLoading && filtered.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <p className="text-slate-500 text-sm">No searches yet.</p>
          <a href="/" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
            <Search size={14} /> Start your first investigation
          </a>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/80 hover:border-slate-600 transition-all p-4 cursor-pointer"
            onClick={() => handleOpen(entry)}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-700/80 border border-slate-600 flex items-center justify-center shrink-0">
                {entry.entityType === "company"
                  ? <Building2 size={18} className="text-cyan-400" />
                  : <User size={18} className="text-violet-400" />}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-200 truncate">{entry.entityName}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-500 capitalize font-mono">{entry.entityType}</span>
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{entry.dataPointCount} findings</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <RiskPill score={entry.riskScore} />
              <ExternalLink size={15} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
              <button
                onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.id); }}
                className="text-slate-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}