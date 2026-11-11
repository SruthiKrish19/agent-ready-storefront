import Link from "next/link";

export default async function Cancel({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <h1 className="text-2xl font-bold">Payment cancelled</h1>
      <p className="opacity-70">No money moved. Your agent can call <code>checkout</code> again whenever you are ready.</p>
      {sp.store && <Link href={`/store/${sp.store}`} className="btn btn-ghost">Back to dashboard</Link>}
    </div>
  );
}
