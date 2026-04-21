/**
 * News Adapter
 * Category: Contextual & Regulatory
 * Uses NewsAPI.org (requires free API key: NEWS_API_KEY).
 * Falls back to GNews public API if primary fails.
 */

import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity, RiskLevel } from "@/types";

interface NewsApiArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: { name: string };
}

interface GNewsArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: { name: string };
}

/** Simple risk classification based on headline keywords */
function classifyHeadline(text: string): RiskLevel {
  const t = text.toLowerCase();
  const critical = ["fraud", "scam", "criminal", "arrested", "indicted", "lawsuit", "bankrupt", "hack", "breach", "exposed"];
  const high = ["investigation", "scandal", "controversy", "fine", "penalty", "layoff", "fired", "sued", "violation"];
  const medium = ["concern", "issue", "complaint", "problem", "dispute", "warning", "risk"];
  if (critical.some((w) => t.includes(w))) return "critical";
  if (high.some((w) => t.includes(w))) return "high";
  if (medium.some((w) => t.includes(w))) return "medium";
  return "low";
}

export class NewsAdapter extends BaseAdapter {
  readonly id = "news";
  readonly name = "News & Media";
  readonly category = "regulatory" as const;
  readonly description = "Recent news articles mentioning the entity";

  isAvailable(): boolean {
    return true; // always try; falls back gracefully
  }

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const query = encodeURIComponent(entity.name);

    // ── 1. NewsAPI.org ─────────────────────────────────────────────────────────
    const newsApiKey = process.env.NEWS_API_KEY;
    if (newsApiKey) {
      try {
        const res = await fetch(
          `https://newsapi.org/v2/everything?q=${query}&sortBy=relevancy&pageSize=8&language=en&apiKey=${newsApiKey}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          const body = (await res.json()) as { articles: NewsApiArticle[] };
          for (const a of body.articles.slice(0, 6)) {
            if (!a.title || a.title === "[Removed]") continue;
            points.push({
              id: uuid(),
              title: a.title,
              value: a.description ?? a.source.name,
              sourceUrl: a.url,
              timestamp: a.publishedAt,
              riskLevel: classifyHeadline(a.title + " " + (a.description ?? "")),
              confidence: "high",
            });
          }
        }
      } catch {
        // fall through
      }
    }

    // ── 2. GNews (no key for first 10/day) ────────────────────────────────────
    if (points.length === 0) {
      try {
        const gKey = process.env.GNEWS_API_KEY ?? "";
        const url = gKey
          ? `https://gnews.io/api/v4/search?q=${query}&lang=en&max=6&token=${gKey}`
          : `https://gnews.io/api/v4/search?q=${query}&lang=en&max=6`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const body = (await res.json()) as { articles: GNewsArticle[] };
          for (const a of body.articles.slice(0, 5)) {
            points.push({
              id: uuid(),
              title: a.title,
              value: a.description ?? a.source.name,
              sourceUrl: a.url,
              timestamp: a.publishedAt,
              riskLevel: classifyHeadline(a.title + " " + (a.description ?? "")),
              confidence: "medium",
            });
          }
        }
      } catch {
        // ignore
      }
    }

    // ── 3. Wikipedia summary (always available) ───────────────────────────────
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entity.name)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (wikiRes.ok) {
        const wiki = (await wikiRes.json()) as {
          title: string;
          extract: string;
          content_urls?: { desktop?: { page?: string } };
        };
        if (wiki.extract && !wiki.extract.toLowerCase().includes("may refer to")) {
          points.push({
            id: uuid(),
            title: `Wikipedia: ${wiki.title}`,
            value: wiki.extract.slice(0, 300) + (wiki.extract.length > 300 ? "…" : ""),
            sourceUrl: wiki.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(entity.name)}`,
            timestamp: ts,
            riskLevel: "low",
            confidence: "high",
          });
        }
      }
    } catch {
      // ignore
    }

    if (points.length === 0) {
      points.push({
        id: uuid(),
        title: "News Search",
        value: `Set NEWS_API_KEY or GNEWS_API_KEY in .env.local for full news coverage of "${entity.name}"`,
        timestamp: ts,
        riskLevel: "unknown",
        confidence: "low",
      });
    }

    return points;
  }
}
