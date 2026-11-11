import Link from "next/link";
import { headers } from "next/headers";
import { ensureDemoData } from "@/lib/seed";
import { SampleBadge } from "@/components/SampleBadge";
import { CopyBlock } from "@/components/Snippets";
import { mcpSnippets } from "@/lib/snippets";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const { store } = await ensureDemoData(); // idempotent: store + SAMPLE orders/sessions for reviewers
  const h = await headers();
  const base = (
    process.env.NEXT_PUBLIC_BASE_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`
  ).replace(/\/$/, "");
  const s = mcpSnippets(store.id, store.name, base);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          {store.name} · demo store <SampleBadge title="Seeded demo store. Products are real PayPal sandbox Catalog entries; orders/sessions marked SAMPLE are seeded for review." />
        </h1>
        <p className="opacity-70">{store.tagline} {store.products.length} products, already synced to the PayPal sandbox Catalog.</p>
        <p className="mt-1 text-xs opacity-60">
          Everything marked <SampleBadge /> was seeded so reviewers have something to look at. Orders you create through MCP checkout are real PayPal sandbox orders and are never marked sample.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">1. Connect Claude Desktop</h2>
          <p className="text-sm opacity-80">Add this to <code>claude_desktop_config.json</code>, restart Claude, and ask: <em>&ldquo;Find me a gluten-free birthday cake under $40 from Sunrise Bakery and buy it.&rdquo;</em></p>
          <CopyBlock label="claude_desktop_config.json" code={s.claudeDesktop} />
          <p className="text-xs opacity-60">Any MCP client works: Cursor, MCP Inspector, Claude Code (<code>claude mcp add --transport http sunrise-bakery {s.url}</code>).</p>
        </div>
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">2. Or call the tools directly</h2>
          <CopyBlock label="curl · search_products" code={s.curl} />
          <p className="text-xs opacity-60">Tools: search_products, get_product, create_cart, checkout, track_order. checkout returns a PayPal approval URL for the human.</p>
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">3. Watch it land</h2>
        <p className="text-sm opacity-80">
          Approve the PayPal sandbox payment with the buyer login from the Devpost testing instructions. The order is captured, tracking is attached, and it appears in the{" "}
          <Link href={`/store/${store.id}`} className="underline">merchant dashboard</Link> with the agent&apos;s full journey.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Catalog</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {store.products.map((p) => (
            <div key={p.id} className="card p-3 text-sm">
              <div className="flex items-center justify-between gap-2 font-medium">
                <span>{p.name}</span>
                <SampleBadge title="Seeded catalog item (real PayPal sandbox Catalog product)." />
              </div>
              <div className="opacity-60">{p.description}</div>
              <div className="mt-1 font-mono">${p.price.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
