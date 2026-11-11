import { createCatalogProduct, paypalConfigured } from "./paypal";
import { db } from "./store";
import type { Store } from "./types";

/** Mirror every product into the PayPal Catalog so each has a PayPal product ID. Best-effort, idempotent. */
export async function syncCatalog(store: Store) {
  if (!paypalConfigured()) return store;
  let changed = false;
  for (const p of store.products) {
    if (p.paypalProductId) continue;
    try {
      p.paypalProductId = await createCatalogProduct({ name: p.name, description: p.description, category: p.category });
      changed = true;
    } catch (err) {
      console.error("catalog sync failed for", p.name, err instanceof Error ? err.message : err);
    }
  }
  if (changed) await db.saveStore(store);
  return store;
}
