import { headers } from "next/headers";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { storeId } = await params;
  const sp = await searchParams;
  const h = await headers();
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  return <Dashboard storeId={storeId} baseUrl={base.replace(/\/$/, "")} isNew={sp.new === "1"} />;
}
