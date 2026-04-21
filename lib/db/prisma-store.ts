/**
 * lib/db/prisma-store.ts
 *
 * Prisma-backed implementation of DbStore.
 * Only imported when Prisma is detected as available.
 *
 * AdapterResult[] is stored as a JSON string column (resultsJson) to avoid
 * complex join tables for a read-heavy, schema-flexible workload.
 */

import type { DbStore } from "./types";
import type { SearchResult, SearchHistoryEntry, AdapterResult } from "@/types";

// Lazy singleton — avoids instantiating PrismaClient at module parse time
// (which would crash if @prisma/client isn't installed).
let _prisma: any = null;

function getPrisma(): any {
  if (!_prisma) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require("@prisma/client");
    _prisma = new PrismaClient();
  }
  return _prisma!;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Map a Prisma Search row → our SearchResult domain type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSearchResult(row: any): SearchResult {
  return {
    id:          row.id,
    status:      row.status,
    summary:     row.summary,
    createdAt:   row.createdAt instanceof Date
                   ? row.createdAt.toISOString()
                   : row.createdAt,
    completedAt: row.completedAt
                   ? (row.completedAt instanceof Date
                       ? row.completedAt.toISOString()
                       : row.completedAt)
                   : undefined,
    entity: {
      name: row.entityName,
      type: row.entityType as SearchResult["entity"]["type"],
    },
    riskScore: {
      overall:          row.riskOverall,
      highRiskCount:    row.highRiskCount,
      criticalRiskCount: row.criticalRiskCount,
      breakdown: {
        social:     row.riskSocial,
        technical:  row.riskTechnical,
        regulatory: row.riskRegulatory,
      },
    },
    results: JSON.parse(row.resultsJson ?? "[]") as AdapterResult[],
  };
}

/** Map a Prisma SearchHistory row → our SearchHistoryEntry domain type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToHistoryEntry(row: any): SearchHistoryEntry {
  return {
    id:             row.id,
    entityName:     row.entityName,
    entityType:     row.entityType as SearchHistoryEntry["entityType"],
    riskScore:      row.riskScore,
    dataPointCount: row.dataPointCount,
    adapterCount:   row.adapterCount,
    createdAt:      row.createdAt instanceof Date
                      ? row.createdAt.toISOString()
                      : row.createdAt,
    status:         row.status as SearchHistoryEntry["status"],
  };
}

// ─── store implementation ────────────────────────────────────────────────────

export const prismaStore: DbStore = {
  async saveSearch(result: SearchResult): Promise<void> {
    const prisma = getPrisma();

    const dataPointCount = result.results.reduce(
      (acc, r) => acc + r.data.length,
      0
    );

    const searchPayload = {
      entityName:        result.entity.name,
      entityType:        result.entity.type,
      status:            result.status,
      summary:           result.summary,
      createdAt:         new Date(result.createdAt),
      completedAt:       result.completedAt ? new Date(result.completedAt) : null,
      riskOverall:       result.riskScore.overall,
      riskSocial:        result.riskScore.breakdown.social,
      riskTechnical:     result.riskScore.breakdown.technical,
      riskRegulatory:    result.riskScore.breakdown.regulatory,
      highRiskCount:     result.riskScore.highRiskCount,
      criticalRiskCount: result.riskScore.criticalRiskCount,
      resultsJson:       JSON.stringify(result.results),
    };

    const historyPayload = {
      entityName:     result.entity.name,
      entityType:     result.entity.type,
      riskScore:      result.riskScore.overall,
      dataPointCount,
      adapterCount:   result.results.length,
      createdAt:      new Date(result.createdAt),
      status:         result.status === "error" ? "error" : "complete",
    };

    // Upsert both rows in a transaction so they stay in sync
    await prisma.$transaction([
      prisma.search.upsert({
        where:  { id: result.id },
        create: { id: result.id, ...searchPayload },
        update: searchPayload,
      }),
      prisma.searchHistory.upsert({
        where:  { id: result.id },
        create: { id: result.id, ...historyPayload },
        update: historyPayload,
      }),
    ]);

    // Enforce the 200-row cap for searches
    const oldSearches = await prisma.search.findMany({
      orderBy: { createdAt: "desc" },
      skip:    200,
      select:  { id: true },
    });
    if (oldSearches.length > 0) {
      await prisma.search.deleteMany({
        where: { id: { in: oldSearches.map((s: { id: string }) => s.id) } },
      });
    }

    // Enforce the 500-row cap for history
    const oldHistory = await prisma.searchHistory.findMany({
      orderBy: { createdAt: "desc" },
      skip:    500,
      select:  { id: true },
    });
    if (oldHistory.length > 0) {
      await prisma.searchHistory.deleteMany({
        where: { id: { in: oldHistory.map((h: { id: string }) => h.id) } },
      });
    }
  },

  async getSearch(id: string): Promise<SearchResult | null> {
    const prisma = getPrisma();
    const row = await prisma.search.findUnique({ where: { id } });
    return row ? rowToSearchResult(row) : null;
  },

  async getRecentSearches(limit = 20): Promise<SearchResult[]> {
    const prisma = getPrisma();
    const rows = await prisma.search.findMany({
      orderBy: { createdAt: "desc" },
      take:    limit,
    });
    return rows.map(rowToSearchResult);
  },

  async getHistory(limit = 50): Promise<SearchHistoryEntry[]> {
    const prisma = getPrisma();
    const rows = await prisma.searchHistory.findMany({
      orderBy: { createdAt: "desc" },
      take:    limit,
    });
    return rows.map(rowToHistoryEntry);
  },

  async deleteSearch(id: string): Promise<void> {
    const prisma = getPrisma();
    // Cascade on the schema handles SearchHistory deletion automatically
    await prisma.search.delete({ where: { id } });
  },

  async searchHistory(query: string): Promise<SearchHistoryEntry[]> {
    const prisma = getPrisma();
    const rows = await prisma.searchHistory.findMany({
      where:   { entityName: { contains: query, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(rowToHistoryEntry);
  },
};