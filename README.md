# Agent-Ready Storefront

**Paste a product list, get a hosted MCP storefront that AI shopping agents can browse and buy from, with PayPal Orders settling every purchase.**

Built for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com/) · Agentic Commerce.

> PayPal's 2026 push is "agent-ready" commerce. Big retailers can build for it; a bakery cannot. This project lets the smallest merchant on earth sell to Claude, ChatGPT or any MCP-capable agent in under a minute, using nothing but standard PayPal primitives.

## What it does

1. **Merchant pastes products** (CSV, bullets, prose). Claude turns the paste into a validated catalog; prices and SKUs are re-checked by code before anything is written. Every product is mirrored into the **PayPal Catalog** (gets a `PROD-…` id).
2. **The store gets an MCP server** at `/api/mcp/<storeId>` (Streamable HTTP, stateless, serverless-friendly) exposing five tools:
   - `search_products` · `get_product` · `create_cart` · `checkout` · `track_order`
3. **A buyer's agent shops.** `checkout` creates a **PayPal Order (v2)** and returns the approval URL. The agent never touches a payment method; the human approves in PayPal.
4. **PayPal redirects to `/return`**, we **capture** the order, attach **shipment tracking** to the capture, and the agent can read it back via `track_order`. A **webhook** listener re-verifies events against PayPal before trusting them.
5. **Merchant dashboard** (AG Grid): live orders, every agent session's journey (what it searched, carted, bought), catalog with PayPal ids, and an "ask your store" assistant powered by Claude + tools.

## Demo store

`Sunrise Bakery` is seeded on first request. See `/demo` for the MCP URL, a Claude Desktop config snippet, and a curl example.

Ask Claude Desktop: *"Find me a gluten-free birthday cake under $40 from Sunrise Bakery and buy it."*

## Stack

| Layer | Tech |
|---|---|
| App | Next.js 16 (App Router) · TypeScript · Tailwind v4 |
| MCP | `@modelcontextprotocol/sdk` `WebStandardStreamableHTTPServerTransport` (stateless, JSON responses) |
| PayPal | REST sandbox: Catalog Products, Orders v2 (create / get / capture), Order tracking, Webhooks |
| AI | Anthropic SDK · `claude-sonnet-5-5` with structured outputs (`zodOutputFormat`) for catalog parsing; tool-use loop for the merchant assistant |
| Sponsor | **AG Grid** (community) for the orders and agent-sessions grids |
| Storage | Upstash Redis if configured, else in-memory + `.data/store.json` (zero setup) |
| Hosting | Vercel |

## How PayPal is used

| PayPal API | Where | Why |
|---|---|---|
| `POST /v1/catalogs/products` | `src/lib/catalog.ts` | Every parsed product becomes a PayPal Catalog product (category mapped to PayPal's enum) |
| `POST /v2/checkout/orders` | `checkout` tool (`src/lib/mcp-server.ts`) | Creates the order with line items and return/cancel URLs, returns the approval link |
| `GET /v2/checkout/orders/{id}` | `track_order`, `/return`, webhook | Source of truth for payment status |
| `POST /v2/checkout/orders/{id}/capture` | `src/lib/fulfil.ts` | Capture after buyer approval (idempotent via `PayPal-Request-Id`) |
| `POST /v2/checkout/orders/{id}/track` | `src/lib/fulfil.ts` | Attaches carrier + tracking number to the capture |
| Webhooks (`PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`) | `src/app/api/webhooks/paypal/route.ts` | Re-reads the order from PayPal before updating anything, so forged events can't mark orders paid |

All calls hit the **sandbox**. Currency is USD (the sandbox merchant account is IN-region, where USD is supported).

## How AI is used

- **Catalog parsing** (`src/lib/parse-products.ts`): Claude extracts `{name, description, price, category, tags}` with a strict schema. Code then drops non-positive/absurd prices and normalises. Without `ANTHROPIC_API_KEY` a deterministic line parser (`Name, 12.50, description`) is used so the app still runs end to end.
- **Merchant assistant** (`src/app/api/ask/route.ts`): Claude with two read-only tools (`list_orders`, `list_agent_sessions`) answers questions like "what are agents searching for that we don't sell?".
- **The buyer side is any MCP client** (Claude Desktop, Cursor, Claude Code, MCP Inspector) connecting to the generated server.

## Run locally

```bash
git clone https://github.com/SruthiKrish19/agent-ready-storefront
cd agent-ready-storefront
npm install
cp .env.example .env.local   # fill PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (sandbox). ANTHROPIC_API_KEY optional.
npm run dev                  # http://localhost:3000
```

Then open `/demo`, or point an MCP client at `http://localhost:3000/api/mcp/sunrise-bakery`.

```bash
# Claude Code
claude mcp add --transport http sunrise http://localhost:3000/api/mcp/sunrise-bakery
```

### Environment variables

| Var | Required | Notes |
|---|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | yes | Sandbox REST app credentials |
| `PAYPAL_ENV` | no | `sandbox` (default) or `live` |
| `ANTHROPIC_API_KEY` | no | Enables Claude parsing + assistant; otherwise deterministic fallbacks |
| `ANTHROPIC_MODEL` | no | default `claude-sonnet-5-5` |
| `NEXT_PUBLIC_BASE_URL` | prod | Public URL used in PayPal return/cancel URLs and MCP snippets |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | no | Durable storage; otherwise in-memory + JSON file |

### Testing the checkout

Judges: the PayPal **sandbox buyer login** is in the Devpost submission's testing instructions. Flow:

1. Call `search_products` → `create_cart` → `checkout` (via an MCP client or the curl commands in [TESTING.md](TESTING.md)).
2. Open the returned `approve_url`, log in with the sandbox buyer, click Pay.
3. You land on `/thanks` with the capture + tracking; the order and the agent's session appear in `/store/sunrise-bakery`.
4. Call `track_order` to see `COMPLETED` and the tracking number from the agent side.

## Project layout

```
src/app/api/mcp/[storeId]/route.ts   MCP endpoint (GET/POST/DELETE)
src/app/api/stores/                  create store (parse + catalog sync), read store/orders/sessions
src/app/api/ask/route.ts             merchant assistant (Claude tool loop)
src/app/api/webhooks/paypal/route.ts PayPal webhook listener
src/app/return/route.ts              PayPal return → capture → tracking → /thanks
src/app/store/[storeId]/page.tsx     merchant dashboard (AG Grid)
src/app/demo/page.tsx                demo store + connection snippets
src/lib/mcp-server.ts                the five tools
src/lib/paypal.ts                    PayPal REST client
src/lib/parse-products.ts            Claude structured-output parser + fallback
src/lib/fulfil.ts                    capture + tracking
src/lib/store.ts                     storage interface (Upstash / memory+file)
```

## Sponsor tools

- **AG Grid** (`ag-grid-react`, `ag-grid-community`): orders grid and agent-sessions grid on the dashboard, with sorting/filtering and journey tooltips.

## License

MIT, see [LICENSE](LICENSE).
