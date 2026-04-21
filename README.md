# OSINT Intelligence Platform

A full-stack OSINT web app built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and a modular adapter architecture. Input a company or individual name and receive aggregated intelligence from multiple public data sources — with risk scoring and PDF/Markdown export.

---

##  Quick Start

```bash
git clone https://github.com/PrajwolKoirala/Technical_Assessment-.git
cd osint-app
npm install
cp .env.local .env.local.bak   
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Keys (All Optional)

| Variable | Service | Free Tier | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` | [github.com/settings/tokens](https://github.com/settings/tokens) | Yes | 5,000 req/hr (vs 60) |
| `HIBP_API_KEY` | [haveibeenpwned.com](https://haveibeenpwned.com/API/Key) | $3.50/mo | Domain breach lookup |
| `NEWS_API_KEY` | [newsapi.org](https://newsapi.org/register) | Yes (100/day) | Full news search |
| `GNEWS_API_KEY` | [gnews.io](https://gnews.io/) | Yes (100/day) | Alternative news |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` | [Google CSE](https://programmablesearchengine.google.com/) | Yes (100/day) | Web search |

---

##  Architecture

```

├── app/                          # Next.js App Router pages + API routes
│   ├── page.tsx                  # Home / Search
│   ├── history/page.tsx          # Search history
│   ├── results/[id]/page.tsx     # Results dashboard
│   └── api/
│       ├── search/route.ts       # POST — orchestrates OSINT search
│       ├── history/route.ts      # GET/DELETE — history CRUD
│       ├── results/[id]/route.ts # GET — fetch stored result
│       └── report/[id]/route.ts  # GET — export MD or JSON
├── lib/
│   ├── adapters/                 # Plug-in data source adapters
│   │   ├── base.ts               # Abstract BaseAdapter + AdapterRegistry
│   │   ├── whois.ts              # RDAP + DNS over HTTPS (Cloudflare)
│   │   ├── github.ts             # GitHub orgs / users / repos
│   │   ├── hibp.ts               # HaveIBeenPwned breach check
│   │   ├── news.ts               # NewsAPI + Wikipedia REST
│   │   ├── social.ts             # LinkedIn hint / Twitter / Wikidata / Clearbit
│   │   ├── regulatory.ts         # OpenCorporates + SEC EDGAR + OpenSanctions
│   │   └── index.ts              # Central registry (register adapters here)
│   ├── orchestrator.ts           # Runs all adapters in parallel (Promise.allSettled)
│   ├── scoring.ts                # Risk score computation (0–100)
│   ├── reportGenerator.ts        # Markdown report builder
│   └── db.ts                     # JSON file database (no native deps)
├── components/
│   ├── ui/RiskBadge.tsx          # Color-coded risk level badge
│   ├── ui/RiskGauge.tsx          # SVG circular risk gauge
│   ├── search/SearchForm.tsx     # Entity type toggle + search input
│   ├── dashboard/                # Results UI components
│   └── report/ExportButtons.tsx  # MD + client-side PDF export (jsPDF)
├── store/osintStore.ts           # Zustand global state
└── types/index.ts                # All TypeScript interfaces
```

### Risk Scoring Algorithm

- Each `DataPoint` carries `riskLevel` and `confidence`
- Per-category scores computed as weighted average of risk weights
- Overall = `social×0.25 + technical×0.35 + regulatory×0.40`
- Critical findings add +15 each, high findings +5 each (capped at 100)

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Library | React.js 15  |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Database | JSON file (lowdb-style, zero-config) | Prisma
| PDF Export | jsPDF (client-side) |
| Icons | Lucide React |

---

## 🚀 Deploy to Vercel

```bash
npx vercel --prod
```

> For production:We will replace `src/lib/db.ts` with Vercel Postgres or NeonDB with Prisma for persistent storage across serverless invocations.

---

## ⚠️ Legal Notice

Uses only **publicly available** data. For authorized research only. Comply with GDPR, CCPA, and applicable privacy laws.
