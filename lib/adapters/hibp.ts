/**
 * HaveIBeenPwned Adapter
 * Category: Technical Infrastructure
 * Checks for data breaches associated with the entity's likely domain.
 * Full breach check requires an API key (HIBP_API_KEY).
 * Falls back to public breach list metadata.
 */

import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity } from "@/types";

interface Breach {
  Name: string;
  Domain: string;
  BreachDate: string;
  PwnCount: number;
  DataClasses: string[];
  IsVerified: boolean;
}

export class HibpAdapter extends BaseAdapter {
  readonly id = "hibp";
  readonly name = "Data Breach Check";
  readonly category = "technical" as const;
  readonly description =
    "Checks HaveIBeenPwned for data breaches linked to the entity's domain";

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const domain = entity.name.toLowerCase().replace(/\s+/g, "") + ".com";

    // ── 1. If HIBP_API_KEY is set, use the domain endpoint ────────────────────
    const apiKey = process.env.HIBP_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(
          `https://haveibeenpwned.com/api/v3/breacheddomain/${domain}`,
          {
            headers: {
              "hibp-api-key": apiKey,
              "User-Agent": "OSINT-Assessment-App",
            },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (res.status === 200) {
          const emails = (await res.json()) as Record<string, string[]>;
          const count = Object.keys(emails).length;
          points.push({
            id: uuid(),
            title: "⚠️ Breached Email Accounts",
            value: `${count} account(s) from @${domain} found in breaches`,
            sourceUrl: `https://haveibeenpwned.com/`,
            timestamp: ts,
            riskLevel: count > 10 ? "critical" : count > 0 ? "high" : "low",
            confidence: "high",
          });
        } else if (res.status === 404) {
          points.push({
            id: uuid(),
            title: "No Breached Accounts",
            value: `No accounts from @${domain} found in HIBP database`,
            sourceUrl: "https://haveibeenpwned.com/",
            timestamp: ts,
            riskLevel: "low",
            confidence: "high",
          });
        }
      } catch {
        // fall through
      }
    }

    // ── 2. Public breach list for the domain ──────────────────────────────────
    try {
      const res = await fetch(
        `https://haveibeenpwned.com/api/v3/breaches?domain=${domain}`,
        {
          headers: apiKey
            ? { "hibp-api-key": apiKey, "User-Agent": "OSINT-Assessment-App" }
            : { "User-Agent": "OSINT-Assessment-App" },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const breaches = (await res.json()) as Breach[];
        for (const b of breaches) {
          points.push({
            id: uuid(),
            title: `Data Breach: ${b.Name}`,
            value: `Date: ${b.BreachDate} | Records exposed: ${b.PwnCount.toLocaleString()} | Data: ${b.DataClasses.slice(0, 4).join(", ")}`,
            sourceUrl: `https://haveibeenpwned.com/PwnedWebsites`,
            timestamp: ts,
            riskLevel: b.PwnCount > 1_000_000 ? "critical" : "high",
            confidence: b.IsVerified ? "high" : "medium",
          });
        }

        if (breaches.length === 0 && points.length === 0) {
          points.push({
            id: uuid(),
            title: "No Known Data Breaches",
            value: `Domain ${domain} has no known breaches in HIBP`,
            sourceUrl: "https://haveibeenpwned.com/",
            timestamp: ts,
            riskLevel: "low",
            confidence: "medium",
          });
        }
      }
    } catch {
      // ignore
    }

    // ── 3. Pastes endpoint (requires key) ─────────────────────────────────────
    if (points.length === 0) {
      points.push({
        id: uuid(),
        title: "Breach Check",
        value: `Set HIBP_API_KEY in .env.local for full breach analysis of ${domain}`,
        timestamp: ts,
        riskLevel: "unknown",
        confidence: "low",
      });
    }

    return points;
  }
}
