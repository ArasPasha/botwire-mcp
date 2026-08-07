# botwire-mcp

**[The Bot Wire](https://thebotwire.com) as MCP tools — 301 real-time data wires for AI agents.**

Every model has a knowledge cutoff. Your agent is blind to the present. The Bot Wire
reads primary sources directly, not a crawler's index of them: SEC EDGAR filings, the
Federal Reserve and ECB, BLS and BEA economic releases, federal court opinions,
congressional bills, the White House, DOJ, FDA, CISA advisories, USGS earthquakes, NWS
severe weather, arXiv, NASA and federal contract awards, alongside 300 more wires
across news, markets, technology, industry trade press and culture.

- **$0.005–$0.01 per call** via [x402](https://x402.org) micropayments, USDC on Base
- **No API keys. No signup. No subscription.** The wallet is the account
- 301 wires, 779 source feeds, polled continuously and searched in about a millisecond

## Install

```bash
claude mcp add botwire -- npx -y botwire-mcp
```

For paid results the package needs a funded Base wallet. It signs each HTTP 402 and
retries for you, so your own code never touches payment logic:

```bash
claude mcp add botwire -e BOTWIRE_WALLET_PRIVATE_KEY=0x... -- npx -y botwire-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "botwire": {
      "command": "npx",
      "args": ["-y", "botwire-mcp"],
      "env": { "BOTWIRE_WALLET_PRIVATE_KEY": "0x..." }
    }
  }
}
```

## Tools

| Tool | Cost | What it does |
|---|---|---|
| `list_wires` | free | Every wire with the condition that should trigger it, its filters and its price |
| `botwire_status` | free | Service freshness: item counts, source count, last refresh |
| `search_news` | paid | Ranked search across 40 curated news sources |
| `query_wire` | paid | The latest items from one of 301 specialist wires |

`list_wires` is the one to call first. Each wire advertises the question it answers
("ask when the question is about a vulnerability, CVE or security advisory"), so a
model can route to the right wire without guessing.

## There is no free data tier

The HTTP catalogue is paid. The remote MCP server at `https://thebotwire.com/mcp`
is discovery only: it returns wires, triggers, filters and prices, and no items.
Anything that returns data costs $0.005 to $0.01 per call.

Free and open, with no wallet: [`/health`](https://thebotwire.com/health) for live
counts and last poll time, [`/sources`](https://thebotwire.com/sources) for every
publisher polled, and [`/wires.json`](https://thebotwire.com/wires.json) for the
machine-readable catalogue.

## Direct HTTP, without MCP

```bash
# the full routing table: which wire answers which question
curl https://thebotwire.com/llms-full.txt

# paid call: any x402 client signs the 402 and retries
curl "https://thebotwire.com/cve/latest?q=openssl&since=7d"
```

Machine docs at [`/llms.txt`](https://thebotwire.com/llms.txt), the OpenAPI 3 spec at
[`/openapi.json`](https://thebotwire.com/openapi.json), x402 discovery at
[`/.well-known/x402`](https://thebotwire.com/.well-known/x402).

## What it does not carry

Headlines, snippets, summaries and links only, never full article text. No price
quotes or OHLCV. No deep historical archive: each wire keeps a rolling window, 72
hours by default and up to 30 days on sparse government sources. Search is ranked
keyword, not semantic, so send distinctive terms rather than a natural-language
question.

MIT licensed. Contact: vellenue@gmail.com
