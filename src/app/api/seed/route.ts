import { ensureDemoData } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Idempotent: creates the Sunrise Bakery demo store plus clearly-labelled SAMPLE orders/sessions. */
export async function POST() {
  const { store, seededOrders, seededSessions } = await ensureDemoData();
  return Response.json({
    ok: true,
    storeId: store.id,
    products: store.products.length,
    seededOrders,
    seededSessions,
    note: "Sample data is flagged sample:true and never touches PayPal.",
  });
}

export async function GET() {
  return POST();
}
