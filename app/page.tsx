import { SearchForm } from "@/components/search/SearchForm";
import { Shield, Zap, Database, FileText } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center space-y-6 mb-16 animate-fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-mono text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </div>

        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-none">
          <span className="text-white">Investigate</span>
          <br />
          <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Anyone. Anywhere.
          </span>
        </h1>
        <p className="max-w-lg mx-auto text-purple-400 text-sm leading-relaxed">
         Technical Assessment project for Full Stack Developer. - Prajwol Koirala
        </p>
        <p className="max-w-lg mx-auto text-slate-400 text-lg leading-relaxed">
          Aggregate public intelligence from social profiles, technical
          infrastructure, regulatory filings, and data breaches.
        </p>
      </div>

      <div
        className="w-full animate-fade-in"
        style={{ animationDelay: "0.1s" }}
      >
        <SearchForm />
      </div>

      <div
        className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl animate-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        {[
          {
            icon: Shield,
            label: "6 Data Sources",
            desc: "WHOIS, GitHub, HIBP & more",
          },
          {
            icon: Zap,
            label: "Parallel Fetch",
            desc: "All adapters run at once",
          },
          {
            icon: Database,
            label: "Stored Results",
            desc: "Full search history",
          },
          {
            icon: FileText,
            label: "PDF + MD Export",
            desc: "Professional reports",
          },
        ].map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-center space-y-1.5"
          >
            <Icon size={20} className="text-cyan-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">{label}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
