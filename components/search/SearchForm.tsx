"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOsintStore } from "@/store/osintStore";
import { EntityType } from "@/types";
import { Search, Building2, User, Loader2, AlertTriangle } from "lucide-react";

export function SearchForm() {
  const router = useRouter();
  const { runSearch, isSearching, searchError } = useOsintStore();
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("company");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSearching) return;
    const result = await runSearch(name.trim(), type);
    if (result) router.push(`/results/${result.id}`);
  }

  const examples =
    type === "company"
      ? ["AiGeeks", "OpenAI", "Anthropic", "SpaceX"]
      : ["Travis","Elon Musk", "Sam Altman", "Sundar Pichai"];

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-6">
      {/* Entity Type Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-slate-700 bg-slate-800/50">
        {(["company", "individual"] as EntityType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-200 ${
              type === t
                ? "bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-500"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            {t === "company" ? <Building2 size={16} /> : <User size={16} />}
            {t === "company" ? "Company / Organization" : "Individual"}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
        <div className="relative flex items-center rounded-2xl border border-slate-700 bg-slate-800/80 backdrop-blur-sm overflow-hidden focus-within:border-cyan-500/60 transition-colors">
          <div className="pl-5 text-slate-500">
            <Search size={20} />
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "company" ? "e.g. Apple Inc, OpenAI…" : "e.g. Travis Haasch…"}
            className="flex-1 bg-transparent px-4 py-4 text-white placeholder-slate-500 focus:outline-none font-mono text-lg"
            disabled={isSearching}
          />
          <button
            type="submit"
            disabled={!name.trim() || isSearching}
            className="m-2 flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold px-6 py-3 transition-all duration-200 text-sm"
          >
            {isSearching ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Search size={16} />
                Investigate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {searchError && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle size={16} />
          {searchError}
        </div>
      )}

      {/* Examples */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 font-mono">Try:</span>
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setName(ex)}
            className="text-xs text-slate-400 hover:text-cyan-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/40 rounded-lg px-3 py-1.5 font-mono transition-all"
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}
