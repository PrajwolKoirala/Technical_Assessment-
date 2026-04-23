import { create } from "zustand";
import { EntityType } from "@/types";
import { DbSearch, DbFinding } from "@/lib/db";

interface OsintStore {
  searchName: string;
  searchType: EntityType;
  isSearching: boolean;
  currentSearch: DbSearch | null;
  searchError: string | null;
  history: DbSearch[];
  historyLoading: boolean;

  setSearchName: (name: string) => void;
  setSearchType: (type: EntityType) => void;
  runSearch: (name: string, type: EntityType) => Promise<string | null>;
  loadHistory: () => Promise<void>;
  deleteHistoryEntry: (id: string) => Promise<void>;
  loadResult: (id: string) => Promise<DbSearch | null>;
  updateFindingStatus: (findingId: string, status: string) => void;
  clearCurrentSearch: () => void;
}

export const useOsintStore = create<OsintStore>((set, get) => ({
  searchName: "",
  searchType: "company",
  isSearching: false,
  currentSearch: null,
  searchError: null,
  history: [],
  historyLoading: false,

  setSearchName: (name) => set({ searchName: name }),
  setSearchType: (type) => set({ searchType: type }),

  runSearch: async (name, type) => {
    set({ isSearching: true, searchError: null, currentSearch: null });
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Search failed");
      // load the full db record (with findings)
      const full = await get().loadResult(json.data.id);
      get().loadHistory();
      return full?.id ?? null;
    } catch (err) {
      set({ searchError: err instanceof Error ? err.message : "Unknown error", isSearching: false });
      return null;
    } finally {
      set({ isSearching: false });
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
        set({ currentSearch: json.data });
        return json.data as DbSearch;
      }
    } catch { /* ignore */ }
    return null;
  },

  updateFindingStatus: (findingId, status) => {
    // Optimistic update
    set((s) => {
      if (!s.currentSearch?.findings) return s;
      return {
        currentSearch: {
          ...s.currentSearch,
          findings: s.currentSearch.findings.map((f: DbFinding) =>
            f.id === findingId ? { ...f, status } : f
          ),
        },
      };
    });
    fetch(`/api/findings/${findingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  },

  clearCurrentSearch: () => set({ currentSearch: null }),
}));
