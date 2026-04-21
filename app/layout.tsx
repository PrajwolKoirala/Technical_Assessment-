import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Search, History, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "OSINT Intelligence Platform",
  description: "Open-source intelligence gathering and analysis tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-white antialiased">
        <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                <Shield size={16} className="text-cyan-400" />
              </div>
              <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <span className="text-cyan-400">OSINT</span>
                <span className="text-slate-300"> Logo</span>
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <Link href="/" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <Search size={15} />
                <span className="hidden sm:block">Search</span>
              </Link>
              <Link href="/history" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <History size={15} />
                <span className="hidden sm:block">History</span>
              </Link>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="mt-20 border-t border-slate-800/50 py-8 text-center text-xs text-slate-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          OSINT Intelligence Platform 
        </footer>
      </body>
    </html>
  );
}
