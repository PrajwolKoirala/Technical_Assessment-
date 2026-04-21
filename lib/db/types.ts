/**
 * lib/db/types.ts
 *
 * Shared async interface that both the JSON store and the Prisma store
 * must satisfy.  The rest of the codebase only imports this — never a
 * concrete store — so switching backends is transparent.
 */

import { SearchResult, SearchHistoryEntry } from "@/types";


export interface DbStore {
  saveSearch(result: SearchResult): Promise<void>;
  getSearch(id: string): Promise<SearchResult | null>;
  getRecentSearches(limit?: number): Promise<SearchResult[]>;
  getHistory(limit?: number): Promise<SearchHistoryEntry[]>;
  deleteSearch(id: string): Promise<void>;
  searchHistory(query: string): Promise<SearchHistoryEntry[]>;
}