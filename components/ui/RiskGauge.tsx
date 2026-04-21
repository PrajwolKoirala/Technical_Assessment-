"use client";
import { RiskScore } from "@/types";

function scoreColor(score: number) {
  if (score >= 70) return { stroke: "#ef4444", text: "text-red-400", label: "HIGH RISK" };
  if (score >= 40) return { stroke: "#f97316", text: "text-orange-400", label: "MODERATE" };
  return { stroke: "#10b981", text: "text-emerald-400", label: "LOW RISK" };
}

export function RiskGauge({ score }: { score: RiskScore }) {
  const { stroke, text, label } = scoreColor(score.overall);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score.overall / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={stroke} strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black font-mono ${text}`}>{score.overall}</span>
          <span className="text-xs text-slate-500 font-mono">/ 100</span>
        </div>
      </div>

      <span className={`text-sm font-bold font-mono tracking-widest ${text}`}>{label}</span>

      <div className="w-full space-y-2">
        {(["social", "technical", "regulatory"] as const).map((cat) => {
          const v = score.breakdown[cat];
          const c = scoreColor(v);
          return (
            <div key={cat} className="space-y-0.5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span className="capitalize">{cat}</span>
                <span>{v}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${v}%`, backgroundColor: c.stroke }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 text-xs font-mono">
        {score.criticalRiskCount > 0 && (
          <span className="text-red-400">🔴 {score.criticalRiskCount} critical</span>
        )}
        {score.highRiskCount > 0 && (
          <span className="text-orange-400">🟠 {score.highRiskCount} high</span>
        )}
      </div>
    </div>
  );
}
