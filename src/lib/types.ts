export type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // USD
  category: string;
  tags: string[];
  inStock: boolean;
  paypalProductId?: string;
};

export type Store = {
  id: string;
  name: string;
  tagline: string;
  currency: "USD";
  products: Product[];
  createdAt: string;
  parsedBy: "claude" | "fallback";
  /** true for reviewer-seeded demo data */
  sample?: boolean;
};

export type CartItem = { productId: string; name: string; quantity: number; unitPrice: number };

export type Cart = {
  id: string;
  storeId: string;
  sessionId: string;
  items: CartItem[];
  total: number;
  status: "open" | "checked_out";
  createdAt: string;
};

export type Tracking = { carrier: string; trackingNumber: string; status: string; addedAt: string };

export type Order = {
  id: string; // PayPal order id for real orders; "sample_…" for seeded review data
  paypalOrderId?: string | null; // null for seeded samples
  sample?: boolean;
  note?: string;
  storeId: string;
  cartId: string;
  sessionId: string;
  items: CartItem[];
  total: number;
  status: "CREATED" | "APPROVED" | "COMPLETED" | "VOIDED" | "FAILED" | "sample";
  approveUrl?: string;
  captureId?: string;
  payerEmail?: string;
  payerName?: string;
  tracking?: Tracking;
  createdAt: string;
  updatedAt: string;
};

export type SessionEvent = { at: string; tool: string; summary: string };

export type AgentSession = {
  id: string;
  storeId: string;
  client?: string;
  sample?: boolean;
  events: SessionEvent[];
  startedAt: string;
  lastSeenAt: string;
};
