
import { join } from "path";
import { SearchResult, AdapterResult } from "@/types";

export interface EntityProfile {
  image?: string;
  bio?: string;
  url?: string;
  location?: string;
  name?: string;
}

export interface DbFinding {
  id: string;
  searchId: string;
  title: string;
  value: string;
  sourceUrl: string | null;
  sourceName: string | null;
  category: string;
  riskLevel: string;
  confidence: string;
  status: string;
  urlValid: boolean;
  timestamp: Date;
}

export interface DbSearch {
  id: string;
  entityName: string;
  entityType: string;
  status: string;
  summary: string | null;
  riskOverall: number;
  riskSocial: number;
  riskTech: number;
  riskReg: number;
  highCount: number;
  critCount: number;
  createdAt: Date;
  completedAt: Date | null;
  profileImage: string | null;
  profileBio: string | null;
  profileUrl: string | null;
  profileLocation: string | null;
  findings?: DbFinding[];
  rawResults?: AdapterResult[];
}

// ─── Prisma lazy singleton ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  if (_prisma) return _prisma;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@prisma/client");
    _prisma = new PrismaClient({ log: [] });
    return _prisma;
  } catch {
    return null;
  }
}

// ─── JSON fallback ────────────────────────────────────────────────────────────
const DB_PATH = join(process.cwd(), "data", "osint.db.json");

function readJson(): { searches: DbSearch[] } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  const dir = join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ searches: [] }));
  try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return { searches: [] }; }
}

function writeJson(data: { searches: DbSearch[] }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─── Public DB API ────────────────────────────────────────────────────────────
export const db = {
  async saveSearch(result: SearchResult, profile: EntityProfile): Promise<void> {
    const prisma = getPrisma();
    const allFindings: DbFinding[] = result.results.flatMap((r) =>
      r.data.map((dp) => ({
        id: dp.id,
        searchId: result.id,
        title: dp.title,
        value: dp.value,
        sourceUrl: dp.sourceUrl ?? null,
        sourceName: r.adapterName,
        category: r.category,
        riskLevel: dp.riskLevel,
        confidence: dp.confidence,
        status: "needs_review",
        urlValid: dp.urlValid !== false,
        timestamp: new Date(dp.timestamp),
      }))
    );

    if (prisma) {
      await prisma.search.upsert({
        where: { id: result.id },
        create: {
          id: result.id,
          entityName: result.entity.name,
          entityType: result.entity.type,
          status: result.status,
          summary: result.summary,
          riskOverall: result.riskScore.overall,
          riskSocial: result.riskScore.breakdown.social,
          riskTech: result.riskScore.breakdown.technical,
          riskReg: result.riskScore.breakdown.regulatory,
          highCount: result.riskScore.highRiskCount,
          critCount: result.riskScore.criticalRiskCount,
          completedAt: result.completedAt ? new Date(result.completedAt) : null,
          profileImage: profile.image ?? null,
          profileBio: profile.bio ?? null,
          profileUrl: profile.url ?? null,
          profileLocation: profile.location ?? null,
          findings: { create: allFindings.map(({ searchId: _, ...f }) => ({ ...f })) },
        },
        update: {
          status: result.status,
          summary: result.summary,
          riskOverall: result.riskScore.overall,
          profileImage: profile.image ?? null,
          profileBio: profile.bio ?? null,
          profileUrl: profile.url ?? null,
          profileLocation: profile.location ?? null,
        },
      });
    } else {
      const data = readJson();
      const idx = data.searches.findIndex((s) => s.id === result.id);
      const record: DbSearch = {
        id: result.id,
        entityName: result.entity.name,
        entityType: result.entity.type,
        status: result.status,
        summary: result.summary ?? null,
        riskOverall: result.riskScore.overall,
        riskSocial: result.riskScore.breakdown.social,
        riskTech: result.riskScore.breakdown.technical,
        riskReg: result.riskScore.breakdown.regulatory,
        highCount: result.riskScore.highRiskCount,
        critCount: result.riskScore.criticalRiskCount,
        createdAt: new Date(result.createdAt),
        completedAt: result.completedAt ? new Date(result.completedAt) : null,
        profileImage: profile.image ?? null,
        profileBio: profile.bio ?? null,
        profileUrl: profile.url ?? null,
        profileLocation: profile.location ?? null,
        findings: allFindings,
        rawResults: result.results,
      };
      if (idx >= 0) data.searches[idx] = record;
      else data.searches.unshift(record);
      if (data.searches.length > 200) data.searches = data.searches.slice(0, 200);
      writeJson(data);
    }
  },

  async getSearch(id: string): Promise<DbSearch | null> {
    const prisma = getPrisma();
    if (prisma) {
      return await prisma.search.findUnique({
        where: { id },
        include: { findings: { orderBy: { timestamp: "desc" } } },
      });
    }
    return readJson().searches.find((s) => s.id === id) ?? null;
  },

  async getHistory(limit = 50): Promise<DbSearch[]> {
    const prisma = getPrisma();
    if (prisma) {
      return await prisma.search.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }
    return readJson().searches.slice(0, limit);
  },

  async searchHistory(query: string): Promise<DbSearch[]> {
    const prisma = getPrisma();
    if (prisma) {
      return await prisma.search.findMany({
        where: { entityName: { contains: query, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }
    const q = query.toLowerCase();
    return readJson().searches.filter((s) => s.entityName.toLowerCase().includes(q));
  },

  async deleteSearch(id: string): Promise<void> {
    const prisma = getPrisma();
    if (prisma) {
      await prisma.search.delete({ where: { id } });
    } else {
      const data = readJson();
      data.searches = data.searches.filter((s) => s.id !== id);
      writeJson(data);
    }
  },

  async updateFindingStatus(findingId: string, status: string): Promise<void> {
    const prisma = getPrisma();
    if (prisma) {
      await prisma.finding.update({ where: { id: findingId }, data: { status } });
    } else {
      const data = readJson();
      for (const s of data.searches) {
        const f = s.findings?.find((f) => f.id === findingId);
        if (f) { f.status = status; break; }
      }
      writeJson(data);
    }
  },
};
