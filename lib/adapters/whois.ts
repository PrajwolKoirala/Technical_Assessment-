
import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity } from "@/types";

function domainVariants(name: string): string[] {
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const parts = clean.split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const all = parts.join("");
  const tlds = [".com", ".io", ".dev", ".me", ".net"];
  const bases = [...new Set([all, `${first}${last}`, `${first}-${last}`, first, last])];
  return bases.flatMap(b => tlds.map(t => b + t)).slice(0, 10);
}

async function rdapLookup(domain: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function dnsLookup(domain: string, type: string): Promise<string[]> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=${type}`,
      { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const d = await res.json() as { Answer?: { data: string; type: number }[]; Status: number };
    return d.Answer?.map(a => a.data) ?? [];
  } catch { return []; }
}

async function certTransparency(domain: string): Promise<string[]> {
  try {
    const res = await fetch(`https://crt.sh/?q=%.${domain}&output=json`,
      { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const certs = await res.json() as { name_value: string; not_before: string }[];
    return [...new Set(certs.slice(0, 20).map(c => c.name_value))].slice(0, 8);
  } catch { return []; }
}

export class WhoisAdapter extends BaseAdapter {
  readonly id = "whois";
  readonly name = "Domain & DNS Intelligence";
  readonly category = "technical" as const;
  readonly description = "WHOIS, DNS records, certificate transparency, and personal domain detection";

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const domains = domainVariants(entity.name);

    // ── For individuals: find personal domains ───────────────────────────────
    const activeDomains: string[] = [];
    await Promise.allSettled(
      domains.map(async (domain) => {
        const aRecords = await dnsLookup(domain, "A");
        if (aRecords.length > 0) activeDomains.push(domain);
      })
    );

    if (activeDomains.length > 0) {
      points.push({ id: uuid(), title: "Personal Domain(s) Found",
        value: activeDomains.join(", "),
        sourceUrl: `https://${activeDomains[0]}`, timestamp: ts,
        riskLevel: "low", confidence: "high" });
    }

    // ── Full RDAP for primary domain ──────────────────────────────────────────
    const primaryDomain = activeDomains[0] ?? domains[0];
    const rdap = await rdapLookup(primaryDomain);

    if (rdap) {
      const entities = (rdap.entities as { roles: string[]; vcardArray?: [string, [string, unknown, string, string][]] }[]) ?? [];
      const registrar = entities.find(e => (e.roles ?? []).includes("registrar"));
      const registrarName = registrar?.vcardArray?.[1]?.find(([k]) => k === "fn")?.[3] ?? "Unknown";

      points.push({ id: uuid(), title: "Domain",
        value: primaryDomain, sourceUrl: `https://rdap.org/domain/${primaryDomain}`,
        timestamp: ts, riskLevel: "low", confidence: "high" });

      points.push({ id: uuid(), title: "Registrar",
        value: String(registrarName),
        sourceUrl: `https://rdap.org/domain/${primaryDomain}`,
        timestamp: ts, riskLevel: "low", confidence: "high" });

      const events = (rdap.events as { eventAction: string; eventDate: string }[]) ?? [];
      for (const ev of events) {
        if (ev.eventAction === "registration" || ev.eventAction === "expiration") {
          points.push({ id: uuid(),
            title: ev.eventAction === "registration" ? "Registered On" : "Expires On",
            value: new Date(ev.eventDate).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }),
            sourceUrl: `https://rdap.org/domain/${primaryDomain}`,
            timestamp: ts, riskLevel: ev.eventAction === "expiration" ? "medium" : "low", confidence: "high" });
        }
      }
      const ns = rdap.nameservers as { ldhName: string }[];
      if (Array.isArray(ns) && ns.length > 0) {
        points.push({ id: uuid(), title: "Nameservers",
          value: ns.map(n => n.ldhName).join(", "),
          sourceUrl: `https://rdap.org/domain/${primaryDomain}`,
          timestamp: ts, riskLevel: "low", confidence: "high" });
      }
    } else if (activeDomains.length === 0) {
      // No personal domain found — report that clearly
      points.push({ id: uuid(), title: "No Personal Domain Detected",
        value: `Checked ${domains.slice(0,5).join(", ")} — no active DNS records found`,
        timestamp: ts, riskLevel: "low", confidence: "medium" });
    }

    // ── DNS records for active domain ────────────────────────────────────────
    if (activeDomains.length > 0) {
      const domain = activeDomains[0];
      const [aRec, mxRec, txtRec] = await Promise.all([
        dnsLookup(domain, "A"),
        dnsLookup(domain, "MX"),
        dnsLookup(domain, "TXT"),
      ]);
      if (aRec.length) points.push({ id: uuid(), title: "IPv4 Address",
        value: aRec.join(", "), timestamp: ts, riskLevel: "low", confidence: "high" });
      if (mxRec.length) points.push({ id: uuid(), title: "Mail Server (MX)",
        value: mxRec.slice(0,3).join(" | "), timestamp: ts, riskLevel: "low", confidence: "high" });

      // SPF in TXT records
      const spf = txtRec.find(t => t.startsWith("v=spf1"));
      if (spf) points.push({ id: uuid(), title: "SPF Record",
        value: spf, timestamp: ts, riskLevel: "low", confidence: "high" });

      // ── SSL Certificate Transparency ────────────────────────────────────────
      const subdomains = await certTransparency(domain);
      if (subdomains.length > 0) {
        points.push({ id: uuid(), title: "SSL Subdomains (crt.sh)",
          value: subdomains.join(", "),
          sourceUrl: `https://crt.sh/?q=%.${domain}`,
          timestamp: ts, riskLevel: "low", confidence: "high" });
      }
    }

    return points;
  }
}
