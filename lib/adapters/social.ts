
import { BaseAdapter, uuid } from "./base";
import { DataPoint, SearchEntity } from "@/types";

function nameVariants(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.toLowerCase() ?? "";
  const last = parts[parts.length - 1]?.toLowerCase() ?? "";
  return {
    slug: name.toLowerCase().replace(/\s+/g, ""),           
    hyphen: name.toLowerCase().replace(/\s+/g, "-"),        
    dot: name.toLowerCase().replace(/\s+/g, "."),            
    first, last,
    firstLast: `${first}${last}`,                            
    firstDotLast: `${first}.${last}`,                        
    initials: parts.map(p => p[0]?.toLowerCase()).join(""), 
  };
}

export class SocialAdapter extends BaseAdapter {
  readonly id = "social";
  readonly name = "Social & Web Presence";
  readonly category = "social" as const;
  readonly description = "Social media footprint, developer profiles, and public web mentions";

  async fetch(entity: SearchEntity): Promise<DataPoint[]> {
    const points: DataPoint[] = [];
    const ts = new Date().toISOString();
    const encoded = encodeURIComponent(entity.name);
    const v = nameVariants(entity.name);

    // ── 1. Google Custom Search ──────────────────────────────────────────────
    const gcxKey = process.env.GOOGLE_SEARCH_API_KEY;
    const gcxCx  = process.env.GOOGLE_SEARCH_CX;
    if (gcxKey && gcxCx) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/customsearch/v1?q=${encoded}&key=${gcxKey}&cx=${gcxCx}&num=10`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          const body = (await res.json()) as { items?: { title: string; snippet: string; link: string }[] };
          for (const item of (body.items ?? []).slice(0, 6)) {
            points.push({ id: uuid(), title: item.title, value: item.snippet,
              sourceUrl: item.link, timestamp: ts, riskLevel: "low", confidence: "high" });
          }
        }
      } catch { /* ignore */ }
    }

    // ── 2. Wikipedia ─────────────────────────────────────────────────────────
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entity.name)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { title: string; extract: string; content_urls?: { desktop?: { page?: string } }; thumbnail?: { source: string } };
        if (data.extract && !data.extract.toLowerCase().includes("may refer to")) {
          points.push({ id: uuid(), title: `Wikipedia: ${data.title}`,
            value: data.extract.slice(0, 400),
            sourceUrl: data.content_urls?.desktop?.page,
            timestamp: ts, riskLevel: "low", confidence: "high" });
        }
      }
    } catch { /* ignore */ }

    // ── 3. Wikidata ──────────────────────────────────────────────────────────
    try {
      const res = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encoded}&language=en&format=json&origin=*&limit=5`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const wd = (await res.json()) as { search: { label: string; description: string; concepturi: string }[] };
        for (const item of (wd.search ?? []).slice(0, 2)) {
          if (item.description) {
            points.push({ id: uuid(), title: `Wikidata: ${item.label}`, value: item.description,
              sourceUrl: item.concepturi, timestamp: ts, riskLevel: "low", confidence: "medium" });
          }
        }
      }
    } catch { /* ignore */ }

    // ── 4. dev.to profile ────────────────────────────────────────────────────
    for (const slug of [v.slug, v.hyphen, v.firstLast]) {
      try {
        const res = await fetch(`https://dev.to/api/users/by_username?url=${slug}`,
          { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const u = (await res.json()) as { name: string; username: string; summary?: string; location?: string; github_username?: string; twitter_username?: string; profile_image: string; joined_at: string };
          if (u.name) {
            points.push({ id: uuid(), title: `dev.to Profile: ${u.name}`,
              value: [u.summary, u.location ? `📍 ${u.location}` : null, u.joined_at ? `Joined ${new Date(u.joined_at).getFullYear()}` : null].filter(Boolean).join(" · ") || `Developer at dev.to/@${u.username}`,
              sourceUrl: `https://dev.to/${u.username}`, timestamp: ts, riskLevel: "low", confidence: "high" });
            if (u.github_username) {
              points.push({ id: uuid(), title: "GitHub Username (via dev.to)",
                value: `@${u.github_username}`, sourceUrl: `https://github.com/${u.github_username}`,
                timestamp: ts, riskLevel: "low", confidence: "high" });
            }
            break;
          }
        }
      } catch { /* ignore */ }
    }

    // ── 5. npm registry (for developers) ────────────────────────────────────
    for (const slug of [v.slug, v.hyphen, v.firstLast]) {
      try {
        const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=author:${slug}&size=5`,
          { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = (await res.json()) as { objects: { package: { name: string; description: string; links: { npm: string }; version: string; date: string } }[] };
          const pkgs = data.objects ?? [];
          if (pkgs.length > 0) {
            points.push({ id: uuid(), title: `npm Packages (${pkgs.length} found)`,
              value: pkgs.slice(0, 4).map(p => `${p.package.name} v${p.package.version}: ${p.package.description ?? "no description"}`).join(" | "),
              sourceUrl: `https://www.npmjs.com/~${slug}`, timestamp: ts, riskLevel: "low", confidence: "high" });
            break;
          }
        }
      } catch { /* ignore */ }
    }

    // ── 6. Gravatar (email-based avatar) ─────────────────────────────────────
    // Try common email patterns with MD5 hash
    const possibleEmails = [
      `${v.first}@gmail.com`, `${v.firstLast}@gmail.com`,
      `${v.first}.${v.last}@gmail.com`, `${v.firstLast}@outlook.com`,
    ];
    for (const email of possibleEmails.slice(0, 2)) {
      try {
        const msgBuffer = new TextEncoder().encode(email.trim().toLowerCase());
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404&s=200`;
        const res = await fetch(gravatarUrl, { method: "HEAD", signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          points.push({ id: uuid(), title: "Gravatar Profile Found",
            value: `Public avatar linked to ${email} — profile may contain additional info`,
            sourceUrl: `https://www.gravatar.com/${hash}`, timestamp: ts,
            riskLevel: "medium", confidence: "medium" });
          break;
        }
      } catch { /* ignore */ }
    }

    // ── 7. Medium ────────────────────────────────────────────────────────────
    for (const slug of [v.slug, v.hyphen, `@${v.slug}`]) {
      try {
        const res = await fetch(`https://medium.com/@${v.slug}`,
          { method: "HEAD", signal: AbortSignal.timeout(4000), redirect: "follow" });
        if (res.ok && res.url.includes("medium.com/@")) {
          points.push({ id: uuid(), title: "Medium Profile (Potential)",
            value: `Possible writing/blogging profile at medium.com/@${v.slug}`,
            sourceUrl: `https://medium.com/@${v.slug}`, timestamp: ts,
            riskLevel: "low", confidence: "low" });
          break;
        }
      } catch { /* ignore */ }
    }

    // ── 8. Stack Overflow ────────────────────────────────────────────────────
    try {
      const res = await fetch(
        `https://api.stackexchange.com/2.3/users?inname=${encodeURIComponent(entity.name)}&site=stackoverflow&pagesize=3&order=desc&sort=reputation`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { items: { display_name: string; reputation: number; link: string; location?: string; profile_image: string }[] };
        for (const u of (data.items ?? []).slice(0, 2)) {
          if (u.display_name.toLowerCase().includes(v.first) || u.display_name.toLowerCase().includes(v.last)) {
            points.push({ id: uuid(), title: `Stack Overflow: ${u.display_name}`,
              value: `Reputation: ${u.reputation.toLocaleString()}${u.location ? ` · 📍 ${u.location}` : ""}`,
              sourceUrl: u.link, timestamp: ts, riskLevel: "low", confidence: "medium" });
          }
        }
      }
    } catch { /* ignore */ }

    // ── 9. LinkedIn ──────────────────────────────────────────────────────────
    // Build multiple LinkedIn URL variants and check HEAD
    const liVariants = entity.type === "company"
      ? [`https://www.linkedin.com/company/${v.slug}`, `https://www.linkedin.com/company/${v.hyphen}`]
      : [`https://www.linkedin.com/in/${v.slug}`, `https://www.linkedin.com/in/${v.hyphen}`, `https://www.linkedin.com/in/${v.firstDotLast}`];

    for (const liUrl of liVariants) {
      try {
        const res = await fetch(liUrl, { method: "HEAD", signal: AbortSignal.timeout(5000), redirect: "follow" });
        // LinkedIn returns 200 even for missing profiles but redirects to /404 if truly missing
        if (res.ok && !res.url.includes("/404") && !res.url.includes("authwall") === false) {
          points.push({ id: uuid(), title: "LinkedIn Profile",
            value: `Professional profile: ${liUrl}`,
            sourceUrl: liUrl, timestamp: ts, riskLevel: "low", confidence: "medium" });
          break;
        }
      } catch { /* ignore */ }
    }
    // Always add search link
    points.push({ id: uuid(), title: "LinkedIn Search",
      value: `Search "${entity.name}" on LinkedIn`,
      sourceUrl: `https://www.linkedin.com/search/results/people/?keywords=${encoded}`,
      timestamp: ts, riskLevel: "low", confidence: "low" });

    // ── 10. Twitter/X ────────────────────────────────────────────────────────
    points.push({ id: uuid(), title: "Twitter/X Mentions",
      value: `Search active mentions and posts about "${entity.name}"`,
      sourceUrl: `https://x.com/search?q=${encoded}&f=live`, timestamp: ts,
      riskLevel: "low", confidence: "low" });

    // ── 11. Google Scholar (academics) ───────────────────────────────────────
    points.push({ id: uuid(), title: "Google Scholar Search",
      value: `Academic papers and citations by "${entity.name}"`,
      sourceUrl: `https://scholar.google.com/scholar?q=${encoded}`,
      timestamp: ts, riskLevel: "low", confidence: "low" });

    // ── 12. Company-specific for organizations ───────────────────────────────
    if (entity.type === "company") {
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encoded}`,
          { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const companies = (await res.json()) as { name: string; domain: string; logo: string }[];
          for (const c of companies.slice(0, 3)) {
            if (c.name.toLowerCase().includes(v.first)) {
              points.push({ id: uuid(), title: `Company: ${c.name}`,
                value: `Official domain: ${c.domain}`, sourceUrl: `https://${c.domain}`,
                timestamp: ts, riskLevel: "low", confidence: "medium" });
            }
          }
        }
      } catch {  }

      points.push({ id: uuid(), title: "Crunchbase Company Intelligence",
        value: `Funding rounds, investors, and company data for ${entity.name}`,
        sourceUrl: `https://www.crunchbase.com/search/organizations?q=${encoded}`,
        timestamp: ts, riskLevel: "low", confidence: "low" });
    }

    return points;
  }
}
