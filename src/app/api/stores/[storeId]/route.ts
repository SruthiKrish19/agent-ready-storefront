import { db } from "@/lib/store";
import { ensureDemoStore, DEMO_STORE_ID } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = storeId === DEMO_STORE_ID ? await ensureDemoStore() : await db.getStore(storeId);
  if (!store) return Response.json({ error: "not found" }, { status: 404 });
  const [orders, sessions] = await Promise.all([db.listOrders(storeId), db.listSessions(storeId)]);
  return Response.json({ store, orders, sessions, ai: Boolean(process.env.ANTHROPIC_API_KEY) });
}
