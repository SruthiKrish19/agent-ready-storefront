import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, logSessionEvent, newId } from "./store";
import type { Cart, Order, Store } from "./types";
import { approveLink, createOrder, getOrder, paypalConfigured } from "./paypal";

type Ctx = { store: Store; baseUrl: string; clientHint?: string };

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const json = (o: unknown) => text(JSON.stringify(o, null, 2));

function score(p: Store["products"][number], q: string) {
  const hay = `${p.name} ${p.description} ${p.category} ${p.tags.join(" ")}`.toLowerCase();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let s = 0;
  for (const t of terms) {
    if (p.name.toLowerCase().includes(t)) s += 3;
    if (p.tags.some((tag) => tag.includes(t))) s += 2;
    if (hay.includes(t)) s += 1;
  }
  return s;
}

/**
 * Builds a fresh McpServer for one store. Stateless: a new instance per HTTP request.
 * Agents pass `session_id` between calls so the merchant can see one shopping journey end to end.
 */
export function buildStoreServer(ctx: Ctx) {
  const { store } = ctx;
  const server = new McpServer(
    { name: `${store.name} storefront`, version: "1.0.0" },
    {
      instructions:
        `You are connected to ${store.name}'s storefront. ${store.tagline}\n` +
        `Workflow: search_products -> create_cart -> checkout (returns a PayPal approval link the human must open) -> track_order.\n` +
        `Always pass the session_id returned by the first call to every later call. All prices are USD.`,
    },
  );

  const sid = async (session_id: string | undefined, tool: string, summary: string) => {
    const id = session_id?.trim() || newId("sess");
    await logSessionEvent(store.id, id, tool, summary, ctx.clientHint);
    return id;
  };

  server.registerTool(
    "search_products",
    {
      title: "Search products",
      description: `Search ${store.name}'s catalog by free text. Optional max_price filter (USD). Returns matching products with ids and prices, plus a session_id to reuse.`,
      inputSchema: {
        query: z.string().describe("What the shopper is looking for, e.g. 'gluten-free birthday cake'"),
        max_price: z.number().optional().describe("Maximum unit price in USD"),
        session_id: z.string().optional().describe("Session id from a previous call, if any"),
      },
    },
    async ({ query, max_price, session_id }) => {
      const id = await sid(session_id, "search_products", `"${query}"${max_price ? ` under $${max_price}` : ""}`);
      const ranked = store.products
        .filter((p) => p.inStock && (max_price === undefined || p.price <= max_price))
        .map((p) => ({ p, s: score(p, query) }))
        .filter((x) => x.s > 0 || query.trim() === "")
        .sort((a, b) => b.s - a.s)
        .slice(0, 10)
        .map(({ p }) => ({ id: p.id, name: p.name, price: p.price, category: p.category, description: p.description }));
      return json({ session_id: id, store: store.name, currency: "USD", results: ranked, hint: ranked.length ? "Call create_cart with product ids and quantities." : "No match. Try a broader query or no max_price." });
    },
  );

  server.registerTool(
    "get_product",
    {
      title: "Get product",
      description: "Full details for one product by id.",
      inputSchema: { product_id: z.string(), session_id: z.string().optional() },
    },
    async ({ product_id, session_id }) => {
      const p = store.products.find((x) => x.id === product_id);
      const id = await sid(session_id, "get_product", p ? p.name : `unknown ${product_id}`);
      if (!p) return json({ session_id: id, error: "Product not found" });
      return json({ session_id: id, product: { ...p, paypalProductId: undefined, currency: "USD" } });
    },
  );

  server.registerTool(
    "create_cart",
    {
      title: "Create cart",
      description: "Create a cart from product ids and quantities. Returns cart_id and total in USD.",
      inputSchema: {
        items: z.array(z.object({ product_id: z.string(), quantity: z.number().int().min(1).max(50) })).min(1),
        session_id: z.string().optional(),
      },
    },
    async ({ items, session_id }) => {
      const lines: Cart["items"] = [];
      for (const it of items) {
        const p = store.products.find((x) => x.id === it.product_id);
        if (!p || !p.inStock) {
          const id = await sid(session_id, "create_cart", `failed: unknown product ${it.product_id}`);
          return json({ session_id: id, error: `Unknown or out-of-stock product ${it.product_id}` });
        }
        lines.push({ productId: p.id, name: p.name, quantity: it.quantity, unitPrice: p.price });
      }
      const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;
      const id = await sid(session_id, "create_cart", `${lines.map((l) => `${l.quantity}x ${l.name}`).join(", ")} = $${total.toFixed(2)}`);
      const cart: Cart = { id: newId("cart"), storeId: store.id, sessionId: id, items: lines, total, status: "open", createdAt: new Date().toISOString() };
      await db.saveCart(cart);
      return json({ session_id: id, cart_id: cart.id, items: lines, total, currency: "USD", hint: "Call checkout with this cart_id to get a PayPal approval link." });
    },
  );

  server.registerTool(
    "checkout",
    {
      title: "Checkout with PayPal",
      description: "Creates a PayPal Order for the cart and returns an approval URL. The HUMAN must open the URL and approve payment in PayPal; the agent never handles payment details. After approval the order is captured automatically.",
      inputSchema: { cart_id: z.string(), session_id: z.string().optional() },
    },
    async ({ cart_id, session_id }) => {
      const cart = await db.getCart(cart_id);
      if (!cart || cart.storeId !== store.id) {
        const id = await sid(session_id, "checkout", `failed: unknown cart ${cart_id}`);
        return json({ session_id: id, error: "Cart not found" });
      }
      if (!paypalConfigured()) {
        const id = await sid(session_id ?? cart.sessionId, "checkout", "failed: PayPal not configured");
        return json({ session_id: id, error: "PayPal is not configured on this server" });
      }
      const id = await sid(session_id ?? cart.sessionId, "checkout", `cart ${cart.id} $${cart.total.toFixed(2)}`);
      const returnUrl = `${ctx.baseUrl}/return?store=${encodeURIComponent(store.id)}`;
      const cancelUrl = `${ctx.baseUrl}/cancel?store=${encodeURIComponent(store.id)}`;
      const pp = await createOrder({ storeName: store.name, items: cart.items, returnUrl, cancelUrl, referenceId: cart.id });
      const now = new Date().toISOString();
      const order: Order = {
        id: pp.id,
        storeId: store.id,
        cartId: cart.id,
        sessionId: id,
        items: cart.items,
        total: cart.total,
        status: "CREATED",
        approveUrl: approveLink(pp),
        createdAt: now,
        updatedAt: now,
      };
      await db.saveOrder(order);
      cart.status = "checked_out";
      await db.saveCart(cart);
      return json({
        session_id: id,
        order_id: order.id,
        total: order.total,
        currency: "USD",
        approve_url: order.approveUrl,
        instructions: "Show the approve_url to the human. They log in to PayPal and approve. Then call track_order with order_id to confirm payment and get shipping status.",
      });
    },
  );

  server.registerTool(
    "track_order",
    {
      title: "Track order",
      description: "Payment status and shipment tracking for an order id returned by checkout.",
      inputSchema: { order_id: z.string(), session_id: z.string().optional() },
    },
    async ({ order_id, session_id }) => {
      const order = await db.getOrder(order_id);
      if (!order || order.storeId !== store.id) {
        const id = await sid(session_id, "track_order", `failed: unknown order ${order_id}`);
        return json({ session_id: id, error: "Order not found" });
      }
      // Refresh live status from PayPal when still pending.
      if (order.status === "CREATED" || order.status === "APPROVED") {
        try {
          const live = await getOrder(order.id);
          if (live.status === "APPROVED" && order.status === "CREATED") order.status = "APPROVED";
          if (live.status === "COMPLETED") order.status = "COMPLETED";
          order.updatedAt = new Date().toISOString();
          await db.saveOrder(order);
        } catch {
          /* keep local state */
        }
      }
      const id = await sid(session_id ?? order.sessionId, "track_order", `${order.id} -> ${order.status}${order.tracking ? ` / ${order.tracking.carrier} ${order.tracking.trackingNumber}` : ""}`);
      return json({
        session_id: id,
        order_id: order.id,
        payment_status: order.status,
        total: order.total,
        currency: "USD",
        approve_url: order.status === "CREATED" ? order.approveUrl : undefined,
        tracking: order.tracking ?? null,
        message:
          order.status === "COMPLETED"
            ? order.tracking
              ? `Paid. Shipped via ${order.tracking.carrier}, tracking ${order.tracking.trackingNumber} (${order.tracking.status}).`
              : "Paid. Preparing shipment."
            : order.status === "APPROVED"
              ? "Approved by the buyer, capture in progress."
              : "Awaiting buyer approval in PayPal.",
      });
    },
  );

  return server;
}
