import Link from "next/link";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Thanks({ searchParams }: { searchParams: Promise<{ order?: string; store?: string; status?: string }> }) {
  const sp = await searchParams;
  const order = sp.order ? await db.getOrder(sp.order) : null;
  const ok = order?.status === "COMPLETED";
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <div className={`mx-auto h-14 w-14 rounded-full ${ok ? "bg-green-500" : "bg-amber-500"}`} />
      <h1 className="text-2xl font-bold">{ok ? "Payment complete" : "Payment pending"}</h1>
      {order ? (
        <div className="card space-y-1 p-4 text-left text-sm">
          <div><span className="opacity-60">Order</span> {order.id}</div>
          <div><span className="opacity-60">Status</span> {order.status}</div>
          <div><span className="opacity-60">Total</span> ${order.total.toFixed(2)} USD</div>
          <div><span className="opacity-60">Items</span> {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</div>
          {order.tracking && (
            <div><span className="opacity-60">Shipping</span> {order.tracking.carrier} {order.tracking.trackingNumber} ({order.tracking.status})</div>
          )}
        </div>
      ) : (
        <p className="opacity-70">We could not find that order ({sp.status ?? "unknown"}).</p>
      )}
      <p className="text-sm opacity-70">You can close this tab and go back to your agent. It can call <code>track_order</code> to see this status.</p>
      {sp.store && <Link href={`/store/${sp.store}`} className="btn">Open merchant dashboard</Link>}
    </div>
  );
}
