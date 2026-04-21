/**
 * WHOIS Adapter
 * Category: Technical Infrastructure
 * Uses the public whois.arin.net REST API — no key required.
 */

import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity } from "@/types";

export class WhoisAdapter extends BaseAdapter {
  readonly id = "whois";
  readonly name = "WHOIS Lookup";
  readonly category = "technical" as const;
  readonly description = "Domain registration data via public WHOIS";

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();

    // Derive a likely domain from the entity name
    const domain = entity.name.toLowerCase().replace(/\s+/g, "") + ".com";

    // ── 1. Try rdap.org (REST-based WHOIS, no auth required) ──────────────────
    try {
      const res = await fetch(`https://rdap.org/domain/${domain}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;

        // Registrar
        const entities = (data.entities as Array<Record<string, unknown>>) ?? [];
        const registrar = entities.find(
          (e) =>
            Array.isArray(e.roles) &&
            (e.roles as string[]).includes("registrar")
        );
        const registrarName =
          (registrar?.vcardArray as [string, [string, unknown, string, string][]])?.[1]
            ?.find(([k]) => k === "fn")?.[3] ?? "Unknown";

        points.push({
          id: uuid(),
          title: "Domain",
          value: domain,
          sourceUrl: `https://rdap.org/domain/${domain}`,
          timestamp: ts,
          riskLevel: "low",
          confidence: "high",
        });

        points.push({
          id: uuid(),
          title: "Registrar",
          value: String(registrarName),
          sourceUrl: `https://rdap.org/domain/${domain}`,
          timestamp: ts,
          riskLevel: "low",
          confidence: "high",
        });

        // Events (registered / expiration)
        const events = (data.events as Array<{ eventAction: string; eventDate: string }>) ?? [];
        for (const ev of events) {
          if (ev.eventAction === "registration" || ev.eventAction === "expiration") {
            points.push({
              id: uuid(),
              title: ev.eventAction === "registration" ? "Registered On" : "Expires On",
              value: new Date(ev.eventDate).toLocaleDateString(),
              sourceUrl: `https://rdap.org/domain/${domain}`,
              timestamp: ts,
              riskLevel: ev.eventAction === "expiration" ? "medium" : "low",
              confidence: "high",
            });
          }
        }

        // Name servers
        const ns = data.nameservers as Array<{ ldhName: string }>;
        if (Array.isArray(ns) && ns.length > 0) {
          points.push({
            id: uuid(),
            title: "Name Servers",
            value: ns.map((n) => n.ldhName).join(", "),
            sourceUrl: `https://rdap.org/domain/${domain}`,
            timestamp: ts,
            riskLevel: "low",
            confidence: "high",
          });
        }
      }
    } catch {
      // fallback to static placeholder so dashboard always shows something
    }

    // ── 2. DNS over HTTPS (Cloudflare) ─────────────────────────────────────────
    try {
      const dohRes = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
        { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) }
      );
      if (dohRes.ok) {
        const doh = (await dohRes.json()) as {
          Answer?: { data: string; type: number }[];
          Status: number;
        };
        const aRecords =
          doh.Answer?.filter((a) => a.type === 1).map((a) => a.data) ?? [];

        if (aRecords.length > 0) {
          points.push({
            id: uuid(),
            title: "DNS A Records (IPv4)",
            value: aRecords.join(", "),
            sourceUrl: `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
            timestamp: ts,
            riskLevel: "low",
            confidence: "high",
          });
        }

        if (doh.Status !== 0) {
          points.push({
            id: uuid(),
            title: "DNS Status",
            value: `Domain may not exist (status ${doh.Status})`,
            timestamp: ts,
            riskLevel: "medium",
            confidence: "medium",
          });
        }
      }
    } catch {
      // ignore
    }

    // ── 3. MX records ──────────────────────────────────────────────────────────
    try {
      const mxRes = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`,
        { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) }
      );
      if (mxRes.ok) {
        const mx = (await mxRes.json()) as { Answer?: { data: string }[] };
        const mxRecords = mx.Answer?.map((a) => a.data) ?? [];
        if (mxRecords.length > 0) {
          points.push({
            id: uuid(),
            title: "MX Records (Mail)",
            value: mxRecords.slice(0, 3).join(" | "),
            timestamp: ts,
            riskLevel: "low",
            confidence: "high",
          });
        }
      }
    } catch {
      // ignore
    }

    return points;
  }
}
