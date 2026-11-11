import { captureAndFulfil } from "@/lib/fulfil";

export const dynamic = "force-dynamic";

/** PayPal redirects the buyer here after approval: ?token=<orderId>&store=<storeId> */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  const storeId = url.searchParams.get("store") ?? "";
  if (!orderId) return Response.redirect(new URL(`/cancel?store=${storeId}`, url), 302);
  try {
    const order = await captureAndFulfil(orderId);
    const status = order?.status ?? "UNKNOWN";
    return Response.redirect(
      new URL(`/thanks?order=${encodeURIComponent(orderId)}&store=${encodeURIComponent(storeId)}&status=${status}`, url),
      302,
    );
  } catch (err) {
    console.error("return capture failed", err instanceof Error ? err.message : err);
    return Response.redirect(
      new URL(`/thanks?order=${encodeURIComponent(orderId)}&store=${encodeURIComponent(storeId)}&status=ERROR`, url),
      302,
    );
  }
}
