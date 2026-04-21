
import { join } from "path";
import type { DbStore } from "./types";
import type { SearchResult, SearchHistoryEntry } from "@/types";

const DB_PATH = join(process.cwd(), "data", "osint.db.json");

interface DbSchema {
  searches: SearchResult[];
  history:  SearchHistoryEntry[];
}

function readDb(): DbSchema {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    const dir = join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DB_PATH))
      fs.writeFileSync(DB_PATH, JSON.stringify({ searches: [], history: [] }));
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as DbSchema;
  } catch {
    return { searches: [], history: [] };
  }
}

function writeDb(data: DbSchema): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export const jsonStore: DbStore = {
  async saveSearch(result: SearchResult): Promise<void> {
    const data = readDb();

    const existing = data.searches.findIndex((s) => s.id === result.id);
    if (existing >= 0) data.searches[existing] = result;
    else data.searches.unshift(result);

    if (data.searches.length > 200)
      data.searches = data.searches.slice(0, 200);

    const historyEntry: SearchHistoryEntry = {
      id:             result.id,
      entityName:     result.entity.name,
      entityType:     result.entity.type,
      riskScore:      result.riskScore.overall,
      dataPointCount: result.results.reduce((acc, r) => acc + r.data.length, 0),
      adapterCount:   result.results.length,
      createdAt:      result.createdAt,
      status:         result.status === "error" ? "error" : "complete",
    };

    const hi = data.history.findIndex((h) => h.id === result.id);
    if (hi >= 0) data.history[hi] = historyEntry;
    else data.history.unshift(historyEntry);

    if (data.history.length > 500)
      data.history = data.history.slice(0, 500);

    writeDb(data);
  },

  async getSearch(id: string): Promise<SearchResult | null> {
    const data = readDb();
    return data.searches.find((s) => s.id === id) ?? null;
  },

  async getRecentSearches(limit = 20): Promise<SearchResult[]> {
    const data = readDb();
    return data.searches.slice(0, limit);
  },

  async getHistory(limit = 50): Promise<SearchHistoryEntry[]> {
    const data = readDb();
    return data.history.slice(0, limit);
  },

  async deleteSearch(id: string): Promise<void> {
    const data = readDb();
    data.searches = data.searches.filter((s) => s.id !== id);
    data.history  = data.history.filter((h) => h.id !== id);
    writeDb(data);
  },

  async searchHistory(query: string): Promise<SearchHistoryEntry[]> {
    const data = readDb();
    const q = query.toLowerCase();
    return data.history.filter((h) =>
      h.entityName.toLowerCase().includes(q)
    );
  },
};