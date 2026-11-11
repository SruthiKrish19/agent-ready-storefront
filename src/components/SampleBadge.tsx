export function SampleBadge({ title = "Seeded for review, not a PayPal order." }: { title?: string }) {
  return (
    <span title={title} className="inline-block rounded bg-amber-500/20 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
      Sample
    </span>
  );
}
