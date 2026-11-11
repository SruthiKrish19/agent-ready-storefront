import { parseProducts } from "@/lib/parse-products";
import { db, newId, slugify } from "@/lib/store";
import { syncCatalog } from "@/lib/catalog";
import { ensureDemoStore } from "@/lib/seed";
import type { Store } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { storeName?: string; raw?: string };
  const raw = (body.raw ?? "").trim();
  if (raw.length < 5) return Response.json({ error: "Paste at least one product line." }, { status: 400 });
  if (raw.length > 20000) return Response.json({ error: "Paste is too long (20k chars max)." }, { status: 400 });
  const parsed = await parseProducts((body.storeName ?? "").trim(), raw);
  if (parsed.products.length === 0) {
    return Response.json({ error: "Could not find any products with prices. Use one product per line: Name, 12.50, description" }, { status: 422 });
  }
  const base = slugify(parsed.storeName) || "store";
  let id = base;
  if (await db.getStore(id)) id = `${base}-${newId("").slice(1, 6)}`;
  const store: Store = {
    id,
    name: parsed.storeName,
    tagline: parsed.tagline,
    currency: "USD",
    products: parsed.products,
    createdAt: new Date().toISOString(),
    parsedBy: parsed.parsedBy,
  };
  await db.saveStore(store);
  await syncCatalog(store);
  return Response.json({ id: store.id, name: store.name, products: store.products.length, parsedBy: store.parsedBy });
}

export async function GET() {
  await ensureDemoStore();
  const stores = await db.listStores();
  return Response.json(stores.map((s) => ({ id: s.id, name: s.name, products: s.products.length, createdAt: s.createdAt, sample: s.sample === true })));
}
