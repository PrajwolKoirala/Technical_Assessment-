/**
 * Regulatory Adapter
 * Category: Contextual & Regulatory
 * Fetches data from public company registries and regulatory databases.
 */

import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity } from "@/types";

export class RegulatoryAdapter extends BaseAdapter {
  readonly id = "regulatory";
  readonly name = "Regulatory & Company Registry";
  readonly category = "regulatory" as const;
  readonly description =
    "Public company filings, SEC EDGAR data, and OpenCorporates records";

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const encoded = encodeURIComponent(entity.name);

    // ── 1. OpenCorporates (free tier, no key needed) ───────────────────────────
    try {
      const res = await fetch(
        `https://api.opencorporates.com/v0.4/companies/search?q=${encoded}&per_page=5`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const body = (await res.json()) as {
          results: {
            companies: {
              company: {
                name: string;
                jurisdiction_code: string;
                company_number: string;
                company_type: string | null;
                current_status: string | null;
                incorporation_date: string | null;
                opencorporates_url: string;
              };
            }[];
          };
        };
        const companies = body.results?.companies ?? [];
        for (const { company: c } of companies.slice(0, 3)) {
          const isActive =
            c.current_status?.toLowerCase().includes("active") ?? false;
          points.push({
            id: uuid(),
            title: `Registered Company: ${c.name}`,
            value: [
              `Jurisdiction: ${c.jurisdiction_code.toUpperCase()}`,
              c.company_type ? `Type: ${c.company_type}` : null,
              c.current_status ? `Status: ${c.current_status}` : null,
              c.incorporation_date ? `Incorporated: ${c.incorporation_date}` : null,
              `Reg #: ${c.company_number}`,
            ]
              .filter(Boolean)
              .join(" | "),
            sourceUrl: c.opencorporates_url,
            timestamp: ts,
            riskLevel: isActive ? "low" : "medium",
            confidence: "high",
          });
        }
      }
    } catch {
      // ignore
    }

    // ── 2. SEC EDGAR full-text search ────────────────────────────────────────
    try {
      const edgarRes = await fetch(
        `https://efts.sec.gov/LATEST/search-index?q=%22${encoded}%22&dateRange=custom&startdt=2020-01-01&forms=10-K,8-K,S-1`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (edgarRes.ok) {
        const body = (await edgarRes.json()) as {
          hits: { hits: { _source: { period_of_report: string; display_names: string[]; file_date: string; form_type: string } }[] };
        };
        const hits = body.hits?.hits ?? [];
        if (hits.length > 0) {
          points.push({
            id: uuid(),
            title: "SEC EDGAR Filings Found",
            value: `${hits.length} filing(s) found. Latest: ${hits[0]._source.form_type} on ${hits[0]._source.file_date}`,
            sourceUrl: `https://efts.sec.gov/LATEST/search-index?q=%22${encoded}%22`,
            timestamp: ts,
            riskLevel: "low",
            confidence: "high",
          });
        }
      }
    } catch {
      // ignore
    }

    // ── 3. EDGAR company search (direct) ─────────────────────────────────────
    try {
      const res = await fetch(
        `https://efts.sec.gov/LATEST/search-index?q=${encoded}&dateRange=custom&startdt=2015-01-01&forms=10-K`,
        { signal: AbortSignal.timeout(8000) }
      );
      // Just point to EDGAR search
      points.push({
        id: uuid(),
        title: "SEC EDGAR Search",
        value: `View ${entity.name} public filings on SEC EDGAR`,
        sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?company=${encoded}&CIK=&type=10-K&dateb=&owner=include&count=10&search_text=&action=getcompany`,
        timestamp: ts,
        riskLevel: "low",
        confidence: "low",
      });
    } catch {
      // ignore
    }

    // ── 4. Sanctions check hint (OFAC) ─────────────────────────────────────
    points.push({
      id: uuid(),
      title: "OFAC Sanctions Check",
      value: `Verify ${entity.name} against US Treasury OFAC sanctions list`,
      sourceUrl: `https://sanctionssearch.ofac.treas.gov/?keywords=${encoded}`,
      timestamp: ts,
      riskLevel: "unknown",
      confidence: "low",
    });

    // ── 5. OpenSanctions ─────────────────────────────────────────────────────
    try {
      const res = await fetch(
        `https://api.opensanctions.org/search/default?q=${encoded}&limit=3`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const body = (await res.json()) as {
          results: { caption: string; schema: string; datasets: string[]; id: string }[];
        };
        for (const r of (body.results ?? []).slice(0, 2)) {
          points.push({
            id: uuid(),
            title: `⚠️ Sanctions Match: ${r.caption}`,
            value: `Schema: ${r.schema} | Datasets: ${r.datasets.slice(0, 3).join(", ")}`,
            sourceUrl: `https://www.opensanctions.org/entities/${r.id}`,
            timestamp: ts,
            riskLevel: "critical",
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
