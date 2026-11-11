import { addOrderTracking, captureOrder, getOrder } from "./paypal";
import { db } from "./store";
import type { Order } from "./types";

const CARRIERS = ["USPS", "UPS", "FEDEX", "DHL"] as const;

function fakeTracking() {
  const carrier = CARRIERS[Math.floor(Math.random() * CARRIERS.length)];
  const num = `${carrier.slice(0, 2)}${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  return { carrier, trackingNumber: num };
}

/**
 * Capture an approved order, then attach shipment tracking to the capture.
 * Idempotent: safe to call from the /return page and from the webhook.
 */
export async function captureAndFulfil(orderId: string): Promise<Order | null> {
  const order = await db.getOrder(orderId);
  if (!order) return null;
  if (order.status === "COMPLETED" && order.tracking) return order;

  let live = await getOrder(orderId);
  if (live.status === "APPROVED") {
    try {
      live = await captureOrder(orderId);
    } catch (err) {
      // ORDER_ALREADY_CAPTURED and friends: re-read.
      console.error("capture error", err instanceof Error ? err.message : err);
      live = await getOrder(orderId);
    }
  }
  if (live.status === "COMPLETED") {
    order.status = "COMPLETED";
    order.captureId = live.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    order.payerEmail = live.payer?.email_address;
    order.payerName = [live.payer?.name?.given_name, live.payer?.name?.surname].filter(Boolean).join(" ") || undefined;
    if (!order.tracking && order.captureId) {
      const t = fakeTracking();
      try {
        await addOrderTracking(order.id, order.captureId, t.carrier, t.trackingNumber);
        order.tracking = { ...t, status: "SHIPPED", addedAt: new Date().toISOString() };
      } catch (err) {
        console.error("tracking error", err instanceof Error ? err.message : err);
        order.tracking = { ...t, status: "LABEL_CREATED", addedAt: new Date().toISOString() };
      }
    }
  } else if (live.status === "APPROVED") {
    order.status = "APPROVED";
  } else if (live.status === "VOIDED") {
    order.status = "VOIDED";
  }
  order.updatedAt = new Date().toISOString();
  await db.saveOrder(order);
  return order;
}
