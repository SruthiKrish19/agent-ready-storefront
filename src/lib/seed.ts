import { db, newId } from "./store";
import type { AgentSession, Order, Store } from "./types";
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

export const SAMPLE_NOTE = "Seeded for review, not a PayPal order.";

/** Creates the demo store if missing (idempotent). Marks it `sample: true`. */
export async function ensureDemoStore(): Promise<Store> {
  const existing = await db.getStore(DEMO_STORE_ID);
  if (existing) {
    if (!existing.sample) {
      existing.sample = true;
      await db.saveStore(existing);
    }
    return existing;
  }
  const store: Store = {
    id: DEMO_STORE_ID,
    name: "Sunrise Bakery",
    tagline: "Small-batch bakes, now open to AI shopping agents.",
    currency: "USD",
    products: DEMO_PRODUCTS.map((p) => ({ ...p, id: newId("prod") })),
    createdAt: new Date().toISOString(),
    parsedBy: "fallback",
    sample: true,
  };
  await db.saveStore(store);
  await syncCatalog(store); // best-effort PayPal Catalog sync
  return store;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

/**
 * Seeds clearly-labelled sample agent sessions and sample orders for reviewers.
 * Sample orders carry `sample: true`, `status: "sample"` and `paypalOrderId: null`;
 * nothing here touches PayPal. Idempotent: fixed ids, skipped when already present.
 */
export async function ensureDemoData(): Promise<{ store: Store; seededOrders: number; seededSessions: number }> {
  const store = await ensureDemoStore();
  const byName = (n: string) => store.products.find((p) => p.name.startsWith(n));
  const cake = byName("Gluten-Free Birthday Cake");
  const croissants = byName("Croissant Box");
  const platter = byName("Office Breakfast Platter");
  const macarons = byName("Assorted Macarons");

  const sessions: AgentSession[] = [
    {
      id: "sample_sess_claude1",
      storeId: store.id,
      client: "Claude Desktop (sample)",
      sample: true,
      startedAt: hoursAgo(26),
      lastSeenAt: hoursAgo(25.8),
      events: [
        { at: hoursAgo(26), tool: "search_products", summary: '"gluten-free birthday cake under $40" → 1 result' },
        { at: hoursAgo(25.9), tool: "get_product", summary: cake?.name ?? "Gluten-Free Birthday Cake (6in)" },
        { at: hoursAgo(25.85), tool: "create_cart", summary: `1× ${cake?.name ?? "Gluten-Free Birthday Cake (6in)"} · $36.00` },
        { at: hoursAgo(25.8), tool: "checkout", summary: "approval link handed to the human (sample)" },
      ],
    },
    {
      id: "sample_sess_cursor1",
      storeId: store.id,
      client: "Cursor (sample)",
      sample: true,
      startedAt: hoursAgo(9),
      lastSeenAt: hoursAgo(8.9),
      events: [
        { at: hoursAgo(9), tool: "search_products", summary: '"breakfast for 10 people" → 2 results' },
        { at: hoursAgo(8.95), tool: "create_cart", summary: `1× ${platter?.name ?? "Office Breakfast Platter"}, 1× ${croissants?.name ?? "Croissant Box (6)"} · $83.00` },
        { at: hoursAgo(8.9), tool: "checkout", summary: "approval link handed to the human (sample)" },
      ],
    },
    {
      id: "sample_sess_inspector1",
      storeId: store.id,
      client: "MCP Inspector (sample)",
      sample: true,
      startedAt: hoursAgo(3),
      lastSeenAt: hoursAgo(2.9),
      events: [
        { at: hoursAgo(3), tool: "search_products", summary: '"vegan gift box" → 2 results' },
        { at: hoursAgo(2.95), tool: "get_product", summary: macarons?.name ?? "Assorted Macarons (12)" },
        { at: hoursAgo(2.9), tool: "track_order", summary: "asked about an earlier order (sample)" },
      ],
    },
  ];

  const orders: Order[] = [
    {
      id: "sample_order_1",
      paypalOrderId: null,
      sample: true,
      note: SAMPLE_NOTE,
      storeId: store.id,
      cartId: "sample_cart_1",
      sessionId: "sample_sess_claude1",
      items: [{ productId: cake?.id ?? "prod_sample", name: cake?.name ?? "Gluten-Free Birthday Cake (6in)", quantity: 1, unitPrice: 36 }],
      total: 36,
      status: "sample",
      payerEmail: "sample-buyer@example.com",
      payerName: "Sample Buyer",
      tracking: { carrier: "SAMPLE", trackingNumber: "SAMPLE-0001", status: "SHIPPED", addedAt: hoursAgo(24) },
      createdAt: hoursAgo(25.8),
      updatedAt: hoursAgo(24),
    },
    {
      id: "sample_order_2",
      paypalOrderId: null,
      sample: true,
      note: SAMPLE_NOTE,
      storeId: store.id,
      cartId: "sample_cart_2",
      sessionId: "sample_sess_cursor1",
      items: [
        { productId: platter?.id ?? "prod_sample", name: platter?.name ?? "Office Breakfast Platter", quantity: 1, unitPrice: 65 },
        { productId: croissants?.id ?? "prod_sample", name: croissants?.name ?? "Croissant Box (6)", quantity: 1, unitPrice: 18 },
      ],
      total: 83,
      status: "sample",
      payerEmail: "sample-office@example.com",
      payerName: "Sample Office",
      createdAt: hoursAgo(8.9),
      updatedAt: hoursAgo(8.9),
    },
    {
      id: "sample_order_3",
      paypalOrderId: null,
      sample: true,
      note: SAMPLE_NOTE,
      storeId: store.id,
      cartId: "sample_cart_3",
      sessionId: "sample_sess_inspector1",
      items: [{ productId: macarons?.id ?? "prod_sample", name: macarons?.name ?? "Assorted Macarons (12)", quantity: 2, unitPrice: 24 }],
      total: 48,
      status: "sample",
      payerEmail: "sample-gift@example.com",
      payerName: "Sample Gifter",
      createdAt: hoursAgo(2.9),
      updatedAt: hoursAgo(2.9),
    },
  ];

  let seededOrders = 0;
  let seededSessions = 0;
  for (const s of sessions) {
    if (!(await db.getSession(s.id))) {
      await db.saveSession(s);
      seededSessions++;
    }
  }
  for (const o of orders) {
    if (!(await db.getOrder(o.id))) {
      await db.saveOrder(o);
      seededOrders++;
    }
  }
  return { store, seededOrders, seededSessions };
}
