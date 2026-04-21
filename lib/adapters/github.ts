/**
 * GitHub Adapter
 * Category: Technical Infrastructure
 * Uses the public GitHub REST API (unauthenticated, 60 req/hr).
 * Set GITHUB_TOKEN env var for 5000 req/hr.
 */

import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity } from "@/types";

interface GHRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  fork: boolean;
}

interface GHUser {
  login: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  blog: string | null;
  company: string | null;
  location: string | null;
  html_url: string;
  created_at: string;
}

interface GHOrg {
  login: string;
  description: string | null;
  public_repos: number;
  html_url: string;
  blog: string | null;
  location: string | null;
}

export class GitHubAdapter extends BaseAdapter {
  readonly id = "github";
  readonly name = "GitHub";
  readonly category = "technical" as const;
  readonly description = "Public repositories and profile data from GitHub";

  private get headers() {
    const h: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) h["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    return h;
  }

  private slug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, "");
  }

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const slug = this.slug(entity.name);

    // ── 1. Try as org ──────────────────────────────────────────────────────────
    if (entity.type === "company") {
      try {
        const res = await fetch(`https://api.github.com/orgs/${slug}`, {
          headers: this.headers,
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const org = (await res.json()) as GHOrg;
          points.push({
            id: uuid(),
            title: "GitHub Organization",
            value: `@${org.login} — ${org.public_repos} public repositories`,
            sourceUrl: org.html_url,
            timestamp: ts,
            riskLevel: "low",
            confidence: "high",
          });
          if (org.description) {
            points.push({
              id: uuid(),
              title: "GitHub Bio",
              value: org.description,
              sourceUrl: org.html_url,
              timestamp: ts,
              riskLevel: "low",
              confidence: "high",
            });
          }
          if (org.blog) {
            points.push({
              id: uuid(),
              title: "Website (GitHub)",
              value: org.blog,
              sourceUrl: org.html_url,
              timestamp: ts,
              riskLevel: "low",
              confidence: "medium",
            });
          }

          // Top repos
          const reposRes = await fetch(
            `https://api.github.com/orgs/${slug}/repos?sort=stars&per_page=5`,
            { headers: this.headers, signal: AbortSignal.timeout(8000) }
          );
          if (reposRes.ok) {
            const repos = (await reposRes.json()) as GHRepo[];
            for (const r of repos.filter((x) => !x.fork)) {
              points.push({
                id: uuid(),
                title: `Repo: ${r.name}`,
                value: `${r.description ?? "No description"} (★ ${r.stargazers_count}${r.language ? `, ${r.language}` : ""})`,
                sourceUrl: r.html_url,
                timestamp: r.updated_at,
                riskLevel: "low",
                confidence: "high",
              });
            }
          }
          return points;
        }
      } catch {
        // fall through to user lookup
      }
    }

    // ── 2. Try as user ─────────────────────────────────────────────────────────
    try {
      const res = await fetch(`https://api.github.com/users/${slug}`, {
        headers: this.headers,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const user = (await res.json()) as GHUser;
        points.push({
          id: uuid(),
          title: "GitHub Profile",
          value: `${user.name ?? user.login} — ${user.public_repos} repos, ${user.followers} followers`,
          sourceUrl: user.html_url,
          timestamp: ts,
          riskLevel: "low",
          confidence: "high",
        });
        if (user.bio) {
          points.push({
            id: uuid(),
            title: "GitHub Bio",
            value: user.bio,
            sourceUrl: user.html_url,
            timestamp: ts,
            riskLevel: "low",
            confidence: "high",
          });
        }
        if (user.company) {
          points.push({
            id: uuid(),
            title: "Employer (GitHub)",
            value: user.company,
            sourceUrl: user.html_url,
            timestamp: ts,
            riskLevel: "low",
            confidence: "medium",
          });
        }
        if (user.location) {
          points.push({
            id: uuid(),
            title: "Location (GitHub)",
            value: user.location,
            sourceUrl: user.html_url,
            timestamp: ts,
            riskLevel: "low",
            confidence: "medium",
          });
        }

        // Repos
        const reposRes = await fetch(
          `https://api.github.com/users/${slug}/repos?sort=stars&per_page=5`,
          { headers: this.headers, signal: AbortSignal.timeout(8000) }
        );
        if (reposRes.ok) {
          const repos = (await reposRes.json()) as GHRepo[];
          for (const r of repos.filter((x) => !x.fork).slice(0, 4)) {
            points.push({
              id: uuid(),
              title: `Repo: ${r.name}`,
              value: `${r.description ?? "No description"} (★ ${r.stargazers_count})`,
              sourceUrl: r.html_url,
              timestamp: r.updated_at,
              riskLevel: "low",
              confidence: "high",
            });
          }
        }
      }
    } catch {
      // ignore
    }

    // ── 3. Search (fallback) ───────────────────────────────────────────────────
    if (points.length === 0) {
      try {
        const res = await fetch(
          `https://api.github.com/search/users?q=${encodeURIComponent(entity.name)}&per_page=3`,
          { headers: this.headers, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const search = (await res.json()) as { items: GHUser[] };
          for (const u of search.items.slice(0, 2)) {
            points.push({
              id: uuid(),
              title: `Possible GitHub Profile: ${u.login}`,
              value: u.html_url,
              sourceUrl: u.html_url,
              timestamp: ts,
              riskLevel: "low",
              confidence: "low",
            });
          }
        }
      } catch {
        // ignore
      }
    }

    return points;
  }
}
