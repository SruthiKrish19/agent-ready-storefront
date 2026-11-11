import Link from "next/link";
import { OnboardForm } from "@/components/OnboardForm";

export default function Home() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section className="space-y-5">
        <p className="inline-block rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
          PayPal AI Hackathon 2026 · Agentic Commerce
        </p>
        <h1 className="text-4xl font-bold leading-tight">
          Make any store <span className="text-sky-600 dark:text-sky-400">agent-ready</span> in 60 seconds.
        </h1>
        <p className="text-lg opacity-80">
          Paste your product list. We give you a hosted <strong>MCP server</strong> that Claude, ChatGPT or any
          MCP-capable shopping agent can search, cart and check out from, with <strong>PayPal Orders</strong> settling
          every purchase and <strong>shipment tracking</strong> attached automatically.
        </p>
        <ol className="space-y-2 text-sm opacity-90">
          <li>1. Paste products (CSV, bullets, prose). Claude turns it into a clean PayPal Catalog.</li>
          <li>2. Your store gets an MCP URL with search_products, create_cart, checkout, track_order.</li>
          <li>3. A buyer&apos;s agent shops; the human approves in PayPal; you watch orders land in the dashboard.</li>
        </ol>
        <div className="flex gap-3">
          <Link href="/demo" className="btn">Try the demo store</Link>
          <Link href="/store/sunrise-bakery" className="btn btn-ghost">Merchant dashboard</Link>
        </div>
      </section>
      <section className="card p-6">
        <h2 className="mb-1 text-xl font-semibold">Create your storefront</h2>
        <p className="mb-4 text-sm opacity-70">One product per line works best. Prices in USD.</p>
        <OnboardForm />
      </section>
    </div>
  );
}
