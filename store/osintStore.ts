import { create } from "zustand";
import { SearchResult, SearchHistoryEntry, EntityType } from "@/types";

interface OsintStore {
  // Search state
  searchName: string;
  searchType: EntityType;
  isSearching: boolean;
  currentResult: SearchResult | null;
  searchError: string | null;

  // History
  history: SearchHistoryEntry[];
  historyLoading: boolean;

  // Actions
  setSearchName: (name: string) => void;
  setSearchType: (type: EntityType) => void;
  runSearch: (name: string, type: EntityType) => Promise<SearchResult | null>;
  loadHistory: () => Promise<void>;
  deleteHistoryEntry: (id: string) => Promise<void>;
  loadResult: (id: string) => Promise<SearchResult | null>;
  clearCurrentResult: () => void;
}

export const useOsintStore = create<OsintStore>((set, get) => ({
  searchName: "",
  searchType: "company",
  isSearching: false,
  currentResult: null,
  searchError: null,
  history: [],
  historyLoading: false,

  setSearchName: (name) => set({ searchName: name }),
  setSearchType: (type) => set({ searchType: type }),

  runSearch: async (name, type) => {
    set({ isSearching: true, searchError: null, currentResult: null });
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Search failed");
      set({ currentResult: json.data, isSearching: false });
      // refresh history
      get().loadHistory();
      return json.data as SearchResult;
    } catch (err) {
      set({
        searchError: err instanceof Error ? err.message : "Unknown error",
        isSearching: false,
      });
      return null;
    }
  },

  loadHistory: async () => {
    set({ historyLoading: true });
    try {
      const res = await fetch("/api/history");
      const json = await res.json();
      if (json.success) set({ history: json.data });
    } finally {
      set({ historyLoading: false });
    }
  },

  deleteHistoryEntry: async (id) => {
    await fetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
  },

  loadResult: async (id) => {
    try {
      const res = await fetch(`/api/results/${id}`);
      const json = await res.json();
      if (json.success) {
        set({ currentResult: json.data });
        return json.data as SearchResult;
      }
    } catch {
      // ignore
    }
    return null;
  },

  clearCurrentResult: () => set({ currentResult: null }),
}));
