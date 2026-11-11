import { captureAndFulfil } from "@/lib/fulfil";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * PayPal webhook listener. Instead of trusting the payload, we re-read the order from PayPal
 * (captureAndFulfil fetches /v2/checkout/orders/{id}) so a forged event cannot mark anything paid.
 */
export async function POST(req: Request) {
  const event = (await req.json().catch(() => null)) as
    | { event_type?: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } }
    | null;
  if (!event?.event_type) return Response.json({ ok: false }, { status: 400 });
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id ?? event.resource?.id;
  if (!orderId) return Response.json({ ok: true, ignored: event.event_type });
  if (!(await db.getOrder(orderId))) return Response.json({ ok: true, ignored: "unknown order" });
  if (["CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED", "CHECKOUT.ORDER.COMPLETED"].includes(event.event_type)) {
    const order = await captureAndFulfil(orderId);
    return Response.json({ ok: true, status: order?.status });
  }
  return Response.json({ ok: true, ignored: event.event_type });
}
