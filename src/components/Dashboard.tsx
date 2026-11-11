"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import type { AgentSession, Order, Store } from "@/lib/types";
import { CopyBlock } from "./Snippets";
import { mcpSnippets } from "@/lib/snippets";

ModuleRegistry.registerModules([AllCommunityModule]);

type Payload = { store: Store; orders: Order[]; sessions: AgentSession[] };

const usd = (v: number) => `$${v.toFixed(2)}`;

export function Dashboard({ storeId, baseUrl, isNew }: { storeId: string; baseUrl: string; isNew: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [question, setQuestion] = useState("Which products are agents searching for most, and what did they buy?");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${storeId}`, { cache: "no-store" });
    if (!res.ok) {
      setErr("Store not found");
      return;
    }
    setData(await res.json());
  }, [storeId]);

  useEffect(() => {
    // Subscribe to the store feed: initial fetch (async, so no sync setState) + 5s polling.
    const t = setInterval(load, 5000);
    const first = setTimeout(load, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [load]);

  const orderCols = useMemo<ColDef<Order>[]>(
    () => [
      { field: "id", headerName: "PayPal order", width: 190 },
      { field: "status", width: 120, cellClass: (p) => (p.value === "COMPLETED" ? "font-semibold text-green-600" : "") },
      { headerName: "Items", valueGetter: (p) => p.data?.items.map((i) => `${i.quantity}× ${i.name}`).join(", "), flex: 2 },
      { field: "total", width: 100, valueFormatter: (p) => usd(p.value ?? 0) },
      { field: "payerEmail", headerName: "Buyer", width: 220 },
      { headerName: "Tracking", valueGetter: (p) => (p.data?.tracking ? `${p.data.tracking.carrier} ${p.data.tracking.trackingNumber}` : ""), width: 200 },
      { field: "sessionId", headerName: "Agent session", width: 150 },
      { field: "createdAt", headerName: "Created", width: 180, valueFormatter: (p) => new Date(p.value).toLocaleString() },
    ],
    [],
  );

  const sessionCols = useMemo<ColDef<AgentSession>[]>(
    () => [
      { field: "id", headerName: "Session", width: 150 },
      { field: "client", headerName: "Client", width: 200, valueFormatter: (p) => (p.value ?? "").split(" ")[0] },
      { headerName: "Calls", valueGetter: (p) => p.data?.events.length ?? 0, width: 80 },
      { headerName: "Journey", valueGetter: (p) => p.data?.events.map((e) => `${e.tool}: ${e.summary}`).join("  →  "), flex: 3, tooltipValueGetter: (p) => p.value },
      { field: "lastSeenAt", headerName: "Last seen", width: 180, valueFormatter: (p) => new Date(p.value).toLocaleString() },
    ],
    [],
  );

  if (err) return <p className="text-red-600">{err}</p>;
  if (!data) return <p className="opacity-70">Loading…</p>;

  const { store, orders, sessions } = data;
  const snippets = mcpSnippets(store.id, store.name, baseUrl);
  const paid = orders.filter((o) => o.status === "COMPLETED");
  const revenue = paid.reduce((s, o) => s + o.total, 0);

  async function ask() {
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, question }) });
      const j = await res.json();
      setAnswer(j.answer ?? j.error ?? "No answer");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-8">
      {isNew && (
        <div className="card border-green-500/40 bg-green-500/5 p-4 text-sm">
          <strong>Your store is live.</strong> {store.products.length} products parsed by{" "}
          {store.parsedBy === "claude" ? "Claude" : "the built-in parser"}
          {store.products.some((p) => p.paypalProductId) ? ", synced to the PayPal Catalog" : ""}. Point any MCP client at the URL below.
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{store.name}</h1>
          <p className="opacity-70">{store.tagline}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Orders" value={String(orders.length)} />
          <Stat label="Paid revenue" value={usd(revenue)} />
          <Stat label="Agent sessions" value={String(sessions.length)} />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Connect an agent</h2>
          <CopyBlock label="MCP endpoint (Streamable HTTP)" code={snippets.url} />
          <CopyBlock label="Claude Desktop · claude_desktop_config.json" code={snippets.claudeDesktop} />
        </div>
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Catalog ({store.products.length})</h2>
          <ul className="max-h-56 space-y-1 overflow-auto text-sm">
            {store.products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 border-b border-black/5 py-1 dark:border-white/5">
                <span>
                  {p.name} <span className="opacity-50">· {p.category}</span>
                  {p.paypalProductId && <span className="ml-2 rounded bg-sky-500/10 px-1 text-[10px] text-sky-600">PayPal {p.paypalProductId}</span>}
                </span>
                <span className="font-mono">{usd(p.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Orders <span className="text-xs opacity-60">(AG Grid · live, refreshes every 5s)</span></h2>
        <div style={{ height: 300 }}>
          <AgGridReact<Order> theme={themeQuartz} rowData={orders} columnDefs={orderCols} defaultColDef={{ sortable: true, filter: true, resizable: true }} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Agent sessions <span className="text-xs opacity-60">(what each shopping agent did)</span></h2>
        <div style={{ height: 260 }}>
          <AgGridReact<AgentSession> theme={themeQuartz} rowData={sessions} columnDefs={sessionCols} defaultColDef={{ sortable: true, filter: true, resizable: true }} tooltipShowDelay={300} />
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Ask your store</h2>
        <div className="flex gap-2">
          <input className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className="btn" onClick={ask} disabled={asking}>{asking ? "Thinking…" : "Ask"}</button>
        </div>
        {answer && <pre className="code whitespace-pre-wrap">{answer}</pre>}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-2">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs opacity-60">{label}</div>
    </div>
  );
}
