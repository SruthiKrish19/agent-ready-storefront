"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE = `Sourdough Loaf, 8.50, 48-hour fermented country sourdough
Gluten-Free Birthday Cake (6in), 36, almond-flour vanilla sponge with strawberry jam
Croissant Box (6), 18, six all-butter croissants
Cold Brew Concentrate 1L, 14, small-batch Ethiopian beans`;

export function OnboardForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName, raw }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      router.push(`/store/${json.id}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/15"
        placeholder="Store name (optional, Claude can infer it)"
        value={storeName}
        onChange={(e) => setStoreName(e.target.value)}
      />
      <textarea
        className="h-48 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm dark:border-white/15"
        placeholder={SAMPLE}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={busy || raw.trim().length < 5}>
          {busy ? "Building your storefront…" : "Generate MCP storefront"}
        </button>
        <button type="button" className="text-sm underline opacity-70" onClick={() => setRaw(SAMPLE)}>
          Use sample
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
