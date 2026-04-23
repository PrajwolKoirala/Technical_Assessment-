import { v4 as uuid } from "uuid";
import { registry } from "./adapters";
import { computeRiskScore, generateSummary } from "./scoring";
import { db } from "./db";
import { validateDataPoints } from "./urlValidator";
import { resolveEntityProfile } from "./entityResolver";
import { SearchEntity, SearchResult, AdapterResult } from "@/types";

export async function runSearch(entity: SearchEntity): Promise<SearchResult> {
  const id = uuid();
  const createdAt = new Date().toISOString();

  const adapters = registry.getAll();

  // Run adapters + entity resolver in parallel
  const [settled, profile] = await Promise.all([
    Promise.allSettled(
      adapters.map((adapter) =>
        Promise.race([
          adapter.run(entity),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Adapter timeout")), 15000)
          ),
        ])
      )
    ),
    resolveEntityProfile(entity),
  ]);

  // Collect raw adapter results
  const rawResults: AdapterResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      adapterId: adapters[i].id,
      adapterName: adapters[i].name,
      category: adapters[i].category,
      entityName: entity.name,
      status: "error" as const,
      data: [],
      error: s.reason instanceof Error ? s.reason.message : "Timeout or unknown error",
      fetchedAt: new Date().toISOString(),
    };
  });

  // Validate URLs in each adapter's data points (run per-adapter in parallel)
  const validatedResults: AdapterResult[] = await Promise.all(
    rawResults.map(async (r) => {
      if (r.data.length === 0) return r;
      const validated = await validateDataPoints(r.data);
      return { ...r, data: validated };
    })
  );

  const riskScore = computeRiskScore(validatedResults);
  const summary = generateSummary(entity.name, validatedResults, riskScore);

  const result: SearchResult = {
    id,
    entity,
    results: validatedResults,
    riskScore,
    summary,
    profile,
    createdAt,
    completedAt: new Date().toISOString(),
    status: "complete",
  };

  await db.saveSearch(result, profile);
  return result;
}
