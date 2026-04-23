import { SearchEntity, EntityProfile } from "@/types";

interface RawProfile {
  name?: string;
  bio?: string;
  image?: string;
  url?: string;
  location?: string;
  company?: string;
  twitter?: string;
  github?: string;
  followers?: number;
  publicRepos?: number;
  joinedYear?: number;
  languages?: string[];
  tags?: string[];
  source: string;
}

// ── Source fetchers ──────────────────────────────────────────────────────────

async function fromWikipedia(name: string): Promise<RawProfile | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { title: string; extract: string; thumbnail?: { source: string }; content_urls?: { desktop?: { page?: string } }; description?: string };
    if (!d.extract || d.extract.toLowerCase().includes("may refer to")) return null;
    return { name: d.title, bio: d.extract, image: d.thumbnail?.source,
      url: d.content_urls?.desktop?.page, tags: ["Wikipedia"], source: "Wikipedia" };
  } catch { return null; }
}

async function fromGitHub(name: string, type: string): Promise<RawProfile | null> {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.toLowerCase() ?? "";
  const last = parts[parts.length-1]?.toLowerCase() ?? "";
  const slugs = [...new Set([
    name.toLowerCase().replace(/\s+/g,""),
    `${first}${last}`, `${first}-${last}`, first, last,
  ])];
  const headers: Record<string,string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;

  const endpoints = type === "company"
    ? slugs.flatMap(s => [`https://api.github.com/orgs/${s}`, `https://api.github.com/users/${s}`])
    : slugs.flatMap(s => [`https://api.github.com/users/${s}`]);

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const d = (await res.json()) as { name: string; login: string; bio?: string; description?: string; avatar_url?: string; blog?: string; location?: string; company?: string; html_url: string; public_repos: number; followers: number; created_at: string; twitter_username?: string };
      const bio = d.bio ?? d.description;
      if (!bio && !d.avatar_url) continue;

      // fetch top languages
      let languages: string[] = [];
      try {
        const reposRes = await fetch(`https://api.github.com/users/${d.login}/repos?sort=stars&per_page=10&type=owner`, { headers, signal: AbortSignal.timeout(5000) });
        if (reposRes.ok) {
          const repos = (await reposRes.json()) as { language: string | null; fork: boolean }[];
          const langs = repos.filter(r => !r.fork).map(r => r.language).filter(Boolean) as string[];
          const counts = langs.reduce<Record<string,number>>((acc,l) => { acc[l]=(acc[l]||0)+1; return acc; }, {});
          languages = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,4).map(([l]) => l);
        }
      } catch { /* ignore */ }

      return {
        name: d.name ?? d.login, bio: bio?.slice(0, 500),
        image: d.avatar_url, url: d.blog || d.html_url,
        location: d.location, company: d.company,
        twitter: d.twitter_username,
        followers: d.followers, publicRepos: d.public_repos,
        joinedYear: new Date(d.created_at).getFullYear(),
        languages, tags: ["GitHub"], source: "GitHub",
      };
    } catch { continue; }
  }
  return null;
}

async function fromDuckDuckGo(name: string): Promise<RawProfile | null> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(name)}&format=json&no_redirect=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { AbstractText: string; AbstractURL: string; Heading: string; Image: string; AbstractSource: string };
    if (!d.AbstractText || d.AbstractText.length < 20) return null;
    return { name: d.Heading || name, bio: d.AbstractText,
      image: d.Image ? (d.Image.startsWith("http") ? d.Image : `https://duckduckgo.com${d.Image}`) : undefined,
      url: d.AbstractURL || undefined, tags: [d.AbstractSource], source: "DuckDuckGo" };
  } catch { return null; }
}

async function fromDevTo(name: string): Promise<RawProfile | null> {
  const parts = name.toLowerCase().trim().split(/\s+/);
  const slugs = [parts.join(""), parts.join("-"), parts[0]];
  for (const slug of slugs) {
    try {
      const res = await fetch(`https://dev.to/api/users/by_username?url=${slug}`,
        { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const d = (await res.json()) as { name: string; username: string; summary?: string; location?: string; profile_image: string; joined_at: string; github_username?: string; twitter_username?: string };
      if (!d.name) continue;
      return { name: d.name, bio: d.summary, image: d.profile_image,
        url: `https://dev.to/${d.username}`, location: d.location,
        github: d.github_username, twitter: d.twitter_username,
        tags: ["dev.to Developer"], source: "dev.to" };
    } catch { continue; }
  }
  return null;
}

async function fromClearbit(name: string): Promise<RawProfile | null> {
  try {
    const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const companies = (await res.json()) as { name: string; domain: string; logo: string }[];
    const match = companies.find(c => c.name.toLowerCase().includes(name.toLowerCase().split(" ")[0].toLowerCase()));
    if (!match) return null;
    return { name: match.name, image: match.logo, url: `https://${match.domain}`, tags: ["Company"], source: "Clearbit" };
  } catch { return null; }
}

async function fromWikidata(name: string): Promise<RawProfile | null> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&origin=*&limit=3`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { search: { label: string; description: string; concepturi: string }[] };
    const item = d.search?.[0];
    if (!item?.description) return null;
    return { name: item.label, bio: item.description, url: item.concepturi, tags: ["Wikidata"], source: "Wikidata" };
  } catch { return null; }
}

// ── Synthesis ──────────────────────────────────────────────────────────────

function synthesizeBio(profiles: RawProfile[], entity: SearchEntity): string {
  // Find richest bio
  const ranked = profiles
    .filter(p => p.bio)
    .sort((a, b) => (b.bio?.length ?? 0) - (a.bio?.length ?? 0));

  if (ranked.length === 0) {
    return `${entity.name} — no public biography found across Wikipedia, GitHub, DuckDuckGo, or developer platforms. This may be a private individual with limited public footprint.`;
  }

  const primary = ranked[0];
  const extras: string[] = [];

  // Supplement with unique details from other sources
  const github = profiles.find(p => p.source === "GitHub");
  if (github) {
    if (github.location && !primary.bio?.includes(github.location))
      extras.push(`Based in ${github.location}`);
    if (github.company && !primary.bio?.includes(github.company))
      extras.push(`works at ${github.company}`);
    if (github.languages?.length)
      extras.push(`primary languages: ${github.languages.join(", ")}`);
    if (github.publicRepos && github.publicRepos > 0)
      extras.push(`${github.publicRepos} public repositories on GitHub`);
    if (github.followers && github.followers > 0)
      extras.push(`${github.followers} followers`);
  }

  let bio = primary.bio ?? "";

  // Append supplementary info
  if (extras.length > 0) {
    bio += ` Additionally: ${extras.join("; ")}.`;
  }

  return bio.trim();
}

export async function resolveEntityProfile(entity: SearchEntity): Promise<EntityProfile> {
  // Run all sources in parallel
  const [wiki, github, ddg, devto, clearbit, wikidata] = await Promise.allSettled([
    fromWikipedia(entity.name),
    fromGitHub(entity.name, entity.type),
    fromDuckDuckGo(entity.name),
    entity.type === "individual" ? fromDevTo(entity.name) : Promise.resolve(null),
    entity.type === "company" ? fromClearbit(entity.name) : Promise.resolve(null),
    fromWikidata(entity.name),
  ]);

  const all: RawProfile[] = [wiki, github, ddg, devto, clearbit, wikidata]
    .filter(r => r.status === "fulfilled" && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<RawProfile>).value);

  const wikiP = all.find(p => p.source === "Wikipedia");
  const ghP   = all.find(p => p.source === "GitHub");
  const ddgP  = all.find(p => p.source === "DuckDuckGo");
  const devP  = all.find(p => p.source === "dev.to");
  const cbP   = all.find(p => p.source === "Clearbit");
  const wdP   = all.find(p => p.source === "Wikidata");

  // Image priority: Wikipedia > GitHub > DuckDuckGo > Clearbit > dev.to
  const image = wikiP?.image ?? ghP?.image ?? ddgP?.image ?? cbP?.image ?? devP?.image;

  // Location: GitHub most accurate
  const location = ghP?.location ?? devP?.location;

  // URL: personal website > GitHub > Wikipedia
  const url = ghP?.url ?? cbP?.url ?? wikiP?.url ?? devP?.url;

  // Company
  const company = ghP?.company;

  // Tags: aggregate from all sources found
  const tagSet = new Set<string>();
  tagSet.add(entity.type === "company" ? "Organization" : "Individual");
  all.forEach(p => p.tags?.forEach(t => tagSet.add(t)));
  if (ghP?.languages?.length) {
    ghP.languages.slice(0, 2).forEach(l => tagSet.add(l));
  }
  if (location) tagSet.add(location.split(",")[0].trim());

  // Synthesized bio
  const bio = synthesizeBio(all, entity);

  return {
    name: entity.name,
    image,
    bio,
    url,
    location,
    company,
    tags: [...tagSet].slice(0, 8),
  };
}
