import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentSession, Cart, Order, Store } from "./types";

/**
 * One tiny storage interface, two backends:
 *  - Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set (Vercel-friendly, durable)
 *  - in-memory Map mirrored to .data/store.json otherwise (zero-setup local dev)
 */
interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

class MemoryFileKV implements KV {
  private data = new Map<string, unknown>();
  private loaded = false;
  private file = path.join(process.cwd(), ".data", "store.json");
  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      for (const [k, v] of Object.entries(JSON.parse(raw))) this.data.set(k, v);
    } catch {
      /* first run */
    }
  }
  private async flush() {
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(Object.fromEntries(this.data)), "utf8");
    } catch {
      /* read-only FS (e.g. Vercel) - stay in memory */
    }
  }
  async get<T>(key: string) {
    await this.load();
    return (this.data.get(key) as T) ?? null;
  }
  async set<T>(key: string, value: T) {
    await this.load();
    this.data.set(key, value);
    await this.flush();
  }
  async keys(prefix: string) {
    await this.load();
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}

class UpstashKV implements KV {
  private client: import("@upstash/redis").Redis;
  constructor(client: import("@upstash/redis").Redis) {
    this.client = client;
  }
  async get<T>(key: string) {
    return (await this.client.get<T>(key)) ?? null;
  }
  async set<T>(key: string, value: T) {
    await this.client.set(key, value);
  }
  async keys(prefix: string) {
    return this.client.keys(`${prefix}*`);
  }
}

declare global {
  var __kv: KV | undefined;
}

async function kv(): Promise<KV> {
  if (globalThis.__kv) return globalThis.__kv;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (redisUrl && redisToken) {
    const { Redis } = await import("@upstash/redis");
    globalThis.__kv = new UpstashKV(new Redis({ url: redisUrl, token: redisToken }));
  } else {
    globalThis.__kv = new MemoryFileKV();
  }
  return globalThis.__kv;
}

export const db = {
  async getStore(id: string) {
    return (await kv()).get<Store>(`store:${id}`);
  },
  async saveStore(s: Store) {
    await (await kv()).set(`store:${s.id}`, s);
  },
  async listStores() {
    const k = await kv();
    const keys = await k.keys("store:");
    const stores = await Promise.all(keys.map((key) => k.get<Store>(key)));
    return stores.filter((s): s is Store => !!s).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getCart(id: string) {
    return (await kv()).get<Cart>(`cart:${id}`);
  },
  async saveCart(c: Cart) {
    await (await kv()).set(`cart:${c.id}`, c);
  },
  async getOrder(id: string) {
    return (await kv()).get<Order>(`order:${id}`);
  },
  async saveOrder(o: Order) {
    await (await kv()).set(`order:${o.id}`, o);
  },
  async listOrders(storeId: string) {
    const k = await kv();
    const keys = await k.keys("order:");
    const orders = await Promise.all(keys.map((key) => k.get<Order>(key)));
    return orders
      .filter((o): o is Order => !!o && o.storeId === storeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getSession(id: string) {
    return (await kv()).get<AgentSession>(`session:${id}`);
  },
  async saveSession(s: AgentSession) {
    await (await kv()).set(`session:${s.id}`, s);
  },
  async listSessions(storeId: string) {
    const k = await kv();
    const keys = await k.keys("session:");
    const sessions = await Promise.all(keys.map((key) => k.get<AgentSession>(key)));
    return sessions
      .filter((s): s is AgentSession => !!s && s.storeId === storeId)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  },
};

export async function logSessionEvent(storeId: string, sessionId: string, tool: string, summary: string, client?: string) {
  const now = new Date().toISOString();
  const existing = (await db.getSession(sessionId)) ?? {
    id: sessionId,
    storeId,
    client,
    events: [],
    startedAt: now,
    lastSeenAt: now,
  };
  existing.lastSeenAt = now;
  if (client && !existing.client) existing.client = client;
  existing.events.push({ at: now, tool, summary });
  if (existing.events.length > 200) existing.events = existing.events.slice(-200);
  await db.saveSession(existing);
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
