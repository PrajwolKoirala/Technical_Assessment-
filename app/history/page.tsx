"use client";
import { useEffect, useState } from "react";
import { useOsintStore } from "@/store/osintStore";
import { useRouter } from "next/navigation";
import { DbSearch } from "@/lib/db";
import { Building2, User, Trash2, Search, Shield, Clock, ChevronRight } from "lucide-react";

export default function HistoryPage() {
  const { history, historyLoading, loadHistory, deleteHistoryEntry, loadResult } = useOsintStore();
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => { loadHistory(); }, []);

  const filtered = query
    ? history.filter((h) => h.entityName.toLowerCase().includes(query.toLowerCase()))
    : history;

  async function open(h: DbSearch) {
    await loadResult(h.id);
    router.push(`/results/${h.id}`);
  }

  const riskColor = (s: number) =>
    s >= 70 ? "text-red-400" : s >= 40 ? "text-orange-400" : "text-emerald-400";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Search History</h1>
        <p className="text-sm text-slate-500 mt-1">All past OSINT investigations</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500" />
      </div>

      {historyLoading && (
        <div className="text-center py-16 text-slate-500 text-sm">Loading…</div>
      )}

      {!historyLoading && filtered.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-slate-500 text-sm">No searches found.</p>
          <a href="/" className="text-cyan-400 hover:text-cyan-300 text-sm">Start a new investigation →</a>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((h) => (
          <div key={h.id}
            onClick={() => open(h)}
            className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-700 transition-all p-4 cursor-pointer">

            {/* Avatar */}
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-700 shrink-0 bg-slate-800 flex items-center justify-center">
              {h.profileImage
                ? <img src={h.profileImage} alt={h.entityName} className="w-full h-full object-cover" />
                : h.entityType === "company"
                  ? <Building2 size={18} className="text-cyan-400" />
                  : <User size={18} className="text-violet-400" />
              }
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-200 text-sm truncate">{h.entityName}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-slate-500 capitalize font-mono">{h.entityType}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock size={9} />
                  {new Date(h.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className={`text-sm font-black font-mono ${riskColor(h.riskOverall)}`}>{h.riskOverall}</p>
                <p className="text-[10px] text-slate-600">risk score</p>
              </div>
              <ChevronRight size={15} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              <button onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(h.id); }}
                className="w-7 h-7 rounded-lg border border-transparent hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center text-slate-600 hover:text-red-400 transition-all">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
