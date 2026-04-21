/**
 * Social Footprint Adapter
 * Category: Social & Public Footprint
 * Aggregates publicly accessible social signals: Twitter/X search,
 * LinkedIn profile hints, and Google Custom Search (if key set).
 */

import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity } from "@/types";

export class SocialAdapter extends BaseAdapter {
  readonly id = "social";
  readonly name = "Social & Web Presence";
  readonly category = "social" as const;
  readonly description =
    "Social media footprint, public web mentions, and professional profiles";

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const encoded = encodeURIComponent(entity.name);

    // ── 1. Google Custom Search ───────────────────────────────────────────────
    const gcxKey = process.env.GOOGLE_SEARCH_API_KEY;
    const gcxCx = process.env.GOOGLE_SEARCH_CX;
    if (gcxKey && gcxCx) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/customsearch/v1?q=${encoded}&key=${gcxKey}&cx=${gcxCx}&num=8`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          const body = (await res.json()) as {
            items: { title: string; snippet: string; link: string }[];
          };
          for (const item of (body.items ?? []).slice(0, 5)) {
            points.push({
              id: uuid(),
              title: item.title,
              value: item.snippet,
              sourceUrl: item.link,
              timestamp: ts,
              riskLevel: "low",
              confidence: "high",
            });
          }
        }
      } catch {
        // ignore
      }
    }

    // ── 2. LinkedIn heuristic (public profile URL pattern) ───────────────────
    const liSlug = entity.name.toLowerCase().replace(/\s+/g, "-");
    const liUrl =
      entity.type === "company"
        ? `https://www.linkedin.com/company/${liSlug}`
        : `https://www.linkedin.com/in/${liSlug}`;
    points.push({
      id: uuid(),
      title: "LinkedIn (Potential Profile)",
      value: liUrl,
      sourceUrl: liUrl,
      timestamp: ts,
      riskLevel: "low",
      confidence: "low",
    });

    // ── 3. Twitter/X search URL ───────────────────────────────────────────────
    points.push({
      id: uuid(),
      title: "Twitter/X Search",
      value: `View mentions of "${entity.name}" on X/Twitter`,
      sourceUrl: `https://x.com/search?q=${encoded}&src=typed_query`,
      timestamp: ts,
      riskLevel: "low",
      confidence: "low",
    });

    // ── 4. Wikipedia Wikidata entity search ───────────────────────────────────
    try {
      const wdRes = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encoded}&language=en&format=json&origin=*&limit=3`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (wdRes.ok) {
        const wd = (await wdRes.json()) as {
          search: { label: string; description: string; url: string; concepturi: string }[];
        };
        for (const item of (wd.search ?? []).slice(0, 2)) {
          if (item.description) {
            points.push({
              id: uuid(),
              title: `Wikidata: ${item.label}`,
              value: item.description,
              sourceUrl: item.concepturi,
              timestamp: ts,
              riskLevel: "low",
              confidence: "medium",
            });
          }
        }
      }
    } catch {
      // ignore
    }

    // ── 5. ClearBit logo / company metadata (public endpoint) ────────────────
    if (entity.type === "company") {
      const domain = entity.name.toLowerCase().replace(/\s+/g, "") + ".com";
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encoded}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const companies = (await res.json()) as { name: string; domain: string; logo: string }[];
          for (const c of companies.slice(0, 2)) {
            if (c.name.toLowerCase().includes(entity.name.toLowerCase().split(" ")[0].toLowerCase())) {
              points.push({
                id: uuid(),
                title: `Company Match: ${c.name}`,
                value: `Domain: ${c.domain}`,
                sourceUrl: `https://${c.domain}`,
                timestamp: ts,
                riskLevel: "low",
                confidence: "medium",
              });
            }
          }
        }
      } catch {
        // ignore
      }

      // ── 6. Crunchbase (public search hint) ───────────────────────────────────
      points.push({
        id: uuid(),
        title: "Crunchbase (Company Intelligence)",
        value: `Search ${entity.name} on Crunchbase for funding, investors & more`,
        sourceUrl: `https://www.crunchbase.com/search/organizations/field/organizations/facet_ids/company?q=${encoded}`,
        timestamp: ts,
        riskLevel: "low",
        confidence: "low",
      });
    }

    return points;
  }
}
