/* The Bot Wire — first-purchase ceremony 🍾
 * Pays the live API $0.005 via x402 from the throwaway buyer wallet,
 * then proves settlement by reading the seller's USDC balance on Base.
 */
const fs = require("fs");
const path = require("path");

// load buyer key from ../.env (git-ignored)
const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const pk = env.match(/BOTWIRE_WALLET_PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];

const SELLER = "0xC14A40252a34F755E41eBaf25D7F3C183d720c20"; // Coinbase (was Exodus 0xDf86...Ea68)
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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
  const buyerBal = await usdcBalance(client, account.address);
  const sellerBefore = await usdcBalance(client, SELLER);
  console.log("buyer USDC:", buyerBal, "| seller USDC before:", sellerBefore);
  if (buyerBal < 0.005) { console.log("!! buyer not funded yet"); process.exit(1); }

  const { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");
  const fetchPay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  });

  console.log("\n>> paying The Bot Wire for real-time news…");
  const t0 = Date.now();
  const res = await fetchPay("https://thebotwire.com/news?q=bitcoin&since=6h&limit=3");
  console.log("HTTP", res.status, "in", Date.now() - t0, "ms");

  const prh = res.headers.get("payment-response") || res.headers.get("PAYMENT-RESPONSE");
  if (prh) {
    try {
      const pr = decodePaymentResponseHeader(prh);
      console.log("payment response:", JSON.stringify(pr));
      if (pr.transaction) console.log("tx: https://basescan.org/tx/" + pr.transaction);
    } catch (e) { console.log("payment-response (raw):", prh.slice(0, 200)); }
  }

  const data = await res.json();
  console.log("\nTHE PURCHASED NEWS:");
  for (const a of data.articles || []) console.log(" -", `[${a.age_minutes}m]`, a.source, "|", a.title.slice(0, 70));

  // settlement can lag a few seconds
  await new Promise(r => setTimeout(r, 8000));
  const sellerAfter = await usdcBalance(client, SELLER);
  console.log("\nseller USDC after:", sellerAfter, "| delta:", +(sellerAfter - sellerBefore).toFixed(6));
})();
