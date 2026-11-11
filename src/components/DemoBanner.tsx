"use client";

import { useSyncExternalStore } from "react";

const KEY = "ars-demo-banner-dismissed";

/** Shown only on hosted instances without an AI key (decided server-side in layout). */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  try {
    return sessionStorage.getItem(KEY) !== "1";
  } catch {
    return true;
  }
}
function dismiss() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}

export function DemoBanner({ repoUrl }: { repoUrl: string }) {
  // Server snapshot = open, so the banner is visible by default and hydration stays consistent.
  const open = useSyncExternalStore(subscribe, getSnapshot, () => true);
  if (!open) return null;
  return (
    <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 text-sm">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5">
        <span className="mt-0.5 shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">Hosted demo</span>
        <p className="flex-1 leading-snug">
          AI API credits aren&apos;t available on this hosted instance, so product parsing and the store assistant run in{" "}
          <strong>fallback mode</strong>. Rows marked <span className="rounded bg-amber-500/20 px-1 text-[10px] font-semibold">SAMPLE</span> are seeded for reviewers.{" "}
          <strong>PayPal sandbox calls are real.</strong> To run with live Claude:{" "}
          <a className="underline" href={`${repoUrl}#hosted-demo-vs-running-locally`} target="_blank" rel="noreferrer">
            clone the repo
          </a>
          , add <code>ANTHROPIC_API_KEY</code> and PayPal sandbox keys to <code>.env.local</code>, then <code>npm run dev</code>.
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 rounded px-2 text-lg leading-none opacity-60 hover:opacity-100"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}
