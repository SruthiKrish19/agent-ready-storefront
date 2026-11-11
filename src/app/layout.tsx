import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";

const REPO_URL = "https://github.com/SruthiKrish19/agent-ready-storefront";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agent-Ready Storefront",
  description: "Paste a product list, get a hosted MCP storefront that AI shopping agents can buy from, settled with PayPal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hostedDemo = !process.env.ANTHROPIC_API_KEY; // server-side: a local run with a key never shows the banner
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {hostedDemo && <DemoBanner repoUrl={REPO_URL} />}
        <header className="border-b border-black/10 dark:border-white/10">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-sky-500 to-indigo-600" />
              Agent-Ready Storefront
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/demo" className="hover:underline">Demo store</Link>
              <Link href="/store/sunrise-bakery" className="hover:underline">Dashboard</Link>
              <a href="https://github.com/SruthiKrish19/agent-ready-storefront" className="hover:underline" target="_blank" rel="noreferrer">GitHub</a>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-black/10 py-6 text-center text-xs opacity-70 dark:border-white/10">
          Built for the PayPal AI Hackathon 2026. PayPal sandbox only, no real money moves.
        </footer>
      </body>
    </html>
  );
}
