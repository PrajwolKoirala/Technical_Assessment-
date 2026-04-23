"use client";

import { useEffect, use, useState, useMemo } from "react";
import { useOsintStore } from "@/store/osintStore";
import { DbSearch, DbFinding } from "@/lib/db";
import {
  ArrowLeft, Download, RefreshCw, Plus, Search,
  Clock, Globe, Shield, Network, AlertTriangle,
  BookOpen, ThumbsUp, ThumbsDown, Trash2, Pencil,
  Building2, User, MapPin, ExternalLink, ChevronDown,
  Maximize2, Code2, Star, GitBranch, Briefcase, Tag,
  CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const cfg: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/30",
    high:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
    medium:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    low:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    unknown:  "bg-slate-500/15 text-slate-400 border-slate-600",
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold font-mono tracking-widest border rounded px-1.5 py-0.5 uppercase ${cfg[level] ?? cfg.unknown}`}>
      {level}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    needs_review:   { cls: "bg-violet-500/15 text-violet-300 border-violet-500/30",   label: "Needs Review",   icon: <AlertCircle size={9} /> },
    confirmed:      { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Confirmed",      icon: <CheckCircle size={9} /> },
    false_positive: { cls: "bg-slate-500/15 text-slate-500 border-slate-600",          label: "False Positive", icon: <XCircle size={9} /> },
  };
  const c = cfg[status] ?? cfg.needs_review;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded px-1.5 py-0.5 ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#ef4444" : score >= 40 ? "#f97316" : "#10b981";
  const label = score >= 70 ? "HIGH" : score >= 40 ? "MOD" : "LOW";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-black font-mono" style={{ color }}>{score}</span>
        <span className="text-[9px] font-bold" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

function FilterSelect({ label, options, value, onChange }: { label: string; options: {value:string;label:string}[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none bg-slate-800/60 border border-slate-700/80 text-slate-300 text-xs rounded-lg pl-2.5 pr-6 py-1.5 focus:outline-none focus:border-slate-500 cursor-pointer">
        <option value="">{label}: All</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Finding card — matches reference UI exactly
// ─────────────────────────────────────────────────────────────────────────────

function FindingCard({ f, onStatus }: { f: DbFinding; onStatus: (id: string, s: string) => void }) {
  const isFP = f.status === "false_positive";
  const categoryColor: Record<string, string> = {
    social: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    technical: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    regulatory: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  return (
    <div className={`py-4 border-b border-slate-800/60 last:border-0 transition-opacity duration-200 ${isFP ? "opacity-35" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Row 1: date + zoom + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500 font-mono">
              {new Date(f.timestamp).toLocaleDateString("en-US", { day:"2-digit", month:"long", year:"numeric" })}
            </span>
            <Maximize2 size={11} className="text-slate-700 hover:text-slate-400 cursor-pointer transition-colors" />
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              <RiskBadge level={f.riskLevel} />
              <StatusBadge status={f.status} />
            </div>
          </div>

          {/* Row 2: title */}
          <h3 className="text-sm font-semibold text-white leading-snug pr-2">{f.title}</h3>

          {/* Row 3: source chip */}
          {f.sourceName && (
            <div className="flex items-center gap-1.5">
              <Globe size={11} className="text-slate-600 shrink-0" />
              <span className="text-[11px] text-slate-400 font-mono">{f.sourceName}</span>
            </div>
          )}

          {/* Row 4: snippet */}
          <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-2">{f.value}</p>

          {/* Row 5: tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {f.sourceName && (
              <span className={`inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 ${categoryColor[f.category] ?? categoryColor.social}`}>
                🔍 {f.sourceName}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 ${
              isFP ? "text-slate-500 bg-slate-800 border-slate-700" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            }`}>
              ◉ {isFP ? "Dismissed" : "Operational"}
            </span>
            {f.sourceUrl && (
              <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors">
                <ExternalLink size={9} /> Source
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 mt-5">
          <button title="Edit" className="w-7 h-7 rounded-lg border border-slate-700/60 hover:border-slate-500 hover:bg-slate-700/50 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-all">
            <Pencil size={11} />
          </button>
          <button title="Confirm"
            onClick={() => onStatus(f.id, f.status === "confirmed" ? "needs_review" : "confirmed")}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
              f.status === "confirmed"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-slate-700/60 hover:border-emerald-500/40 text-slate-500 hover:text-emerald-400"
            }`}>
            <ThumbsUp size={11} />
          </button>
          <button title="Mark false positive"
            onClick={() => onStatus(f.id, f.status === "false_positive" ? "needs_review" : "false_positive")}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
              f.status === "false_positive"
                ? "border-red-500/50 bg-red-500/10 text-red-400"
                : "border-slate-700/60 hover:border-red-500/40 text-slate-500 hover:text-red-400"
            }`}>
            <ThumbsDown size={11} />
          </button>
          <button title="Delete" onClick={() => onStatus(f.id, "false_positive")}
            className="w-7 h-7 rounded-lg border border-slate-700/60 hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center text-slate-600 hover:text-red-400 transition-all">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Card — the centrepiece
// ─────────────────────────────────────────────────────────────────────────────

function ProfileCard({ s }: { s: DbSearch }) {
  const [expanded, setExpanded] = useState(false);
  const tags: string[] = (() => {
    try { return s.profileTags ? JSON.parse(s.profileTags) : []; }
    catch { return []; }
  })();

  const riskColor = s.riskOverall >= 70 ? { text: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10", label: "HIGH RISK" }
    : s.riskOverall >= 40 ? { text: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10", label: "MODERATE" }
    : { text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10", label: "NORMAL" };

  const bioText = s.profileBio ?? s.summary ?? "";
  const shouldTruncate = bioText.length > 220;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg,#06b6d4,#818cf8,#06b6d4)" }} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-slate-700/80 bg-slate-800">
              {s.profileImage ? (
                <img src={s.profileImage} alt={s.entityName}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).style.display="none"; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {s.entityType === "company"
                    ? <Building2 size={32} className="text-slate-500" />
                    : <User size={32} className="text-slate-500" />}
                </div>
              )}
            </div>
            {/* Source badge */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
              <Shield size={10} className="text-cyan-400" />
            </div>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">{s.entityName}</h1>
                {/* Tags row */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center text-[10px] font-semibold border border-slate-600 text-slate-300 rounded px-1.5 py-0.5 uppercase tracking-wider bg-slate-800">
                    {s.entityType === "company" ? <Building2 size={8} className="mr-1" /> : <User size={8} className="mr-1" />}
                    {s.entityType}
                  </span>
                  {tags.slice(0, 4).map(tag => (
                    <span key={tag} className="inline-flex items-center text-[10px] font-medium border border-slate-700/60 text-slate-400 rounded px-1.5 py-0.5 bg-slate-800/50">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {/* Risk pill */}
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold font-mono tracking-wider border rounded-full px-3 py-1 shrink-0 ${riskColor.text} ${riskColor.border} ${riskColor.bg}`}>
                <Shield size={11} />
                {riskColor.label}
              </span>
            </div>

            {/* Location + website row */}
            <div className="flex items-center gap-4 flex-wrap">
              {s.profileLocation && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin size={11} className="text-slate-600" />
                  {s.profileLocation}
                </span>
              )}
              {s.profileCompany && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Briefcase size={11} className="text-slate-600" />
                  {s.profileCompany}
                </span>
              )}
              {s.profileUrl && (
                <a href={s.profileUrl.startsWith("http") ? s.profileUrl : `https://${s.profileUrl}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-300 transition-colors">
                  <Globe size={11} />
                  {s.profileUrl.replace(/^https?:\/\//, "").split("/")[0].slice(0, 40)}
                  <ExternalLink size={9} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {bioText && (
          <div className="mt-4 space-y-2">
            <p className={`text-sm text-slate-300 leading-relaxed ${!expanded && shouldTruncate ? "line-clamp-3" : ""}`}>
              {bioText}
            </p>
            {shouldTruncate && (
              <button onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 transition-colors">
                <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center gap-6 flex-wrap">
          <div className="text-center">
            <p className="text-lg font-black text-white">{(s.findings?.length ?? 0)}</p>
            <p className="text-[10px] text-slate-500 font-mono">findings</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-black ${riskColor.text}`}>{s.riskOverall}</p>
            <p className="text-[10px] text-slate-500 font-mono">risk score</p>
          </div>
          {s.critCount > 0 && (
            <div className="text-center">
              <p className="text-lg font-black text-red-400">{s.critCount}</p>
              <p className="text-[10px] text-slate-500 font-mono">critical</p>
            </div>
          )}
          {s.highCount > 0 && (
            <div className="text-center">
              <p className="text-lg font-black text-orange-400">{s.highCount}</p>
              <p className="text-[10px] text-slate-500 font-mono">high risk</p>
            </div>
          )}
          <div className="ml-auto">
            <ScoreRing score={s.riskOverall} size={52} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "findings",  label: "Findings",  icon: Shield },
  { id: "timeline",  label: "Timeline",  icon: Clock },
  { id: "network",   label: "Network",   icon: Network },
  { id: "risk",      label: "Risk",      icon: AlertTriangle },
  { id: "resources", label: "Resources", icon: BookOpen },
];

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { currentSearch, loadResult, updateFindingStatus, runSearch, isSearching } = useOsintStore();
  const [activeTab, setActiveTab] = useState("findings");
  const [keyword, setKeyword] = useState("");
  const [sevFilter, setSevFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");

  useEffect(() => {
    if (!currentSearch || currentSearch.id !== id) loadResult(id);
  }, [id]);

  const s = currentSearch;

  const findings: DbFinding[] = useMemo(() => {
    if (!s?.findings) return [];
    return s.findings.filter((f: DbFinding) => {
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (!f.title.toLowerCase().includes(kw) && !f.value.toLowerCase().includes(kw) && !(f.sourceName ?? "").toLowerCase().includes(kw)) return false;
      }
      if (sevFilter && f.riskLevel !== sevFilter) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      if (catFilter && f.category !== catFilter) return false;
      return true;
    });
  }, [s, keyword, sevFilter, statusFilter, catFilter]);

  const activeFindingsCount = (s?.findings ?? []).filter((f: DbFinding) => f.status !== "false_positive").length;

  async function handleRegenerate() {
    if (!s || isSearching) return;
    const newId = await runSearch(s.entityName, s.entityType as "company" | "individual");
    if (newId) router.push(`/results/${newId}`);
  }

  async function handleDownload() {
    const res = await fetch(`/api/report/${id}?format=markdown`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `osint-${s?.entityName?.replace(/\s+/g,"-") ?? id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!s || s.id !== id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
          <div className="absolute inset-0 rounded-full border-2 border-t-cyan-400 animate-spin" />
        </div>
        <p className="text-slate-400 text-sm font-mono">Loading intelligence report…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors">
        <ArrowLeft size={12} /> New Search
      </Link>

      {/* Profile Card */}
      <ProfileCard s={s} />

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const count = tab.id === "findings" ? activeFindingsCount : null;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-white text-white"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <Icon size={13} />
              <span className="hidden sm:block">{tab.label}</span>
              {count !== null && (
                <span className="bg-slate-700/80 text-slate-300 text-[10px] font-mono rounded-full px-1.5 leading-5 min-w-[20px] text-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">

        {/* ── FINDINGS ── */}
        {activeTab === "findings" && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 transition-all">
                <Download size={13} /> Download Report
              </button>
              <button onClick={handleRegenerate} disabled={isSearching}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 transition-all disabled:opacity-50">
                <RefreshCw size={13} className={isSearching ? "animate-spin" : ""} /> Regenerate
              </button>
              <button className="flex items-center gap-1.5 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg px-3 py-2 transition-all">
                <Plus size={13} /> Add Manual Finding
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-40">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
                  placeholder="Filter by keyword, source or tag"
                  className="w-full bg-slate-800/60 border border-slate-700/80 text-slate-300 placeholder-slate-600 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-slate-500" />
              </div>
              {(keyword || sevFilter || statusFilter || catFilter) && (
                <button onClick={() => { setKeyword(""); setSevFilter(""); setStatusFilter(""); setCatFilter(""); }}
                  className="text-xs text-slate-500 hover:text-white transition-colors whitespace-nowrap">
                  Clear filters
                </button>
              )}
              <FilterSelect label="Severity" value={sevFilter} onChange={setSevFilter}
                options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"},{value:"critical",label:"Critical"}]} />
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}
                options={[{value:"needs_review",label:"Needs Review"},{value:"confirmed",label:"Confirmed"},{value:"false_positive",label:"False Positive"}]} />
              <FilterSelect label="Category" value={catFilter} onChange={setCatFilter}
                options={[{value:"social",label:"Social"},{value:"technical",label:"Technical"},{value:"regulatory",label:"Regulatory"}]} />
            </div>

            <p className="text-[11px] text-slate-500 font-mono">
              Showing {findings.filter((f: DbFinding) => f.status !== "false_positive").length} of {findings.length} results
            </p>

            <div>
              {findings.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-500">No findings match your filters.</p>
                </div>
              )}
              {findings.map((f: DbFinding) => (
                <FindingCard key={f.id} f={f} onStatus={updateFindingStatus} />
              ))}
            </div>
          </div>
        )}

        {/* ── TIMELINE ── */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200">Chronological Timeline</h3>
            <div className="relative pl-5 border-l border-slate-800 space-y-5">
              {(s.findings ?? []).slice().sort((a: DbFinding, b: DbFinding) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              ).slice(0, 25).map((f: DbFinding) => (
                <div key={f.id} className="relative group">
                  <div className={`absolute -left-[21px] w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                    f.riskLevel === "critical" ? "bg-red-400" : f.riskLevel === "high" ? "bg-orange-400" : f.riskLevel === "medium" ? "bg-yellow-400" : "bg-slate-600"
                  }`} />
                  <p className="text-[10px] text-slate-500 font-mono mb-0.5">
                    {new Date(f.timestamp).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}
                  </p>
                  <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{f.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{f.value}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-600 font-mono">{f.sourceName}</span>
                    <RiskBadge level={f.riskLevel} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── NETWORK ── */}
        {activeTab === "network" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200">Source Network Map</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from(
                new Map((s.findings ?? []).map((f: DbFinding) => [f.sourceName, f]))
              ).map(([srcName, sample]) => {
                const count = (s.findings ?? []).filter((f: DbFinding) => f.sourceName === srcName).length;
                const catColors: Record<string,string> = { social:"border-violet-500/30 bg-violet-500/5", technical:"border-cyan-500/30 bg-cyan-500/5", regulatory:"border-amber-500/30 bg-amber-500/5" };
                return (
                  <div key={srcName as string} className={`rounded-xl border p-3 space-y-2 ${catColors[(sample as DbFinding).category] ?? "border-slate-700 bg-slate-800/30"}`}>
                    <div className="flex items-center justify-between">
                      <Globe size={14} className="text-slate-400" />
                      <span className="text-[10px] font-mono text-slate-500">{(sample as DbFinding).category}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200">{srcName as string}</p>
                    <p className="text-xs text-slate-500">{count} finding{count !== 1 ? "s" : ""}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── RISK ── */}
        {activeTab === "risk" && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-slate-200">Risk Assessment</h3>
            {[
              { label: "Overall Risk Score", score: s.riskOverall, desc: "Weighted across all categories" },
              { label: "Social & Public Footprint", score: s.riskSocial, desc: "Social media, web presence" },
              { label: "Technical Infrastructure", score: s.riskTech, desc: "DNS, GitHub, breach data" },
              { label: "Regulatory & Contextual", score: s.riskReg, desc: "News, filings, sanctions" },
            ].map(({ label, score, desc }) => {
              const col = score >= 70 ? "#ef4444" : score >= 40 ? "#f97316" : "#10b981";
              return (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="text-sm font-medium text-slate-200">{label}</span>
                      <span className="ml-2 text-[10px] text-slate-500">{desc}</span>
                    </div>
                    <span className="font-black font-mono text-sm" style={{ color: col }}>{score}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${score}%`, backgroundColor: col }} />
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { label: "Total Findings", val: s.findings?.length ?? 0, color: "text-white" },
                { label: "Critical", val: s.critCount, color: "text-red-400" },
                { label: "High Risk", val: s.highCount, color: "text-orange-400" },
                { label: "Confirmed", val: (s.findings ?? []).filter((f: DbFinding) => f.status === "confirmed").length, color: "text-emerald-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 text-center">
                  <p className={`text-2xl font-black ${color}`}>{val}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESOURCES ── */}
        {activeTab === "resources" && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">Source URLs & References</h3>
            <div className="space-y-2">
              {(s.findings ?? []).filter((f: DbFinding) => f.sourceUrl).map((f: DbFinding) => (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/20 hover:bg-slate-800/50 transition-colors p-3">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    f.riskLevel === "critical" ? "bg-red-400" : f.riskLevel === "high" ? "bg-orange-400" : f.riskLevel === "medium" ? "bg-yellow-400" : "bg-emerald-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{f.title}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{f.sourceUrl}</p>
                  </div>
                  <a href={f.sourceUrl!} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-slate-600 hover:text-cyan-400 transition-colors">
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
