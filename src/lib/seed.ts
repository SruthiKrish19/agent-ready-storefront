import { db, newId } from "./store";
import type { Store } from "./types";
import { syncCatalog } from "./catalog";

export const DEMO_STORE_ID = "sunrise-bakery";

const DEMO_PRODUCTS: Omit<Store["products"][number], "id">[] = [
  { name: "Sourdough Loaf", description: "48-hour fermented country sourdough, crackly crust.", price: 8.5, category: "bread", tags: ["sourdough", "bread", "vegan"], inStock: true },
  { name: "Gluten-Free Birthday Cake (6in)", description: "Almond-flour vanilla sponge, strawberry jam, cream cheese frosting. Serves 6-8.", price: 36, category: "cake", tags: ["gluten-free", "birthday", "cake", "vanilla"], inStock: true },
  { name: "Chocolate Fudge Cake (8in)", description: "Three layers of dark chocolate sponge with fudge frosting. Serves 10-12.", price: 42, category: "cake", tags: ["chocolate", "birthday", "cake"], inStock: true },
  { name: "Croissant Box (6)", description: "Six all-butter croissants, laminated by hand.", price: 18, category: "pastry", tags: ["croissant", "butter", "breakfast"], inStock: true },
  { name: "Cinnamon Rolls (4)", description: "Brioche cinnamon rolls with cream cheese glaze.", price: 14, category: "pastry", tags: ["cinnamon", "sweet", "breakfast"], inStock: true },
  { name: "Vegan Banana Bread", description: "Moist banana loaf, no dairy or eggs, walnut crumble top.", price: 11, category: "bread", tags: ["vegan", "banana", "loaf"], inStock: true },
  { name: "Assorted Macarons (12)", description: "Pistachio, raspberry, salted caramel and lemon.", price: 24, category: "sweets", tags: ["macaron", "gift", "gluten-free"], inStock: true },
  { name: "Office Breakfast Platter", description: "Feeds 10: croissants, muffins, fruit, and two loaves.", price: 65, category: "catering", tags: ["office", "catering", "breakfast"], inStock: true },
];

export async function ensureDemoStore(): Promise<Store> {
  const existing = await db.getStore(DEMO_STORE_ID);
  if (existing) return existing;
  const store: Store = {
    id: DEMO_STORE_ID,
    name: "Sunrise Bakery",
    tagline: "Small-batch bakes, now open to AI shopping agents.",
    currency: "USD",
    products: DEMO_PRODUCTS.map((p) => ({ ...p, id: newId("prod") })),
    createdAt: new Date().toISOString(),
    parsedBy: "fallback",
  };
  await db.saveStore(store);
  await syncCatalog(store); // best-effort PayPal Catalog sync
  return store;
}
