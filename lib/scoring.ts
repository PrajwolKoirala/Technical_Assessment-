/**
 * Risk Scoring Engine — Phase II
 * Computes overall risk score and per-category breakdowns from adapter results.
 */

import { AdapterResult, RiskScore, DataPoint, RiskLevel } from "@/types";

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 5,
  unknown: 10,
};

function categoryScore(results: AdapterResult[], category: string): number {
  const categoryResults = results.filter((r) => r.category === category);
  if (categoryResults.length === 0) return 0;

  const allPoints: DataPoint[] = categoryResults.flatMap((r) => r.data);
  if (allPoints.length === 0) return 0;

  const maxPossible = allPoints.length * 100;
  const actual = allPoints.reduce((acc, p) => acc + RISK_WEIGHTS[p.riskLevel], 0);
  return Math.min(100, Math.round((actual / maxPossible) * 100));
}

export function computeRiskScore(results: AdapterResult[]): RiskScore {
  const allPoints = results.flatMap((r) => r.data);

  const highRiskCount = allPoints.filter(
    (p) => p.riskLevel === "high" || p.riskLevel === "critical"
  ).length;
  const criticalRiskCount = allPoints.filter((p) => p.riskLevel === "critical").length;

  const social = categoryScore(results, "social");
  const technical = categoryScore(results, "technical");
  const regulatory = categoryScore(results, "regulatory");

  // Weighted overall — regulatory issues weigh more
  const overall = Math.min(
    100,
    Math.round(social * 0.25 + technical * 0.35 + regulatory * 0.4) +
      criticalRiskCount * 15 +
      highRiskCount * 5
  );

  return { overall: Math.min(100, overall), breakdown: { social, technical, regulatory }, highRiskCount, criticalRiskCount };
}

export function generateSummary(
  entityName: string,
  results: AdapterResult[],
  score: RiskScore
): string {
  const totalPoints = results.flatMap((r) => r.data).length;
  const successAdapters = results.filter((r) => r.status === "success").length;
  const riskLabel =
    score.overall >= 70
      ? "HIGH RISK"
      : score.overall >= 40
      ? "MODERATE RISK"
      : "LOW RISK";

  return (
    `OSINT analysis for "${entityName}" completed across ${successAdapters}/${results.length} data sources. ` +
    `${totalPoints} data points collected. Overall risk assessment: ${riskLabel} (${score.overall}/100). ` +
    (score.criticalRiskCount > 0
      ? `⚠️ ${score.criticalRiskCount} critical finding(s) require immediate attention. `
      : "") +
    (score.highRiskCount > 0
      ? `${score.highRiskCount} high-severity issue(s) identified. `
      : "No major risk indicators found.")
  );
}
