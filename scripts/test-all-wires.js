/* The Bot Wire — pay all wires from the test buyer wallet and show the goods.
 * edgar $0.01 + cve $0.005 + reg $0.005 = $0.02 total.
 */
const fs = require("fs");
const path = require("path");

const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const pk = env.match(/BOTWIRE_WALLET_PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];

const SELLER = "0xC14A40252a34F755E41eBaf25D7F3C183d720c20"; // Coinbase (was Exodus 0xDf86...Ea68)
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const CALLS = [
  { name: "EDGAR $0.01", url: "https://thebotwire.com/edgar/filings?form=8-k&limit=3" },
  { name: "CVE   $0.005", url: "https://thebotwire.com/cve/latest?limit=3" },
  { name: "REG   $0.005", url: "https://thebotwire.com/reg/latest?type=rule&limit=3" },
];

async function usdcBalance(client, addr) {
  const bal = await client.readContract({
    address: USDC,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view",
            inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] }],
    functionName: "balanceOf",
    args: [addr],
  });
  return Number(bal) / 1e6;
}

(async () => {
  const { privateKeyToAccount } = require("viem/accounts");
  const { createPublicClient, http } = require("viem");
  const { base } = require("viem/chains");
  const account = privateKeyToAccount(pk);
  const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });

  console.log("buyer:", account.address);
  const buyerBefore = await usdcBalance(client, account.address);
  const sellerBefore = await usdcBalance(client, SELLER);
  console.log("buyer USDC:", buyerBefore, "| seller USDC before:", sellerBefore);

  const { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");
  const fetchPay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  });

  for (const c of CALLS) {
    console.log("\n══ " + c.name + " ══ " + c.url);
    const t0 = Date.now();
    let res;
    try {
      res = await fetchPay(c.url);
    } catch (e) {
      console.log("!! payment failed:", String(e.message || e).slice(0, 200));
      continue;
    }
    console.log("HTTP", res.status, "in", Date.now() - t0, "ms");
    const prh = res.headers.get("payment-response") || res.headers.get("PAYMENT-RESPONSE");
    if (prh) {
      try {
        const pr = decodePaymentResponseHeader(prh);
        if (pr.transaction) console.log("tx: https://basescan.org/tx/" + pr.transaction);
      } catch { console.log("payment-response (raw):", prh.slice(0, 120)); }
    }
    const data = await res.json();
    for (const a of data.articles || [])
      console.log(" -", `[${a.age_minutes}m]`, a.source, "|", a.title.slice(0, 78));
    if (!(data.articles || []).length) console.log(" (no articles in response)", JSON.stringify(data).slice(0, 200));
  }

  await new Promise(r => setTimeout(r, 8000));
  const buyerAfter = await usdcBalance(client, account.address);
  const sellerAfter = await usdcBalance(client, SELLER);
  console.log("\nbuyer:", buyerBefore, "→", buyerAfter, "| spent:", +(buyerBefore - buyerAfter).toFixed(6));
  console.log("seller:", sellerBefore, "→", sellerAfter, "| received:", +(sellerAfter - sellerBefore).toFixed(6));
})();
