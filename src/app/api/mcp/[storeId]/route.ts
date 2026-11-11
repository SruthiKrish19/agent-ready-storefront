import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { db } from "@/lib/store";
import { ensureDemoStore, DEMO_STORE_ID } from "@/lib/seed";
import { buildStoreServer } from "@/lib/mcp-server";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = storeId === DEMO_STORE_ID ? await ensureDemoStore() : await db.getStore(storeId);
  if (!store) {
    return Response.json({ jsonrpc: "2.0", error: { code: -32004, message: `Unknown store '${storeId}'` }, id: null }, { status: 404 });
  }
  const server = buildStoreServer({
    store,
    baseUrl: baseUrl(req),
    clientHint: req.headers.get("user-agent")?.slice(0, 80) ?? undefined,
  });
  // Stateless transport: no session id, plain JSON responses (works with curl, Claude Desktop via mcp-remote, Inspector).
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Let the response flush, then tear down.
    setTimeout(() => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    }, 0);
  }
}

export { handle as GET, handle as POST, handle as DELETE };
