/**
 * Search Orchestrator
 * Runs all registered adapters in parallel, collects results,
 * computes risk score, and persists to database.
 */

import { v4 as uuid } from "uuid";
import { registry } from "./adapters";
import { computeRiskScore, generateSummary } from "./scoring";
import { db } from "./db";
import { SearchEntity, SearchResult } from "@/types";

export async function runSearch(entity: SearchEntity): Promise<SearchResult> {
  const id = uuid();
  const createdAt = new Date().toISOString();

  const pending: SearchResult = {
    id,
    entity,
    results: [],
    riskScore: { overall: 0, breakdown: { social: 0, technical: 0, regulatory: 0 }, highRiskCount: 0, criticalRiskCount: 0 },
    summary: "Search in progress…",
    createdAt,
    status: "running",
  };

  // Run all adapters in parallel with individual timeouts
  const adapters = registry.getAll();
  const settled = await Promise.allSettled(
    adapters.map((adapter) =>
      Promise.race([
        adapter.run(entity),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Adapter timeout")), 15000)
        ),
      ])
    )
  );

  const adapterResults = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      adapterId: adapters[i].id,
      adapterName: adapters[i].name,
      category: adapters[i].category,
      entityName: entity.name,
      status: "error" as const,
      data: [],
      error: s.reason instanceof Error ? s.reason.message : "Unknown error",
      fetchedAt: new Date().toISOString(),
    };
  });

  const riskScore = computeRiskScore(adapterResults);
  const summary = generateSummary(entity.name, adapterResults, riskScore);

  const result: SearchResult = {
    ...pending,
    results: adapterResults,
    riskScore,
    summary,
    completedAt: new Date().toISOString(),
    status: "complete",
  };

  db.saveSearch(result);
  return result;
}
