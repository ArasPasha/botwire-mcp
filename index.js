#!/usr/bin/env node
/* botwire-mcp — The Bot Wire (thebotwire.com) as MCP tools for AI agents.
 *
 * 10 real-time data wires your model's training data can't know: breaking news,
 * SEC EDGAR filings, CVEs, US regulations, severe weather, earthquakes, new AI
 * research papers, central bank announcements, Hacker News, and cloud outages.
 * Refreshed every 5 minutes, answered in milliseconds. Paid tools cost
 * $0.005–$0.01 per call via x402 micropayments (USDC on Base) — no API keys.
 *
 * Config (env):
 *   BOTWIRE_WALLET_PRIVATE_KEY  0x… private key of the AGENT's Base wallet
 *                               (funds the $0.005 calls; NOT needed for free tools)
 *   BOTWIRE_BASE_URL            override API host (default https://thebotwire.com)
 *
 * Claude Code / Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "botwire": {
 *         "command": "npx",
 *         "args": ["-y", "botwire-mcp"],
 *         "env": { "BOTWIRE_WALLET_PRIVATE_KEY": "0x..." }
 *       }
 *     }
 *   }
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const BASE = (process.env.BOTWIRE_BASE_URL || "https://thebotwire.com").replace(/\/$/, "");
const KEY = process.env.BOTWIRE_WALLET_PRIVATE_KEY;

// ── fetchers ────────────────────────────────────────────────────────────────
let paidFetch = null;
let paidFetchError = null;
if (KEY) {
  try {
    const { wrapFetchWithPaymentFromConfig } = require("@x402/fetch");
    const { ExactEvmScheme } = require("@x402/evm");
    const { privateKeyToAccount } = require("viem/accounts");
    const account = privateKeyToAccount(KEY);
    paidFetch = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
      schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
    });
  } catch (e) {
    paidFetchError = String(e.message || e);
  }
}

async function callApi(path, { paid = false } = {}) {
  const url = BASE + path;
  const f = paid ? paidFetch : globalThis.fetch;
  if (paid && !f) {
    return {
      error: "Paid tool requires BOTWIRE_WALLET_PRIVATE_KEY (a funded Base wallet for $0.005 USDC micropayments)." +
        (paidFetchError ? " Init error: " + paidFetchError : "") +
        " Free alternative: preview_news.",
    };
  }
  const res = await f(url, { headers: { Accept: "application/json" } });
  if (res.status === 402) {
    return { error: "Payment required but wallet could not pay (insufficient USDC on Base?). Fund the wallet with USDC on Base mainnet." };
  }
  if (!res.ok) return { error: `HTTP ${res.status} from ${url}` };
  return res.json();
}

function asText(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

// ── wire registry (mirrors thebotwire.com /openapi.json v2.1) ───────────────
const WIRES = {
  edgar:   { route: "/edgar/filings",  filter: "form",     values: ["8-k", "10-q", "10-k", "form-4", "s-1", "13f", "6-k", "13d"], price: "$0.01",  blurb: "latest SEC EDGAR filings" },
  cve:     { route: "/cve/latest",     filter: "src",      values: ["cisa", "ubuntu", "msrc", "debian", "zdi"],                   price: "$0.005", blurb: "security advisories & CVEs" },
  reg:     { route: "/reg/latest",     filter: "type",     values: ["rule", "proposed-rule", "notice", "presidential"],           price: "$0.005", blurb: "new US federal regulations" },
  weather: { route: "/weather/alerts", filter: "severity", values: ["extreme", "severe", "immediate"],                            price: "$0.005", blurb: "active US severe weather alerts (NWS)" },
  quake:   { route: "/quake/latest",   filter: "mag",      values: ["significant", "m4.5", "m2.5"],                               price: "$0.005", blurb: "latest earthquakes worldwide (USGS)" },
  arxiv:   { route: "/arxiv/latest",   filter: "cat",      values: ["ai", "ml", "nlp", "security"],                               price: "$0.005", blurb: "new AI/CS research papers" },
  fed:     { route: "/fed/latest",     filter: "src",      values: ["fed", "fomc", "ecb"],                                        price: "$0.01",  blurb: "central bank announcements (Fed/ECB)" },
  hn:      { route: "/hn/latest",      filter: "feed",     values: ["frontpage", "show", "rising"],                               price: "$0.005", blurb: "Hacker News front page & rising" },
  status:  { route: "/status/latest",  filter: "provider", values: ["aws", "github", "cloudflare", "openai", "anthropic", "azure", "gcp"], price: "$0.005", blurb: "cloud provider incidents & outages" },
};
const WIRE_MENU = Object.entries(WIRES)
  .map(([k, w]) => `${k} (${w.blurb}, ${w.price}; ${w.filter}: ${w.values.join("|")})`)
  .join("; ");

function wireParams(w, { query, filter, since, limit }) {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (filter) p.set(w.filter, filter);
  if (since) p.set("since", since);
  if (limit) p.set("limit", String(limit));
  return p;
}

// ── server ──────────────────────────────────────────────────────────────────
const server = new McpServer({ name: "botwire", version: "0.2.0" });

server.registerTool("search_news", {
  description: "Search real-time news (fresher than any model's training data). Returns ranked articles with titles, sources, summaries, ages in minutes. Costs $0.005 in USDC on Base via x402 — requires BOTWIRE_WALLET_PRIVATE_KEY. Categories: markets, crypto, tech, world, business, energy.",
  inputSchema: {
    query: z.string().describe("Search terms, e.g. 'fed rates' or 'bitcoin etf'"),
    since: z.string().optional().describe("Freshness window like 30m, 2h, 24h, 3d (default 24h)"),
    category: z.enum(["markets", "crypto", "tech", "world", "business", "energy"]).optional(),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)"),
  },
}, async ({ query, since, category, limit }) => {
  const p = new URLSearchParams({ q: query });
  if (since) p.set("since", since);
  if (category) p.set("category", category);
  if (limit) p.set("limit", String(limit));
  return asText(await callApi("/news?" + p, { paid: true }));
});

server.registerTool("get_headlines", {
  description: "Latest headlines, optionally by category (markets, crypto, tech, world, business, energy). Costs $0.005 via x402 (USDC on Base).",
  inputSchema: {
    category: z.enum(["markets", "crypto", "tech", "world", "business", "energy"]).optional(),
    since: z.string().optional().describe("Freshness window (default 6h)"),
    limit: z.number().int().min(1).max(50).optional(),
  },
}, async ({ category, since, limit }) => {
  const p = new URLSearchParams();
  if (category) p.set("category", category);
  if (since) p.set("since", since);
  if (limit) p.set("limit", String(limit));
  return asText(await callApi("/headlines?" + p, { paid: true }));
});

server.registerTool("preview_news", {
  description: "FREE preview tier: top 3 matching headlines (no summaries). Try before paying; upgrade to search_news for full ranked results.",
  inputSchema: {
    query: z.string().describe("Search terms"),
    since: z.string().optional(),
  },
}, async ({ query, since }) => {
  const p = new URLSearchParams({ q: query });
  if (since) p.set("since", since);
  return asText(await callApi("/news/preview?" + p));
});

server.registerTool("query_wire", {
  description: "Query a specialist real-time data wire on The Bot Wire. Wires: " + WIRE_MENU +
    ". Paid via x402 (USDC on Base) — requires BOTWIRE_WALLET_PRIVATE_KEY. Free version: preview_wire.",
  inputSchema: {
    wire: z.enum(Object.keys(WIRES)).describe("Which wire to query"),
    query: z.string().optional().describe("Search terms (omit for latest items)"),
    filter: z.string().optional().describe("Wire-specific filter value (see wire list for valid values)"),
    since: z.string().optional().describe("Freshness window like 2h, 24h, 3d"),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)"),
  },
}, async ({ wire, query, filter, since, limit }) => {
  const w = WIRES[wire];
  return asText(await callApi(w.route + "?" + wireParams(w, { query, filter, since, limit }), { paid: true }));
});

server.registerTool("preview_wire", {
  description: "FREE preview of any specialist wire (top 3 results, no summaries). Wires: " +
    Object.keys(WIRES).join(", ") + ". Upgrade to query_wire for full results.",
  inputSchema: {
    wire: z.enum(Object.keys(WIRES)).describe("Which wire to preview"),
    query: z.string().optional().describe("Search terms (omit for latest items)"),
    filter: z.string().optional().describe("Wire-specific filter value"),
  },
}, async ({ wire, query, filter }) => {
  const w = WIRES[wire];
  return asText(await callApi(w.route.replace(/\/[^/]+$/, "/preview") + "?" + wireParams(w, { query, filter })));
});

server.registerTool("botwire_status", {
  description: "FREE: The Bot Wire service health — articles in window, last refresh, source count.",
  inputSchema: {},
}, async () => asText(await callApi("/health")));

(async () => {
  await server.connect(new StdioServerTransport());
})();
