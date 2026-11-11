/**
 * Thin PayPal REST client (sandbox by default). Covers exactly what the storefront needs:
 * Catalog Products, Orders v2 (create/get/capture), order shipment tracking.
 */
const BASE =
  process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

let cached: { token: string; expiresAt: number } | null = null;

export function paypalConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function token(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

async function pp<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PayPal ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

// ---------- Catalog ----------
/** Map a free-text category from the merchant/Claude to a PayPal catalog category enum (verified against sandbox). */
export function paypalCategory(category: string): string {
  const c = category.toLowerCase();
  if (/(bread|cake|pastry|sweet|food|drink|coffee|tea|bakery|snack|grocer|catering|meal)/.test(c)) return "FOOD_DRINK_AND_NUTRITION";
  if (/(plant|garden|home|decor|furniture|kitchen)/.test(c)) return "HOME_AND_GARDEN";
  if (/(gift|flower|card)/.test(c)) return "GIFTS_AND_FLOWERS";
  if (/(cloth|shirt|dress|shoe|apparel|accessor|jewel)/.test(c)) return "CLOTHING_ACCESSORIES_AND_SHOES";
  if (/(book|magazine|zine|print)/.test(c)) return "BOOKS_PERIODICALS_AND_NEWSPAPERS";
  if (/(service|class|lesson|consult)/.test(c)) return "MISCELLANEOUS_GENERAL_SERVICES";
  return "RETAIL";
}

export async function createCatalogProduct(input: { name: string; description: string; category?: string }) {
  const r = await pp<{ id: string }>("POST", "/v1/catalogs/products", {
    name: input.name.slice(0, 127),
    description: (input.description || input.name).slice(0, 256),
    type: "PHYSICAL",
    category: paypalCategory(input.category ?? ""),
  });
  return r.id;
}

// ---------- Orders ----------
export type PayPalOrder = {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  payer?: { email_address?: string; name?: { given_name?: string; surname?: string } };
  purchase_units?: {
    payments?: { captures?: { id: string; status: string }[] };
  }[];
};

export async function createOrder(input: {
  storeName: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  returnUrl: string;
  cancelUrl: string;
  referenceId: string;
}) {
  const total = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const money = (v: number) => ({ currency_code: "USD", value: v.toFixed(2) });
  return pp<PayPalOrder>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.referenceId,
          description: `${input.storeName} order`.slice(0, 127),
          amount: { ...money(total), breakdown: { item_total: money(total) } },
          items: input.items.map((i) => ({
            name: i.name.slice(0, 127),
            quantity: String(i.quantity),
            unit_amount: money(i.unitPrice),
            category: "PHYSICAL_GOODS",
          })),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: input.storeName.slice(0, 127),
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    },
    { "PayPal-Request-Id": input.referenceId },
  );
}

export async function getOrder(id: string) {
  return pp<PayPalOrder>("GET", `/v2/checkout/orders/${id}`);
}

export async function captureOrder(id: string) {
  return pp<PayPalOrder>("POST", `/v2/checkout/orders/${id}/capture`, {}, { "PayPal-Request-Id": `cap-${id}` });
}

export async function addOrderTracking(orderId: string, captureId: string, carrier: string, trackingNumber: string) {
  return pp<unknown>("POST", `/v2/checkout/orders/${orderId}/track`, {
    capture_id: captureId,
    tracking_number: trackingNumber,
    carrier,
    notify_payer: false,
  });
}

export function approveLink(order: PayPalOrder) {
  return order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
}
