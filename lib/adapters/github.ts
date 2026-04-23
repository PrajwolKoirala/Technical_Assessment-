/**
 * GitHub Adapter — v3
 * Tries many username slug variants for individuals.
 * Returns repos, contributions, languages, pinned repos, activity.
 */

import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity } from "@/types";

interface GHUser {
  login: string; name: string | null; bio?: string; company?: string;
  avatar_url?: string; blog?: string; location?: string; html_url: string;
  public_repos: number; followers: number; following: number;
  created_at: string; twitter_username?: string;
}
interface GHRepo {
  name: string; description: string | null; html_url: string;
  stargazers_count: number; language: string | null; updated_at: string; fork: boolean;
  topics?: string[];
}

function slugVariants(name: string): string[] {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.toLowerCase() ?? "";
  const last = parts[parts.length - 1]?.toLowerCase() ?? "";
  const clean = (s: string) => s.replace(/[^a-z0-9-]/g, "");
  return [
    ...new Set([
      clean(name.toLowerCase().replace(/\s+/g, "")),
      clean(`${first}${last}`),
      clean(`${first}-${last}`),
      clean(`${first}.${last}`),
      clean(first),
      clean(last),
    ])
  ].filter(s => s.length >= 2);
}

export class GitHubAdapter extends BaseAdapter {
  readonly id = "github";
  readonly name = "GitHub";
  readonly category = "technical" as const;
  readonly description = "Public repositories, developer profile, and code contributions";

  private get headers() {
    const h: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) h["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    return h;
  }

  private async tryUser(slug: string): Promise<GHUser | null> {
    try {
      const res = await fetch(`https://api.github.com/users/${slug}`,
        { headers: this.headers, signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      return await res.json() as GHUser;
    } catch { return null; }
  }

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const slugs = slugVariants(entity.name);

    // ── Try all slug variants ─────────────────────────────────────────────────
    let found: GHUser | null = null;
    let foundSlug = "";

    // Company: try org endpoint first
    if (entity.type === "company") {
      for (const s of slugs) {
        try {
          const res = await fetch(`https://api.github.com/orgs/${s}`,
            { headers: this.headers, signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const org = await res.json() as GHUser & { description?: string };
            found = { ...org, bio: org.description };
            foundSlug = s;
            break;
          }
        } catch { /* ignore */ }
      }
    }

    // User lookup
    if (!found) {
      for (const s of slugs) {
        const u = await this.tryUser(s);
        if (u && (u.name?.toLowerCase().includes(entity.name.split(" ")[0].toLowerCase()) || u.public_repos > 0)) {
          found = u;
          foundSlug = s;
          break;
        }
      }
    }

    if (found) {
      // Profile overview
      const parts = [
        found.public_repos > 0 ? `${found.public_repos} public repos` : null,
        found.followers > 0 ? `${found.followers} followers` : null,
        found.following > 0 ? `following ${found.following}` : null,
      ].filter(Boolean);
      points.push({ id: uuid(), title: `GitHub: ${found.name ?? found.login}`,
        value: parts.join(" · ") + (found.bio ? ` — "${found.bio}"` : ""),
        sourceUrl: found.html_url, timestamp: ts, riskLevel: "low", confidence: "high" });

      if (found.location) points.push({ id: uuid(), title: "Location (GitHub)",
        value: found.location, sourceUrl: found.html_url, timestamp: ts,
        riskLevel: "low", confidence: "high" });

      if ((found as GHUser).company) points.push({ id: uuid(), title: "Company/Employer (GitHub)",
        value: (found as GHUser).company!, sourceUrl: found.html_url, timestamp: ts,
        riskLevel: "low", confidence: "high" });

      if (found.blog) points.push({ id: uuid(), title: "Website (GitHub)",
        value: found.blog, sourceUrl: found.blog.startsWith("http") ? found.blog : `https://${found.blog}`,
        timestamp: ts, riskLevel: "low", confidence: "high" });

      if ((found as GHUser).twitter_username) points.push({ id: uuid(),
        title: "Twitter (GitHub)", value: `@${(found as GHUser).twitter_username}`,
        sourceUrl: `https://x.com/${(found as GHUser).twitter_username}`,
        timestamp: ts, riskLevel: "low", confidence: "high" });

      const joinedYear = new Date(found.created_at).getFullYear();
      points.push({ id: uuid(), title: "GitHub Member Since",
        value: `${joinedYear} (${new Date().getFullYear() - joinedYear} years on GitHub)`,
        sourceUrl: found.html_url, timestamp: ts, riskLevel: "low", confidence: "high" });

      // Top repos
      try {
        const reposRes = await fetch(
          `https://api.github.com/users/${foundSlug}/repos?sort=stars&per_page=8&type=owner`,
          { headers: this.headers, signal: AbortSignal.timeout(8000) });
        if (reposRes.ok) {
          const repos = (await reposRes.json() as GHRepo[]).filter(r => !r.fork);
          // Language breakdown
          const langs = repos.map(r => r.language).filter(Boolean);
          const langCounts = langs.reduce<Record<string, number>>((acc, l) => { acc[l!] = (acc[l!] || 0) + 1; return acc; }, {});
          const topLangs = Object.entries(langCounts).sort((a,b) => b[1]-a[1]).slice(0,4).map(([l]) => l);
          if (topLangs.length > 0) {
            points.push({ id: uuid(), title: "Primary Languages",
              value: topLangs.join(", "), sourceUrl: found.html_url,
              timestamp: ts, riskLevel: "low", confidence: "high" });
          }
          // Top repos
          for (const r of repos.slice(0, 4)) {
            const topics = r.topics?.slice(0,3).join(", ");
            points.push({ id: uuid(), title: `Repo: ${r.name}`,
              value: `${r.description ?? "No description"} · ★${r.stargazers_count}${r.language ? ` · ${r.language}` : ""}${topics ? ` · [${topics}]` : ""}`,
              sourceUrl: r.html_url, timestamp: r.updated_at,
              riskLevel: "low", confidence: "high" });
          }
          // Total stars
          const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
          if (totalStars > 0) points.push({ id: uuid(), title: "Total GitHub Stars",
            value: `${totalStars} stars across ${repos.length} original repositories`,
            sourceUrl: found.html_url, timestamp: ts, riskLevel: "low", confidence: "high" });
        }
      } catch { /* ignore */ }

      // Recent activity via events
      try {
        const evRes = await fetch(`https://api.github.com/users/${foundSlug}/events/public?per_page=10`,
          { headers: this.headers, signal: AbortSignal.timeout(6000) });
        if (evRes.ok) {
          const events = (await evRes.json() as { type: string; repo: { name: string }; created_at: string }[]);
          const recent = events[0];
          if (recent) {
            points.push({ id: uuid(), title: "Latest GitHub Activity",
              value: `${recent.type.replace("Event","")} on ${recent.repo.name} (${new Date(recent.created_at).toLocaleDateString()})`,
              sourceUrl: `https://github.com/${recent.repo.name}`,
              timestamp: recent.created_at, riskLevel: "low", confidence: "high" });
          }
        }
      } catch { /* ignore */ }
    } else {
      // Fallback: GitHub search
      try {
        const res = await fetch(
          `https://api.github.com/search/users?q=${encodeURIComponent(entity.name)}+in:fullname&per_page=5`,
          { headers: this.headers, signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data = (await res.json() as { items: GHUser[] });
          for (const u of (data.items ?? []).slice(0, 3)) {
            points.push({ id: uuid(), title: `GitHub Match: ${u.login}`,
              value: `Potential profile — ${u.html_url}`,
              sourceUrl: u.html_url, timestamp: ts, riskLevel: "low", confidence: "low" });
          }
        }
      } catch { /* ignore */ }
    }

    return points;
  }
}
