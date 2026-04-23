/**
 * News & Media Adapter — v3
 * Uses NewsAPI + GNews + Wikipedia + DuckDuckGo instant answer.
 */

import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity, RiskLevel } from "@/types";

function classifyHeadline(text: string): RiskLevel {
  const t = text.toLowerCase();
  if (["fraud","scam","criminal","arrested","indicted","bankrupt","hack","breach","convicted"].some(w => t.includes(w))) return "critical";
  if (["investigation","scandal","fine","penalty","sued","violation","lawsuit","controversy"].some(w => t.includes(w))) return "high";
  if (["concern","complaint","dispute","warning","risk","allegation"].some(w => t.includes(w))) return "medium";
  return "low";
}

export class NewsAdapter extends BaseAdapter {
  readonly id = "news";
  readonly name = "News & Media";
  readonly category = "regulatory" as const;
  readonly description = "Recent news, Wikipedia, and media mentions";

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const encoded = encodeURIComponent(entity.name);

    // ── 1. NewsAPI ────────────────────────────────────────────────────────────
    const newsKey = process.env.NEWS_API_KEY;
    if (newsKey) {
      try {
        const res = await fetch(
          `https://newsapi.org/v2/everything?q="${encoded}"&sortBy=relevancy&pageSize=8&language=en&apiKey=${newsKey}`,
          { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const body = (await res.json()) as { articles: { title: string; description: string | null; url: string; publishedAt: string; source: { name: string } }[] };
          for (const a of (body.articles ?? []).slice(0, 6)) {
            if (!a.title || a.title === "[Removed]") continue;
            points.push({ id: uuid(), title: a.title,
              value: `${a.source.name} — ${a.description ?? "No description"}`,
              sourceUrl: a.url, timestamp: a.publishedAt,
              riskLevel: classifyHeadline(a.title + " " + (a.description ?? "")),
              confidence: "high" });
          }
        }
      } catch { /* ignore */ }
    }

    // ── 2. GNews ──────────────────────────────────────────────────────────────
    if (points.length < 3) {
      const gKey = process.env.GNEWS_API_KEY ?? "";
      try {
        const url = gKey
          ? `https://gnews.io/api/v4/search?q="${encoded}"&lang=en&max=6&token=${gKey}`
          : `https://gnews.io/api/v4/search?q=${encoded}&lang=en&max=6`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const body = (await res.json()) as { articles: { title: string; description: string | null; url: string; publishedAt: string; source: { name: string } }[] };
          for (const a of (body.articles ?? []).slice(0, 5)) {
            points.push({ id: uuid(), title: a.title,
              value: `${a.source.name} — ${a.description ?? ""}`,
              sourceUrl: a.url, timestamp: a.publishedAt,
              riskLevel: classifyHeadline(a.title + " " + (a.description ?? "")),
              confidence: "medium" });
          }
        }
      } catch { /* ignore */ }
    }

    // ── 3. Wikipedia full article intro ──────────────────────────────────────
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entity.name)}`,
        { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const wiki = (await res.json()) as { title: string; extract: string; content_urls?: { desktop?: { page?: string } }; thumbnail?: { source: string } };
        if (wiki.extract && !wiki.extract.toLowerCase().includes("may refer to")) {
          points.push({ id: uuid(), title: `Wikipedia: ${wiki.title}`,
            value: wiki.extract.slice(0, 500),
            sourceUrl: wiki.content_urls?.desktop?.page,
            timestamp: ts, riskLevel: "low", confidence: "high" });
        }
      }
    } catch { /* ignore */ }

    // ── 4. DuckDuckGo Instant Answer ─────────────────────────────────────────
    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&skip_disambig=1`,
        { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const ddg = (await res.json()) as { AbstractText: string; AbstractURL: string; AbstractSource: string; Heading: string; Image: string; RelatedTopics: { Text: string; FirstURL: string }[] };
        if (ddg.AbstractText && ddg.AbstractText.length > 30) {
          points.push({ id: uuid(), title: `DuckDuckGo: ${ddg.Heading || entity.name}`,
            value: ddg.AbstractText.slice(0, 400),
            sourceUrl: ddg.AbstractURL || undefined,
            timestamp: ts, riskLevel: "low", confidence: "high" });
        }
        // Related topics
        for (const topic of (ddg.RelatedTopics ?? []).slice(0, 3)) {
          if (topic.Text && topic.FirstURL) {
            points.push({ id: uuid(), title: "Related: " + topic.Text.slice(0, 60),
              value: topic.Text.slice(0, 200),
              sourceUrl: topic.FirstURL,
              timestamp: ts, riskLevel: "low", confidence: "medium" });
          }
        }
      }
    } catch { /* ignore */ }

    if (points.length === 0) {
      points.push({ id: uuid(), title: "News Coverage",
        value: `No news articles found. Add NEWS_API_KEY to .env.local for broader coverage of "${entity.name}"`,
        timestamp: ts, riskLevel: "unknown", confidence: "low" });
    }

    return points;
  }
}
