#!/usr/bin/env node
/* botwire-mcp — The Bot Wire (thebotwire.com) as MCP tools for AI agents.
 *
 * 57 real-time data wires your model's training data can't know. Primary
 * sources, not a crawler's index of them: SEC EDGAR, the Federal Reserve,
 * BLS/BEA economic data, federal courts, Congress, the White House, DOJ, FDA,
 * WHO/CDC, the European Commission, GOV.UK, the Pentagon, CISA advisories,
 * USGS earthquakes, NWS weather alerts, arXiv, bioRxiv, NASA — plus breaking
 * news, world, tech, markets, crypto, energy, supply chain, open-source
 * releases, launches, gaming, film, music and remote jobs.
 * The WIRES registry below MIRRORS the server's lib/wires.js and drifts as
 * wires are added: regenerate it from https://thebotwire.com/wires.json before
 * every publish. list_wires returns the live list at runtime.
 * Refreshed continuously, answered in milliseconds. Paid tools cost
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
  edgar:          { route: "/edgar/filings"          , filter: "form"     , values: ["8-k","10-q","10-k","form-4","s-1","13f","6-k","13d"], price: "$0.01", ask: "a company's SEC filings, insider trades, or a specific form (8-K, 10-K, 10-Q, Form 4, S-1, 13F, 13D)" },
  cve:            { route: "/cve/latest"             , filter: "src"      , values: ["cisa","ubuntu","msrc","debian","zdi"], price: "$0.005", ask: "a vulnerability, CVE, or security advisory affecting a named product or vendor" },
  reg:            { route: "/reg/latest"             , filter: "type"     , values: ["rule","proposed-rule","notice","presidential"], price: "$0.005", ask: "a new US federal rule, proposed rule, notice, or presidential document" },
  weather:        { route: "/weather/alerts"         , filter: "severity" , values: ["extreme","severe","immediate"], price: "$0.005", ask: "an active US severe-weather alert for a place: storm, flood, heat, winter, wind" },
  quake:          { route: "/quake/latest"           , filter: "mag"      , values: ["significant","m4.5","m2.5"], price: "$0.005", ask: "a recent earthquake, its magnitude, depth, or location" },
  arxiv:          { route: "/arxiv/latest"           , filter: "cat"      , values: ["ai","ml","nlp","security"], price: "$0.005", ask: "a new AI, ML, NLP, or security research paper" },
  fed:            { route: "/fed/latest"             , filter: "src"      , values: ["fed","fomc","ecb"], price: "$0.01", ask: "what the Federal Reserve, the FOMC, or the ECB just said about rates or policy" },
  hn:             { route: "/hn/latest"              , filter: "feed"     , values: ["frontpage","show","rising"], price: "$0.005", ask: "what developers are discussing or upvoting right now" },
  status:         { route: "/status/latest"          , filter: "provider" , values: ["aws","github","cloudflare","openai","anthropic","azure","gcp"], price: "$0.005", ask: "whether AWS, GCP, Azure, GitHub, Cloudflare, OpenAI, or Anthropic is currently down" },
  ailab:          { route: "/ailab/latest"           , filter: "lab"      , values: ["openai","deepmind","google","huggingface","aws"], price: "$0.005", ask: "what OpenAI, DeepMind, Google, Hugging Face, or AWS just announced or released" },
  security:       { route: "/security/news"          , filter: "src"      , values: ["bleepingcomputer","krebs","hackernews","arstechnica"], price: "$0.005", ask: "a breach, ransomware incident, or threat-actor campaign being reported" },
  court:          { route: "/court/opinions"         , filter: "type"     , values: ["scotus","ca2","ca9","cafc","govinfo"], price: "$0.01", ask: "a new US federal court opinion or ruling, including the Supreme Court" },
  bills:          { route: "/bills/latest"           , filter: "type"     , values: ["bills","statutes"], price: "$0.01", ask: "a newly introduced congressional bill or a statute compilation" },
  enforcement:    { route: "/enforcement/latest"     , filter: "agency"   , values: ["sec","ftc"], price: "$0.01", ask: "an SEC or FTC enforcement action, fine, or litigation release" },
  recalls:        { route: "/recalls/latest"         , filter: "src"      , values: ["cpsc","fda"], price: "$0.005", ask: "a consumer product recall or an FDA regulatory action" },
  crypto:         { route: "/crypto/latest"          , filter: "src"      , values: ["coindesk","cointelegraph","ethereum"], price: "$0.005", ask: "crypto, blockchain, or protocol-level news" },
  space:          { route: "/space/latest"           , filter: "src"      , values: ["nasa"], price: "$0.005", ask: "a NASA mission, launch, or scientific discovery" },
  sports:         { route: "/sports/latest"          , filter: "src"      , values: ["bbc","espn"], price: "$0.005", ask: "a score, result, fixture, or transfer" },
  jobs:           { route: "/jobs/latest"            , filter: "src"      , values: ["remote","hn"], price: "$0.005", ask: "an open remote engineering, design, or product role" },
  releases:       { route: "/releases/latest"        , filter: "project"  , values: ["node","python","kubernetes","rust","go","react","pytorch","deno","bun"], price: "$0.005", ask: "whether a dependency shipped a new version: Node, CPython, Kubernetes, Rust, Go, React, PyTorch, Deno, Bun" },
  markets:        { route: "/markets/latest"         , filter: "src"      , values: ["yahoo","marketwatch","seekingalpha"], price: "$0.005", ask: "equities, indices, or macro market movement being reported" },
  world:          { route: "/world/latest"           , filter: "src"      , values: ["aljazeera","dw","france24","bbc"], price: "$0.005", ask: "an international story from a non-US news desk" },
  tech:           { route: "/tech/latest"            , filter: "src"      , values: ["techcrunch","verge","ars"], price: "$0.005", ask: "a technology launch, funding round, or platform change" },
  econ:           { route: "/econ/latest"            , filter: "src"      , values: ["bls","bea","rates"], price: "$0.01", ask: "a US economic data release: CPI, jobs, GDP, interest rates" },
  science:        { route: "/science/latest"         , filter: "src"      , values: ["nature","science","physorg"], price: "$0.005", ask: "new peer-reviewed research or science reporting" },
  preprints:      { route: "/preprints/latest"       , filter: "src"      , values: ["biorxiv","medrxiv"], price: "$0.005", ask: "a biology or medicine preprint, before peer review" },
  publichealth:   { route: "/publichealth/latest"    , filter: "src"      , values: ["who","cdc"], price: "$0.005", ask: "a disease outbreak, or WHO/CDC guidance and health advisories" },
  fda:            { route: "/fda/latest"             , filter: "src"      , values: ["fda"], price: "$0.005", ask: "a drug or device approval, clearance, or safety communication" },
  doj:            { route: "/doj/latest"             , filter: "src"      , values: ["doj"], price: "$0.005", ask: "a DOJ indictment, settlement, or antitrust action" },
  eu:             { route: "/eu/latest"              , filter: "src"      , values: ["ec"], price: "$0.005", ask: "a European Commission decision, fine, or directive" },
  uk:             { route: "/uk/latest"              , filter: "src"      , values: ["govuk"], price: "$0.005", ask: "a UK government announcement from any department" },
  defense:        { route: "/defense/latest"         , filter: "src"      , values: ["dod"], price: "$0.005", ask: "a US Department of Defense operation, contract award, or statement" },
  whitehouse:     { route: "/whitehouse/actions"     , filter: "src"      , values: ["actions"], price: "$0.005", ask: "an executive order, proclamation, or presidential memorandum" },
  energy:         { route: "/energy/latest"          , filter: "src"      , values: ["eia","doe","oil","utilities"], price: "$0.005", ask: "oil, gas, electricity, or renewables news and analysis" },
  supplychain:    { route: "/supplychain/latest"     , filter: "src"      , values: ["freightwaves","scdive"], price: "$0.005", ask: "freight, shipping, ports, carriers, or logistics" },
  launches:       { route: "/launches/latest"        , filter: "src"      , values: ["producthunt","lobsters","devto"], price: "$0.005", ask: "a new product or developer project that just launched" },
  gaming:         { route: "/gaming/latest"          , filter: "src"      , values: ["gamespot","ign"], price: "$0.005", ask: "a video game release, announcement, or studio news" },
  film:           { route: "/film/latest"            , filter: "src"      , values: ["variety","deadline"], price: "$0.005", ask: "a film or TV deal, casting, or box-office story" },
  music:          { route: "/music/latest"           , filter: "src"      , values: ["pitchfork","rollingstone"], price: "$0.005", ask: "a music release, tour, or music-business story" },
  canada:         { route: "/canada/latest"          , filter: "src"      , values: ["canada"], price: "$0.005", ask: "what the Government of Canada just announced: a federal department release, funding decision, or policy statement" },
  wto:            { route: "/wto/latest"             , filter: "src"      , values: ["wto"], price: "$0.005", ask: "a WTO dispute ruling, trade policy review, or tariff and accession decision" },
  relief:         { route: "/relief/latest"          , filter: "src"      , values: ["reliefweb"], price: "$0.005", ask: "a humanitarian crisis, disaster response, displacement, or famine situation report" },
  cenbank:        { route: "/centralbanks/latest"    , filter: "src"      , values: ["boc","ecbblog"], price: "$0.01", ask: "what a central bank other than the Fed just said: Bank of Canada rate decisions, or ECB research on policy and financial stability" },
  oversight:      { route: "/oversight/latest"       , filter: "src"      , values: ["gao","cbo"], price: "$0.01", ask: "a GAO audit or a CBO cost estimate scoring a federal program, bill, or spending decision" },
  cftc:           { route: "/cftc/latest"            , filter: "src"      , values: ["cftc"], price: "$0.01", ask: "a CFTC action on derivatives, commodities, swaps, or market manipulation" },
  labor:          { route: "/labor/latest"           , filter: "src"      , values: ["dol","osha"], price: "$0.005", ask: "a US labor rule, wage decision, OSHA citation, or workplace safety penalty" },
  travel:         { route: "/travel/advisories"      , filter: "src"      , values: ["statedept"], price: "$0.005", ask: "whether it is safe to travel somewhere: a State Department advisory level, warning, or security alert for a country" },
  ukcourt:        { route: "/ukcourt/judgments"      , filter: "src"      , values: ["caselaw"], price: "$0.01", ask: "a UK court judgment from the Supreme Court, Court of Appeal, High Court, or a tribunal" },
  standards:      { route: "/standards/latest"       , filter: "src"      , values: ["ietf","w3c"], price: "$0.005", ask: "an internet or web standards development: IETF working group activity, an RFC, or a W3C specification" },
  secresearch:    { route: "/security/research"      , filter: "src"      , values: ["schneier","tor","mozilla"], price: "$0.005", ask: "security or privacy research and analysis: cryptography, anonymity, censorship circumvention, or browser security" },
  langrel:        { route: "/lang/releases"          , filter: "src"      , values: ["php","postgres","kernel","rust","go"], price: "$0.005", ask: "a new version of a language, database, or the Linux kernel: PHP, PostgreSQL, Rust, Go, or kernel.org" },
  cloudrel:       { route: "/cloud/releases"         , filter: "src"      , values: ["aws","azure","gitlab","chrome"], price: "$0.005", ask: "a cloud or platform product release, feature launch, or deprecation from AWS, Azure, GitLab, or Chrome" },
  research:       { route: "/research/agencies"      , filter: "src"      , values: ["nsf","nist"], price: "$0.005", ask: "an NSF grant or discovery, or a NIST standard, framework, or reference publication" },
  volcano:        { route: "/volcano/latest"         , filter: "src"      , values: ["smithsonian"], price: "$0.005", ask: "volcanic activity: an eruption, ash plume, alert-level change, or unrest at a named volcano" },
  digitalrights:  { route: "/digitalrights/latest"   , filter: "src"      , values: ["eff","ftc"], price: "$0.005", ask: "a digital rights or consumer protection action: EFF litigation on surveillance and platform law, or an FTC consumer case" },
  esa:            { route: "/esa/latest"             , filter: "src"      , values: ["esa"], price: "$0.005", ask: "a European Space Agency mission, launch, Earth-observation result, or science programme decision" },
};
// NOTE: this list is a COPY of the server's lib/wires.js and therefore drifts
// every time a wire is added. It shipped 39 wires while the service ran 57.
// The live list is always at https://thebotwire.com/wires.json — regenerate
// from it before publishing, and prefer list_wires at runtime for the truth.
// Routing table for the tool description. Leads with the trigger condition,
// because that is what a model matches its task against when picking a wire.
const WIRE_MENU = Object.entries(WIRES)
  .map(([k, w]) => `${k} -> ask when the question is about ${w.ask} [${w.price}, ${w.filter}: ${w.values.join("|")}]`)
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
const server = new McpServer({ name: "botwire", version: "0.3.0" });

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
