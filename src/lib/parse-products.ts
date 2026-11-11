import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Product } from "./types";
import { newId } from "./store";

const ProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number(),
  category: z.string(),
  tags: z.array(z.string()),
});
const CatalogSchema = z.object({
  storeName: z.string(),
  tagline: z.string(),
  products: z.array(ProductSchema),
});

export type ParsedCatalog = { storeName: string; tagline: string; products: Product[]; parsedBy: "claude" | "fallback" };

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

/**
 * Claude turns a messy product paste (CSV, bullet list, prose) into a validated catalog.
 * Prices are re-validated in code afterwards; anything non-positive or absurd is rejected.
 */
async function parseWithClaude(storeHint: string, raw: string): Promise<ParsedCatalog | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system:
        "You convert a small merchant's unstructured product list into a clean catalog. " +
        "Extract only products that are actually present. Prices are in USD; if a price is missing, omit the product. " +
        "Never invent prices. Write a short friendly description (max 160 chars) if one is missing. " +
        "Choose a one-word category per product. Keep names under 60 chars. Suggest a store name and a tagline if the merchant gave hints.",
      messages: [
        {
          role: "user",
          content: `Store hint: ${storeHint || "(none)"}\n\nProduct list:\n${raw}`,
        },
      ],
      output_config: { format: zodOutputFormat(CatalogSchema) },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    const out = response.parsed_output;
    return {
      storeName: out.storeName || storeHint || "My Store",
      tagline: out.tagline,
      parsedBy: "claude",
      products: out.products
        .filter((p) => Number.isFinite(p.price) && p.price > 0 && p.price < 100000)
        .map((p) => ({
          id: newId("prod"),
          name: p.name.trim(),
          description: p.description.trim(),
          price: Math.round(p.price * 100) / 100,
          category: p.category.trim() || "general",
          tags: p.tags.map((t) => t.toLowerCase()).slice(0, 8),
          inStock: true,
        })),
    };
  } catch (err) {
    console.error("Claude parse failed, falling back:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Deterministic fallback: one product per line.
 * Accepts "Name, 12.50, description" / "Name - $12.50 - description" / "Name | 12.5" / CSV with header.
 */
export function parseFallback(storeHint: string, raw: string): ParsedCatalog {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const products: Product[] = [];
  for (const line of lines) {
    if (/^(name|product)\b/i.test(line) && /price/i.test(line)) continue; // CSV header
    const parts = line.split(/\s*(?:,|\||\s-\s|\t)\s*/).filter(Boolean);
    if (parts.length < 2) continue;
    let name = parts[0];
    let price = NaN;
    let priceIdx = -1;
    for (let i = 1; i < parts.length; i++) {
      const m = parts[i].match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
      if (m) {
        price = parseFloat(m[1]);
        priceIdx = i;
        break;
      }
    }
    if (!Number.isFinite(price) || price <= 0) continue;
    const description = parts.filter((_, i) => i !== 0 && i !== priceIdx).join(", ") || name;
    name = name.replace(/^[-*•\d.)\s]+/, "").slice(0, 60);
    products.push({
      id: newId("prod"),
      name,
      description: description.slice(0, 200),
      price: Math.round(price * 100) / 100,
      category: "general",
      tags: name.toLowerCase().split(/\s+/).slice(0, 4),
      inStock: true,
    });
  }
  return { storeName: storeHint || "My Store", tagline: "Now open to AI shopping agents.", products, parsedBy: "fallback" };
}

export async function parseProducts(storeHint: string, raw: string): Promise<ParsedCatalog> {
  return (await parseWithClaude(storeHint, raw)) ?? parseFallback(storeHint, raw);
}
