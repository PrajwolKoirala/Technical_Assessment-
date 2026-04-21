"use client";

import { useEffect, use } from "react";
import { useOsintStore } from "@/store/osintStore";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { AdapterSection } from "@/components/dashboard/AdapterSection";
import { ExportButtons } from "@/components/report/ExportButtons";
import { ArrowLeft, Building2, User, Clock } from "lucide-react";
import Link from "next/link";

export default function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ IMPORTANT: unwrap params
  const { id } = use(params);

  const { currentResult, loadResult, isResultLoading } =
    useOsintStore();

  useEffect(() => {
    if (id) {
      loadResult(id);
    }
  }, [id]);

  // Loading state
  if (isResultLoading || !currentResult) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex gap-2 items-center text-slate-400 font-mono text-sm">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Loading intelligence report…
        </div>
      </div>
    );
  }

  const r = currentResult;

  const categories = [
    { id: "social", label: "Social & Public Footprint" },
    { id: "technical", label: "Technical Infrastructure" },
    { id: "regulatory", label: "Regulatory & Contextual" },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={15} />
        New Search
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">

        <div className="space-y-2">

          <div className="flex items-center gap-2 text-slate-400 text-sm">
            {r.entity.type === "company" ? (
              <Building2 size={15} />
            ) : (
              <User size={15} />
            )}
            <span className="capitalize">{r.entity.type}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white">
            {r.entity.name}
          </h1>

          <p className="text-slate-400 text-sm">
            {r.summary}
          </p>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <Clock size={12} />
            {r.completedAt
              ? new Date(r.completedAt).toLocaleString()
              : "Running..."}
          </div>

        </div>

        <div className="flex flex-col items-center gap-4">
          <RiskGauge score={r.riskScore} />
          <ExportButtons result={r} />
        </div>

      </div>

      {/* Results */}
      <div className="space-y-10">

        {categories.map((cat) => {
          const adapters =
            r.results?.filter((a) => a.category === cat.id) || [];

          if (!adapters.length) return null;

          return (
            <section key={cat.id} className="space-y-4">

              <h2 className="text-lg font-bold text-slate-200">
                {cat.label}
              </h2>

              <div className="space-y-3">
                {adapters.map((adapter) => (
                  <AdapterSection
                    key={adapter.adapterId}
                    adapter={adapter}
                  />
                ))}
              </div>

            </section>
          );
        })}

      </div>

    </div>
  );
}