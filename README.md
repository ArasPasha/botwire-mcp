# botwire-mcp

**[The Bot Wire](https://thebotwire.com) as MCP tools — real-time news for AI agents.**

Every model has a knowledge cutoff. Your agent is blind to the present. The Bot Wire
ingests 40 curated sources (CNBC, WSJ, FT, CoinDesk, The Block, Fed, SEC, BBC,
TechCrunch…) every 5 minutes and answers *"what just happened about X?"* in
milliseconds.

- **$0.005 per call** via [x402](https://x402.org) micropayments — USDC on Base
- **No API keys. No signup. No subscription.** The wallet is the account
- Free preview tier included (try before paying)

## Quick start (Claude Code / Claude Desktop)

Add to `~/.claude/settings.json` (Claude Code) or `claude_desktop_config.json`
(Claude Desktop):

```json
{
  "mcpServers": {
    "botwire": {
      "command": "npx",
      "args": ["-y", "botwire-mcp"],
      "env": {
        "BOTWIRE_WALLET_PRIVATE_KEY": "0x<agent-wallet-private-key>"
      }
    }
  }
}
```

Fund the wallet with a few dollars of **USDC on Base mainnet** — $1 ≈ 200 news
queries. No key? The free tools still work.

> ⚠️ Use a dedicated agent wallet with small amounts — never your main wallet's key.

## Tools

| Tool | Cost | What it does |
|---|---|---|
| `search_news` | $0.005 | Ranked real-time news search — `query`, `since` (30m/2h/24h/3d), `category`, `limit` |
| `get_headlines` | $0.005 | Latest headlines by category |
| `preview_news` | free | Top-3 teaser results |
| `botwire_status` | free | Service health & freshness |

Categories: `markets` · `crypto` · `tech` · `world` · `business` · `energy`

## Example

Ask your agent: *"What happened with fed rates in the last 2 hours?"* — it calls
`search_news(query: "fed rates", since: "2h")`, pays half a cent automatically,
and answers from headlines published minutes ago.

## How payment works

The API returns `HTTP 402 Payment Required` with an x402 offer. This package
signs a USDC transfer authorization with your wallet key (locally — the key
never leaves your machine), retries the request, and gets the data. Settlement
happens on Base; typical end-to-end latency ~2s on first paid call.

## Direct API (no MCP)

```bash
curl "https://thebotwire.com/news/preview?q=bitcoin"        # free
curl "https://thebotwire.com/news?q=bitcoin&since=2h"       # 402 → pay via x402
```

MIT © [The Bot Wire](https://thebotwire.com)
