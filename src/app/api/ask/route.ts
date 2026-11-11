import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/store";
import { ensureDemoStore, DEMO_STORE_ID } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

/**
 * Merchant-side "ask your store" assistant. Claude answers questions about orders and agent
 * sessions using two read-only tools. Without an API key it returns a deterministic summary.
 */
export async function POST(req: Request) {
  const { storeId, question } = (await req.json().catch(() => ({}))) as { storeId?: string; question?: string };
  if (!storeId || !question) return Response.json({ error: "storeId and question required" }, { status: 400 });
  const store = storeId === DEMO_STORE_ID ? await ensureDemoStore() : await db.getStore(storeId);
  if (!store) return Response.json({ error: "store not found" }, { status: 404 });
  const [orders, sessions] = await Promise.all([db.listOrders(storeId), db.listSessions(storeId)]);

  if (!process.env.ANTHROPIC_API_KEY) {
    const real = orders.filter((o) => !o.sample);
    const sampleOrders = orders.length - real.length;
    const paid = real.filter((o) => o.status === "COMPLETED");
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const liveSessions = sessions.filter((s) => !s.sample);
    const sampleSessions = sessions.length - liveSessions.length;
    const searches = sessions.flatMap((s) => s.events.filter((e) => e.tool === "search_products").map((e) => e.summary));
    const sampleOrderNote = sampleOrders ? ` (plus ${sampleOrders} SAMPLE orders seeded for review)` : "";
    const sampleSessionNote = sampleSessions ? ` (plus ${sampleSessions} sample)` : "";
    return Response.json({
      mode: "fallback",
      answer:
        `(Fallback mode: deterministic summary. Run locally with ANTHROPIC_API_KEY for a Claude answer.)\n` +
        `${store.name}: ${real.length} real orders, ${paid.length} paid, $${revenue.toFixed(2)} revenue${sampleOrderNote}. ` +
        `${liveSessions.length} live agent sessions${sampleSessionNote}. Recent searches: ${searches.slice(0, 5).join("; ") || "none yet"}.`,
    });
  }

  const client = new Anthropic();
  const tools: Anthropic.Tool[] = [
    {
      name: "list_orders",
      description: "List this store's orders with status, total, buyer and tracking.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      strict: true,
    },
    {
      name: "list_agent_sessions",
      description: "List AI shopping agent sessions: what each agent searched, carted and bought.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      strict: true,
    },
  ];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const system = `You are the operations assistant for ${store.name}, a small merchant whose storefront is sold to AI shopping agents over MCP and settled with PayPal. Answer concisely with concrete numbers. Use the tools to look at orders and sessions before answering. Today is ${new Date().toDateString()}.`;

  for (let turn = 0; turn < 4; turn++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: 4000, system, tools, messages });
    if (res.stop_reason === "refusal") return Response.json({ answer: "I can't help with that request." });
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason !== "tool_use") {
      const answer = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
      return Response.json({ answer, mode: "claude" });
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const payload = block.name === "list_orders" ? orders : sessions;
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(payload).slice(0, 60000) });
    }
    messages.push({ role: "user", content: results });
  }
  return Response.json({ answer: "I ran out of steps before finishing. Please ask a narrower question." });
}
