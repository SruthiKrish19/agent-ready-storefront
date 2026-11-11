# Testing

All commands below were run against a production build (`npm run build && npx next start -p 3077`) with sandbox PayPal credentials in `.env.local`. Replace `localhost:3077` with the deployment URL.

```bash
U=http://localhost:3077/api/mcp/sunrise-bakery
H=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
```

## 1. MCP handshake

```bash
curl -s "$U" "${H[@]}" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
# -> serverInfo "Sunrise Bakery storefront", instructions describing the workflow

curl -s "$U" "${H[@]}" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
# -> search_products, get_product, create_cart, checkout, track_order
```

## 2. Shop

```bash
curl -s "$U" "${H[@]}" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"gluten-free birthday cake","max_price":40}}}'
# -> {"session_id":"sess_…","results":[{"id":"prod_…","name":"Gluten-Free Birthday Cake (6in)","price":36},…]}

curl -s "$U" "${H[@]}" -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"create_cart","arguments":{"session_id":"<sess>","items":[{"product_id":"<prod>","quantity":1}]}}}'
# -> {"cart_id":"cart_…","total":36}

curl -s "$U" "${H[@]}" -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"checkout","arguments":{"session_id":"<sess>","cart_id":"<cart>"}}}'
# -> {"order_id":"9UH14677U1106010T","approve_url":"https://www.sandbox.paypal.com/checkoutnow?token=…"}
#    (a real sandbox PayPal Order was created)

curl -s "$U" "${H[@]}" -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"track_order","arguments":{"session_id":"<sess>","order_id":"<order>"}}}'
# -> payment_status CREATED, "Awaiting buyer approval in PayPal."
```

## 3. Approve and capture

Open `approve_url` in a browser, log in with the sandbox **buyer** account (see Devpost testing instructions), click Pay. PayPal redirects to `/return?token=<order>&store=sunrise-bakery`, which captures the order, attaches tracking, and redirects to `/thanks`. `track_order` then returns `COMPLETED` plus carrier and tracking number.

## 4. Dashboard and pages

```bash
curl -s http://localhost:3077/api/stores/sunrise-bakery | jq '{orders: (.orders|length), sessions: (.sessions|length), paypalIds: [.store.products[].paypalProductId]}'
# -> 8 of 8 products have PayPal Catalog ids

for p in / /demo /store/sunrise-bakery; do curl -s -o /dev/null -w "$p %{http_code}\n" http://localhost:3077$p; done
# -> all 200
```

## 5. Webhook hardening

```bash
curl -s -X POST http://localhost:3077/api/webhooks/paypal -H 'Content-Type: application/json' \
  -d '{"event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"id":"fake","supplementary_data":{"related_ids":{"order_id":"<order>"}}}}'
# -> {"ok":true,"status":"CREATED"}  (forged event did NOT mark the order paid; status re-read from PayPal)
```

## 6. Onboarding (fallback parser, no Anthropic key)

```bash
curl -s -X POST http://localhost:3077/api/stores -H 'Content-Type: application/json' \
  -d '{"storeName":"Probe Plants","raw":"Monstera, 24.00, large leafy plant\nSnake Plant | 18 | low light friendly\nPothos - $12 - trailing vine"}'
# -> {"id":"probe-plants","name":"Probe Plants","products":3,"parsedBy":"fallback"}
```

With `ANTHROPIC_API_KEY` set, the same call returns `"parsedBy":"claude"` and handles messy prose.

## 7. Merchant assistant

```bash
curl -s -X POST http://localhost:3077/api/ask -H 'Content-Type: application/json' \
  -d '{"storeId":"sunrise-bakery","question":"How are sales?"}'
# -> deterministic summary without a key; Claude tool-use answer with one
```
