export function mcpSnippets(storeId: string, storeName: string, baseUrl: string) {
  const url = `${baseUrl}/api/mcp/${storeId}`;
  const key = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const claudeDesktop = JSON.stringify(
    { mcpServers: { [key]: { command: "npx", args: ["-y", "mcp-remote", url] } } },
    null,
    2,
  );
  const curl = `curl -s ${url} -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"birthday cake","max_price":40}}}'`;
  return { url, claudeDesktop, curl };
}
