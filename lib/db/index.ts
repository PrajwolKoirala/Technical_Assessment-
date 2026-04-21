/**
 * lib/db/index.ts
 *
 * Auto-detects whether Prisma is available and exports the right store.
 *
 * Detection order:
 *   1. DATABASE_URL env var must be set
 *   2. @prisma/client must be resolvable (i.e. `prisma generate` was run)
 *
 * If either condition fails → falls back to the JSON file store silently.
 *
 * Usage (anywhere in the app — server-side only):
 *
 *   import { db } from "@/lib/db";
 *   await db.saveSearch(result);
 */

import { DbStore } from "./types";



function isPrismaAvailable(): boolean {
  // 1. Need a database URL
  if (!process.env.DATABASE_URL) return false;

  // 2. @prisma/client must be installed & generated
  try {
    require.resolve("@prisma/client");
    return true;
  } catch {
    return false;
  }
}

function createStore(): DbStore {
  if (isPrismaAvailable()) {
    console.log("[db] Prisma detected → using PrismaStore");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { prismaStore } = require("./prisma-store") as typeof import("./prisma-store.ts");
    return prismaStore;
  }

  console.log("[db] Prisma not configured → falling back to JSON file store");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { jsonStore } = require("./json-store") as typeof import("./json-store.ts");
  return jsonStore;
}

// Singleton — created once per process, stable across Next.js hot-reloads
// because Node caches the module.
const globalForDb = global as unknown as { __db?: DbStore };
export const db: DbStore = globalForDb.__db ?? (globalForDb.__db = createStore());

// Re-export the interface so callers can type-hint without importing from types
export type { DbStore } from "./types.ts";