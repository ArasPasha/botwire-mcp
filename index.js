#!/usr/bin/env node
/* botwire-mcp — The Bot Wire (thebotwire.com) as MCP tools for AI agents.
 *
 * 301 real-time data wires your model's training data can't know. Primary
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
  edgar:           { route: "/edgar/filings"            , filter: "form"     , values: ["8-k","10-q","10-k","form-4","s-1","13f","6-k","13d"], price: "$0.01", ask: "a company's SEC filings, insider trades, or a specific form (8-K, 10-K, 10-Q, Form 4, S-1, 13F, 13D)" },
  cve:             { route: "/cve/latest"               , filter: "src"      , values: ["cisa","ubuntu","msrc","debian","zdi"], price: "$0.005", ask: "a vulnerability, CVE, or security advisory affecting a named product or vendor" },
  reg:             { route: "/reg/latest"               , filter: "type"     , values: ["rule","proposed-rule","notice","presidential"], price: "$0.005", ask: "a new US federal rule, proposed rule, notice, or presidential document" },
  weather:         { route: "/weather/alerts"           , filter: "severity" , values: ["extreme","severe","immediate"], price: "$0.005", ask: "an active US severe-weather alert for a place: storm, flood, heat, winter, wind" },
  quake:           { route: "/quake/latest"             , filter: "mag"      , values: ["significant","m4.5","m2.5"], price: "$0.005", ask: "a recent earthquake, its magnitude, depth, or location" },
  arxiv:           { route: "/arxiv/latest"             , filter: "cat"      , values: ["ai","ml","nlp","security"], price: "$0.005", ask: "a new AI, ML, NLP, or security research paper" },
  fed:             { route: "/fed/latest"               , filter: "src"      , values: ["fed","fomc","ecb"], price: "$0.01", ask: "what the Federal Reserve, the FOMC, or the ECB just said about rates or policy" },
  hn:              { route: "/hn/latest"                , filter: "feed"     , values: ["frontpage","show","rising"], price: "$0.005", ask: "what developers are discussing or upvoting right now" },
  status:          { route: "/status/latest"            , filter: "provider" , values: ["aws","github","cloudflare","openai","anthropic","azure","gcp"], price: "$0.005", ask: "whether AWS, GCP, Azure, GitHub, Cloudflare, OpenAI, or Anthropic is currently down" },
  ailab:           { route: "/ailab/latest"             , filter: "lab"      , values: ["openai","deepmind","google","huggingface","aws"], price: "$0.005", ask: "what OpenAI, DeepMind, Google, Hugging Face, or AWS just announced or released" },
  security:        { route: "/security/news"            , filter: "src"      , values: ["bleepingcomputer","krebs","hackernews","arstechnica"], price: "$0.005", ask: "a breach, ransomware incident, or threat-actor campaign being reported" },
  court:           { route: "/court/opinions"           , filter: "type"     , values: ["scotus","ca2","ca9","cafc","govinfo"], price: "$0.01", ask: "a new US federal court opinion or ruling, including the Supreme Court" },
  bills:           { route: "/bills/latest"             , filter: "type"     , values: ["bills","statutes"], price: "$0.01", ask: "a newly introduced congressional bill or a statute compilation" },
  enforcement:     { route: "/enforcement/latest"       , filter: "agency"   , values: ["sec","ftc"], price: "$0.01", ask: "an SEC or FTC enforcement action, fine, or litigation release" },
  recalls:         { route: "/recalls/latest"           , filter: "src"      , values: ["cpsc","fda"], price: "$0.005", ask: "a consumer product recall or an FDA regulatory action" },
  crypto:          { route: "/crypto/latest"            , filter: "src"      , values: ["coindesk","cointelegraph","ethereum"], price: "$0.005", ask: "crypto, blockchain, or protocol-level news" },
  space:           { route: "/space/latest"             , filter: "src"      , values: ["nasa"], price: "$0.005", ask: "a NASA mission, launch, or scientific discovery" },
  sports:          { route: "/sports/latest"            , filter: "src"      , values: ["bbc","espn"], price: "$0.005", ask: "a score, result, fixture, or transfer" },
  jobs:            { route: "/jobs/latest"              , filter: "src"      , values: ["remote","hn"], price: "$0.005", ask: "an open remote engineering, design, or product role" },
  releases:        { route: "/releases/latest"          , filter: "project"  , values: ["node","python","kubernetes","rust","go","react","pytorch","deno","bun"], price: "$0.005", ask: "whether a dependency shipped a new version: Node, CPython, Kubernetes, Rust, Go, React, PyTorch, Deno, Bun" },
  markets:         { route: "/markets/latest"           , filter: "src"      , values: ["yahoo","marketwatch","seekingalpha"], price: "$0.005", ask: "equities, indices, or macro market movement being reported" },
  world:           { route: "/world/latest"             , filter: "src"      , values: ["aljazeera","dw","france24","bbc"], price: "$0.005", ask: "an international story from a non-US news desk" },
  tech:            { route: "/tech/latest"              , filter: "src"      , values: ["techcrunch","verge","ars"], price: "$0.005", ask: "a technology launch, funding round, or platform change" },
  econ:            { route: "/econ/latest"              , filter: "src"      , values: ["bls","bea","rates"], price: "$0.01", ask: "a US economic data release: CPI, jobs, GDP, interest rates" },
  science:         { route: "/science/latest"           , filter: "src"      , values: ["nature","science","physorg"], price: "$0.005", ask: "new peer-reviewed research or science reporting" },
  preprints:       { route: "/preprints/latest"         , filter: "src"      , values: ["biorxiv","medrxiv"], price: "$0.005", ask: "a biology or medicine preprint, before peer review" },
  publichealth:    { route: "/publichealth/latest"      , filter: "src"      , values: ["who","cdc"], price: "$0.005", ask: "a disease outbreak, or WHO/CDC guidance and health advisories" },
  fda:             { route: "/fda/latest"               , filter: "src"      , values: ["fda"], price: "$0.005", ask: "a drug or device approval, clearance, or safety communication" },
  doj:             { route: "/doj/latest"               , filter: "src"      , values: ["doj"], price: "$0.005", ask: "a DOJ indictment, settlement, or antitrust action" },
  eu:              { route: "/eu/latest"                , filter: "src"      , values: ["ec"], price: "$0.005", ask: "a European Commission decision, fine, or directive" },
  uk:              { route: "/uk/latest"                , filter: "src"      , values: ["govuk"], price: "$0.005", ask: "a UK government announcement from any department" },
  defense:         { route: "/defense/latest"           , filter: "src"      , values: ["dod"], price: "$0.005", ask: "a US Department of Defense operation, contract award, or statement" },
  whitehouse:      { route: "/whitehouse/actions"       , filter: "src"      , values: ["actions"], price: "$0.005", ask: "an executive order, proclamation, or presidential memorandum" },
  energy:          { route: "/energy/latest"            , filter: "src"      , values: ["eia","doe","oil","utilities"], price: "$0.005", ask: "oil, gas, electricity, or renewables news and analysis" },
  supplychain:     { route: "/supplychain/latest"       , filter: "src"      , values: ["freightwaves","scdive"], price: "$0.005", ask: "freight, shipping, ports, carriers, or logistics" },
  launches:        { route: "/launches/latest"          , filter: "src"      , values: ["producthunt","lobsters","devto"], price: "$0.005", ask: "a new product or developer project that just launched" },
  gaming:          { route: "/gaming/latest"            , filter: "src"      , values: ["gamespot","ign"], price: "$0.005", ask: "a video game release, announcement, or studio news" },
  film:            { route: "/film/latest"              , filter: "src"      , values: ["variety","deadline","indiewire"], price: "$0.005", ask: "a film or TV deal, casting, or box-office story" },
  music:           { route: "/music/latest"             , filter: "src"      , values: ["pitchfork","rollingstone"], price: "$0.005", ask: "a music release, tour, or music-business story" },
  canada:          { route: "/canada/latest"            , filter: "src"      , values: ["canada"], price: "$0.005", ask: "what the Government of Canada just announced: a federal department release, funding decision, or policy statement" },
  wto:             { route: "/wto/latest"               , filter: "src"      , values: ["wto"], price: "$0.005", ask: "a WTO dispute ruling, trade policy review, or tariff and accession decision" },
  relief:          { route: "/relief/latest"            , filter: "src"      , values: ["reliefweb"], price: "$0.005", ask: "a humanitarian crisis, disaster response, displacement, or famine situation report" },
  cenbank:         { route: "/centralbanks/latest"      , filter: "src"      , values: ["boc","ecbblog"], price: "$0.01", ask: "what a central bank other than the Fed just said: Bank of Canada rate decisions, or ECB research on policy and financial stability" },
  oversight:       { route: "/oversight/latest"         , filter: "src"      , values: ["gao","cbo"], price: "$0.01", ask: "a GAO audit or a CBO cost estimate scoring a federal program, bill, or spending decision" },
  cftc:            { route: "/cftc/latest"              , filter: "src"      , values: ["cftc"], price: "$0.01", ask: "a CFTC action on derivatives, commodities, swaps, or market manipulation" },
  labor:           { route: "/labor/latest"             , filter: "src"      , values: ["dol","osha"], price: "$0.005", ask: "a US labor rule, wage decision, OSHA citation, or workplace safety penalty" },
  travel:          { route: "/travel/advisories"        , filter: "src"      , values: ["statedept"], price: "$0.005", ask: "whether it is safe to travel somewhere: a State Department advisory level, warning, or security alert for a country" },
  ukcourt:         { route: "/ukcourt/judgments"        , filter: "src"      , values: ["caselaw"], price: "$0.01", ask: "a UK court judgment from the Supreme Court, Court of Appeal, High Court, or a tribunal" },
  standards:       { route: "/standards/latest"         , filter: "src"      , values: ["ietf","w3c"], price: "$0.005", ask: "an internet or web standards development: IETF working group activity, an RFC, or a W3C specification" },
  secresearch:     { route: "/security/research"        , filter: "src"      , values: ["schneier","tor","mozilla"], price: "$0.005", ask: "security or privacy research and analysis: cryptography, anonymity, censorship circumvention, or browser security" },
  langrel:         { route: "/lang/releases"            , filter: "src"      , values: ["php","postgres","kernel","rust","go"], price: "$0.005", ask: "a new version of a language, database, or the Linux kernel: PHP, PostgreSQL, Rust, Go, or kernel.org" },
  cloudrel:        { route: "/cloud/releases"           , filter: "src"      , values: ["aws","azure","gitlab","chrome"], price: "$0.005", ask: "a cloud or platform product release, feature launch, or deprecation from AWS, Azure, GitLab, or Chrome" },
  research:        { route: "/research/agencies"        , filter: "src"      , values: ["nsf","nist"], price: "$0.005", ask: "an NSF grant or discovery, or a NIST standard, framework, or reference publication" },
  volcano:         { route: "/volcano/latest"           , filter: "src"      , values: ["smithsonian"], price: "$0.005", ask: "volcanic activity: an eruption, ash plume, alert-level change, or unrest at a named volcano" },
  digitalrights:   { route: "/digitalrights/latest"     , filter: "src"      , values: ["eff","ftc"], price: "$0.005", ask: "a digital rights or consumer protection action: EFF litigation on surveillance and platform law, or an FTC consumer case" },
  esa:             { route: "/esa/latest"               , filter: "src"      , values: ["esa"], price: "$0.005", ask: "a European Space Agency mission, launch, Earth-observation result, or science programme decision" },
  anime:           { route: "/anime/latest"             , filter: "src"      , values: ["ann"], price: "$0.005", ask: "an anime or manga series, licensing deal, studio, or streaming release schedule" },
  comics:          { route: "/comics/latest"            , filter: "src"      , values: ["comicbook","bleedingcool"], price: "$0.005", ask: "a comics publisher, creator, series launch, or a comic being adapted to screen" },
  books:           { route: "/books/latest"             , filter: "src"      , values: ["pw","lithub"], price: "$0.005", ask: "a book deal, publishing acquisition, imprint change, or bestseller movement" },
  podcasts:        { route: "/podcasts/latest"          , filter: "src"      , values: ["podnews"], price: "$0.005", ask: "a podcast launch, network acquisition, or podcast advertising and platform change" },
  fashion:         { route: "/fashion/latest"           , filter: "src"      , values: ["bof","fashionista","hypebeast"], price: "$0.005", ask: "a fashion collection, brand collaboration, creative-director appointment, or retail move" },
  food:            { route: "/food/latest"              , filter: "src"      , values: ["eater","restaurantdive"], price: "$0.005", ask: "a restaurant opening or closure, chain expansion, menu strategy, or food-industry operator news" },
  hospitality:     { route: "/hospitality/latest"       , filter: "src"      , values: ["skift"], price: "$0.005", ask: "airline, hotel or booking-platform strategy, or travel and tourism industry demand" },
  realestate:      { route: "/realestate/latest"        , filter: "src"      , values: ["housingwire"], price: "$0.005", ask: "US housing market moves, mortgage rates, lenders, brokerages, or housing supply and policy" },
  auto:            { route: "/auto/latest"              , filter: "src"      , values: ["caranddriver"], price: "$0.005", ask: "a car model reveal, pricing or spec change, vehicle recall, or automotive review" },
  esports:         { route: "/esports/latest"           , filter: "src"      , values: ["dexerto"], price: "$0.005", ask: "an esports tournament result, roster or org change, prize pool, or competitive game patch" },
  sneakers:        { route: "/sneakers/latest"          , filter: "src"      , values: ["sneakernews","highsnobiety"], price: "$0.005", ask: "a sneaker or streetwear release date, drop, collaboration, restock or colourway" },
  art:             { route: "/art/latest"               , filter: "src"      , values: ["artnews","artnet"], price: "$0.005", ask: "an auction result, gallery or museum acquisition, artist representation, or art-market dispute" },
  wine:            { route: "/wine/latest"              , filter: "src"      , values: ["decanter","wineenthusiast"], price: "$0.005", ask: "a wine or spirits vintage, score, producer, region, or beverage auction pricing" },
  design:          { route: "/design/latest"            , filter: "src"      , values: ["dezeen","archdaily"], price: "$0.005", ask: "an architecture or design project, competition result, studio appointment, or materials development" },
  watches:         { route: "/watches/latest"           , filter: "src"      , values: ["hodinkee","fratello"], price: "$0.005", ask: "a watch release or limited edition, brand development, or watch auction and secondary-market pricing" },
  motorsport:      { route: "/motorsport/latest"        , filter: "src"      , values: ["motorsport","autosport"], price: "$0.005", ask: "a race result, driver or team contract, or technical regulation change in F1, MotoGP, IndyCar, NASCAR or endurance racing" },
  startups:        { route: "/startups/latest"          , filter: "src"      , values: ["crunchbase","eustartups"], price: "$0.01", ask: "a startup funding round with amount and investors, an acquisition or exit, or a new venture fund" },
  aviation:        { route: "/aviation/latest"          , filter: "src"      , values: ["avweb","simpleflying"], price: "$0.005", ask: "an airline fleet or route change, aircraft order or delivery, or an aviation incident or safety directive" },
  chess:           { route: "/chess/latest"             , filter: "src"      , values: ["chesscom"], price: "$0.005", ask: "a chess tournament result, world championship or candidates cycle, or a rating and title change" },
  photography:     { route: "/photography/latest"       , filter: "src"      , values: ["petapixel","dpreview"], price: "$0.005", ask: "a camera or lens announcement with specs and pricing, firmware, or imaging-technology news" },
  wrestling:       { route: "/wrestling/latest"         , filter: "src"      , values: ["wrestlinginc"], price: "$0.005", ask: "Fandom Discord/Telegram bots. Wrestling has one of the most obsessive, always-online, news-velocity-hungry fandoms on the internet" },
  playstation:     { route: "/playstation/latest"       , filter: "src"      , values: ["blog"], price: "$0.005", ask: "Console-specific fandom bots and 'what's free on PS Plus this month' automations" },
  xbox:            { route: "/xbox/latest"              , filter: "src"      , values: ["xbox"], price: "$0.005", ask: "'What's on Game Pass now' is a real recurring consumer query with high bot value" },
  nintendo:        { route: "/nintendo/latest"          , filter: "src"      , values: ["nintendoeveryt"], price: "$0.005", ask: "Nintendo fandom is large, distinct, and heavily community-tooled" },
  jpgames:         { route: "/jpgames/latest"           , filter: "src"      , values: ["gematsu","siliconera"], price: "$0.005", ask: "Import/JRPG fandom , a distinctly separate, very dedicated audience from general gaming news, and one that reads announcements the" },
  vr:              { route: "/vr/latest"                , filter: "src"      , values: ["uploadvr","roadtovr"], price: "$0.005", ask: "Hardware-tracking and early-adopter agents; the VR audience skews toward people who build their own tooling" },
  tabletop:        { route: "/tabletop/latest"          , filter: "src"      , values: ["icv2","boardgamewire"], price: "$0.005", ask: "Game store operators and collector agents. ICv2 is the actual trade-distribution publication for the hobby channel, so it carries" },
  ttrpg:           { route: "/ttrpg/latest"             , filter: "src"      , values: ["enworld","rascal"], price: "$0.005", ask: "D&D fandom bots and campaign-assistant agents (a genuinely popular LLM use case) that want current rules/release news" },
  wargaming:       { route: "/wargaming/latest"         , filter: "src"      , values: ["belloflostsoul","goonhammer"], price: "$0.005", ask: "Warhammer fandom is famously high-spend and obsessive about points/rules updates; list-building tools would consume rules-change n" },
  tcg:             { route: "/tcg/latest"               , filter: "src"      , values: ["mtgazone","ygorganization"], price: "$0.005", ask: "Card-price and singles-trading agents. Ban/errata announcements move real secondary-market prices within minutes, which makes late" },
  sportscards:     { route: "/sportscards/latest"       , filter: "src"      , values: ["cardboardconne"], price: "$0.005", ask: "Collectible-flipping agents tracking release calendars and auction comps" },
  lego:            { route: "/lego/latest"              , filter: "src"      , values: ["brothersbrick","brickfanatics"], price: "$0.005", ask: "Set-retirement and price-tracking agents , retiring LEGO sets are a well-known collectible-appreciation play with an active resale" },
  toys:            { route: "/toys/latest"              , filter: "src"      , values: ["toybook","thetoyinsider","actionfigurein","toybook2"], price: "$0.005", ask: "Collector agents and toy resellers tracking reveal-to-preorder windows" },
  themeparks:      { route: "/themeparks/latest"        , filter: "src"      , values: ["blooloop","attractionsmag","blogmickey","laughingplace"], price: "$0.005", ask: "Travel-planning agents. Disney/Universal trip planning is one of the most automation-heavy consumer travel niches that exists, wit" },
  geekculture:     { route: "/geekculture/latest"       , filter: "src"      , values: ["themarysue","denofgeek","screenrant","collider"], price: "$0.005", ask: "Social-content and fandom bots. This is the highest-volume, fastest-churning entertainment content class on the web" },
  horror:          { route: "/horror/latest"            , filter: "src"      , values: ["bloodydisgusti","dreadcentral","ruemorgue"], price: "$0.005", ask: "Horror has an unusually loyal, year-round, high-engagement fandom and a dedicated trade press , recommendation bots for the genre" },
  startrek:        { route: "/startrek/latest"          , filter: "src"      , values: ["trekmovie"], price: "$0.005", ask: "Single-franchise fandom bots. TrekMovie is the definitive outlet and returns 100 dated items, minutes fresh" },
  fantasytv:       { route: "/fantasytv/latest"         , filter: "src"      , values: ["winteriscoming"], price: "$0.005", ask: "Franchise fandom bots during active seasons; extremely spiky demand tied to airing windows" },
  eurovision:      { route: "/eurovision/latest"        , filter: "src"      , values: ["escxtra"], price: "$0.005", ask: "Betting/prediction agents , Eurovision is one of the most heavily bet non-sport events in Europe, with liquid markets months ahead" },
  animation:       { route: "/animation/latest"         , filter: "src"      , values: ["cartoonbrew","awn"], price: "$0.005", ask: "Industry professionals and recruiters; also the substantial adult animation fandom" },
  vfx:             { route: "/vfx/latest"               , filter: "src"      , values: ["beforesandafte","fxguide","80"], price: "$0.005", ask: "3D artists and studio tooling agents; 80.lv in particular is a firehose for the CG-artist audience that already uses AI tooling he" },
  indiefilm:       { route: "/indiefilm/latest"         , filter: "src"      , values: ["filmmakermagaz","nofilmschool","thefilmstage","rogerebert"], price: "$0.005", ask: "Filmmakers and festival-submission agents; distinct from the trade/box-office axis of your existing film wire" },
  musicindustry:   { route: "/musicindustry/latest"     , filter: "src"      , values: ["musicbusinessw"], price: "$0.005", ask: "Catalog investors and music-rights agents. Catalog acquisition is an active alternative-asset class with real money moving" },
  romancebooks:    { route: "/romancebooks/latest"      , filter: "src"      , values: ["smartbitchestr"], price: "$0.005", ask: "Romance is the single best-selling fiction category and drives BookTok; recommendation agents for it have real consumer pull" },
  crimefiction:    { route: "/crimefiction/latest"      , filter: "src"      , values: ["crimereads"], price: "$0.005", ask: "Reading-recommendation agents; true crime is one of the largest content categories in podcasting and publishing alike" },
  publishing:      { route: "/publishing/latest"        , filter: "src"      , values: ["publishingpers","bookriot"], price: "$0.005", ask: "Agents, rights buyers, and literary-scouting bots" },
  creatoreconomy:  { route: "/creatoreconomy/latest"    , filter: "src"      , values: ["tubefilter","influencermark"], price: "$0.005", ask: "Creator-tooling agents and brand-deal automation. This audience already pays for software and already builds bots , arguably the m" },
  mediaindustry:   { route: "/mediaindustry/latest"     , filter: "src"      , values: ["niemanlab","digiday","thewrap"], price: "$0.005", ask: "Media-monitoring agents and comms teams" },
  radio:           { route: "/radio/latest"             , filter: "src"      , values: ["radioink"], price: "$0.005", ask: "Broadcast professionals and station-group monitoring" },
  comedy:          { route: "/comedy/latest"            , filter: "src"      , values: ["comedycake"], price: "$0.005", ask: "Tour-alert and special-release agents for comedy fandom" },
  documentary:     { route: "/documentary/latest"       , filter: "src"      , values: ["realscreen"], price: "$0.005", ask: "Doc filmmakers and unscripted commissioners; an underserved slice of the film/TV trade" },
  rust:            { route: "/rust/latest"              , filter: "src"      , values: ["thisweekinrust","github"], price: "$0.005", ask: "Coding agents and CI bots that need to know a toolchain/crate release landed before recommending a version bump; devtool vendors (" },
  golang:          { route: "/golang/latest"            , filter: "src"      , values: ["github"], price: "$0.005", ask: "Same buyer class as rust: release-tracking agents, dependency bots, DevRel teams. Low-volume wire , Go core moves on a 6-week cade" },
  python:          { route: "/python/latest"            , filter: "src"      , values: ["blog","realpython","pyfound","github"], price: "$0.005", ask: "AI coding agents resolving Python version/tooling questions; data-platform vendors. Largest developer population of any language w" },
  javascript:      { route: "/javascript/latest"        , filter: "src"      , values: ["nodejs","github"], price: "$0.005", ask: "CI/CD and supply-chain vendors that must react to a Node security release within hours; agent frameworks pinning runtimes" },
  frontend:        { route: "/frontend/latest"          , filter: "src"      , values: ["github","github2","github3","github4"], price: "$0.005", ask: "Agentic code-gen products that must not scaffold against a stale major; agency/dev-shop dashboards" },
  java:            { route: "/java/latest"              , filter: "src"      , values: ["inside","infoq","github"], price: "$0.005", ask: "Enterprise dev-tool vendors and JVM consultancies. Caution: this is the most 'institutional' language wire and institutional buyer" },
  php:             { route: "/php/latest"               , filter: "src"      , values: ["laravelnews","github","github2"], price: "$0.005", ask: "Agency/freelance tooling and hosting companies (Laravel Forge/Cloudways class) that sell to a large, commercially active PHP shop" },
  ruby:            { route: "/ruby/latest"              , filter: "src"      , values: ["github"], price: "$0.005", ask: "Rails consultancies and Ruby-focused hosting/upgrade services" },
  swift:           { route: "/swift/latest"             , filter: "src"      , values: ["github","machinelearnin","9to5mac"], price: "$0.005", ask: "iOS agencies and App Store tooling vendors; 9to5mac adds a consumer-trade layer that matches the film/sneakers pattern that actual" },
  android:         { route: "/android/latest"           , filter: "src"      , values: ["blog","androiddevelop","github"], price: "$0.005", ask: "Mobile agencies, Play Store ASO/tooling vendors, MDM vendors" },
  dotnet:          { route: "/dotnet/latest"            , filter: "src"      , values: ["devblogs"], price: "$0.005", ask: "Microsoft-stack ISVs and enterprise migration consultancies" },
  elixir:          { route: "/elixir/latest"            , filter: "src"      , values: ["github","github2"], price: "$0.005", ask: "Small but famously high-willingness-to-pay BEAM consultancy niche" },
  emerginglangs:   { route: "/emerginglangs/latest"     , filter: "src"      , values: ["github","github2","github3","discourse"], price: "$0.005", ask: "Nobody obvious yet , this is a curiosity/enthusiast wire. Value is bundle breadth, not standalone sales" },
  aws:             { route: "/aws/latest"               , filter: "src"      , values: ["aws","aws2","github"], price: "$0.005", ask: "FinOps and cloud-governance tools; agents answering 'is there a new instance type / did AWS ship X'. Highest raw item volume of an" },
  azure:           { route: "/azure/latest"             , filter: "src"      , values: ["azure","github"], price: "$0.005", ask: "Same FinOps/cloud-governance buyer as aws; MSP tooling" },
  gcp:             { route: "/gcp/latest"               , filter: "src"      , values: ["cloudblog","github"], price: "$0.005", ask: "Cloud-governance tooling; multi-cloud dashboards that want all three hyperscalers" },
  cloudstatus:     { route: "/cloudstatus/latest"       , filter: "src"      , values: ["githubstatus","cloudflarestat","status","status2"], price: "$0.005", ask: "This is the most defensible paid route in my whole set: an autonomous agent that just got a 500 wants to ask 'is this me or is it" },
  paas:            { route: "/paas/latest"              , filter: "src"      , values: ["vercel","supabase","fly","neon"], price: "$0.005", ask: "Indie-hacker tooling, platform-comparison sites, procurement/changelog trackers" },
  kubernetes:      { route: "/kubernetes/latest"        , filter: "src"      , values: ["kubernetes","cncf","github","github2"], price: "$0.005", ask: "Platform-engineering vendors and managed-k8s providers tracking upstream CVE/patch releases" },
  devops:          { route: "/devops/latest"            , filter: "src"      , values: ["hashicorp","github","github2","github3"], price: "$0.005", ask: "IaC linting/policy vendors, MSPs, and drift-detection tools that need release-triggered rule updates" },
  observability:   { route: "/observability/latest"     , filter: "src"      , values: ["grafana","github","github2","github3"], price: "$0.005", ask: "SRE tooling vendors and consultancies; competitive-intel on the o11y vendor war" },
  postgres:        { route: "/postgres/latest"          , filter: "src"      , values: ["planet","github"], price: "$0.005", ask: "Managed-Postgres vendors (Neon/Supabase/Crunchy class), DBA consultancies, and AI-infra teams tracking pgvector" },
  databases:       { route: "/databases/latest"         , filter: "src"      , values: ["github","github2","github3","percona"], price: "$0.005", ask: "Data-infra vendors and analytics consultancies; vector-DB entries pull AI-infra buyers" },
  dataeng:         { route: "/dataeng/latest"           , filter: "src"      , values: ["github","github2","elastic","github3"], price: "$0.005", ask: "Data-platform vendors and analytics engineering shops" },
  threatintel:     { route: "/threatintel/latest"       , filter: "src"      , values: ["blog","unit42","research","sentinelone"], price: "$0.005", ask: "SOC automation vendors and MSSPs; IOC-enrichment agents. Unlike cve, this is vendor-published trade content, not a government fire" },
  infosec:         { route: "/infosec/latest"           , filter: "src"      , values: ["feedburner","securityweek","therecord","helpnetsecurit"], price: "$0.005", ask: "Security-vendor marketing/competitive teams, breach-monitoring products, newsletter operators" },
  appsec:          { route: "/appsec/latest"            , filter: "src"      , values: ["portswigger","blog","tenable"], price: "$0.005", ask: "Pentest firms, bug-bounty platforms, AppSec tooling vendors. Small, high-intensity, high-budget trade audience , the closest secur" },
  llmtools:        { route: "/llmtools/latest"          , filter: "src"      , values: ["github","github2","github3","github4"], price: "$0.005", ask: "The one buyer class demonstrably present on x402 is AI agents themselves; a wire about the tools those agents run on is the most s" },
  aimlresearch:    { route: "/aimlresearch/latest"      , filter: "src"      , values: ["bair","mit","machinelearnin","openai"], price: "$0.005", ask: "AI newsletter operators and competitive-intel teams. CAUTION: likely duplicates an existing AI wire among the 58, and arxiv (2,657" },
  semis:           { route: "/semis/latest"             , filter: "src"      , values: ["semiengineerin","eetimes","electronicswee","spectrum"], price: "$0.005", ask: "Chip-sector analysts, EDA/IP vendor marketing, supply-chain and equipment sales teams , a genuine B2B trade vertical with real ad/" },
  pchardware:      { route: "/pchardware/latest"        , filter: "src"      , values: ["tomshardware","techpowerup","servethehome","arstechnica"], price: "$0.005", ask: "Price-tracking and affiliate/deal bots, retailer merchandising, GPU-availability watchers , the same consumer-enthusiast pattern a" },
  embedded:        { route: "/embedded/latest"          , filter: "src"      , values: ["hackaday","blog","raspberrypi","blog2"], price: "$0.005", ask: "Component distributors and maker-market retailers; hobby-project recommendation agents. Enthusiast vertical, commerce-adjacent" },
  robotics:        { route: "/robotics/latest"          , filter: "src"      , values: ["therobotreport","spectrum","robohub"], price: "$0.005", ask: "Robotics integrators, warehouse-automation vendors, VC deal-flow scanners" },
  quantum:         { route: "/quantum/latest"           , filter: "src"      , values: ["thequantuminsi","insidequantumt","quantumzeitgei","spectrum"], price: "$0.005", ask: "Quantum-sector investors and vendor comms teams; a small market with unusually high per-reader value" },
  selfhosted:      { route: "/selfhosted/latest"        , filter: "src"      , values: ["github"], price: "$0.005", ask: "Home-lab hardware retailers, NAS vendors, and the automation-hobbyist audience , enthusiast vertical with real spend, same shape a" },
  nfl:             { route: "/nfl/latest"               , filter: "src"      , values: ["cbssports","sports","profootballrum","nflspinzone"], price: "$0.005", ask: "Betting and DFS agents building NFL slates; the ProFootballRumors feed is the transaction wire (signings, cuts, IR designations) t" },
  nba:             { route: "/nba/latest"               , filter: "src"      , values: ["cbssports","sports","hoopsrumors","hoopshabit"], price: "$0.005", ask: "Player-prop and DFS agents. NBA props are the most volatile market in US betting and hinge on same-day rotation/rest news" },
  mlb:             { route: "/mlb/latest"               , filter: "src"      , values: ["cbssports","sports","mlbtraderumors","mlb"], price: "$0.005", ask: "Baseball betting agents (162-game season = highest bet count of any US sport) and fantasy tools tracking daily roster churn" },
  transactions:    { route: "/transactions/latest"      , filter: "src"      , values: ["profootballrum","hoopsrumors","mlbtraderumors"], price: "$0.005", ask: "Any agent that needs one poll instead of four to catch roster changes across all US majors; also sports-media and sportsbook risk" },
  injuries:        { route: "/injuries/latest"          , filter: "src"      , values: ["rotoballer","pff"], price: "$0.005", ask: "Betting agents pricing player props and sportsbook risk desks watching for late scratches" },
  bettingindustry: { route: "/bettingindustry/latest"   , filter: "src"      , values: ["igamingbusines"], price: "$0.005", ask: "Operators, affiliates and compliance teams tracking market-access changes; also agents deciding which jurisdictions a product can" },
  fantasy:         { route: "/fantasy/latest"           , filter: "src"      , values: ["rotoballer","sports","thefantasyfoot","pff"], price: "$0.005", ask: "Fantasy-assistant agents and DFS lineup optimizers, which are one of the few agent categories with an obvious paying end-user" },
  cricket:         { route: "/cricket/latest"           , filter: "src"      , values: ["espncricinfo","bbci","theguardian","crictracker"], price: "$0.005", ask: "Cricket betting agents (cricket is the second-largest global betting market by handle) and South Asia-focused content tools" },
  rugby:           { route: "/rugby/latest"             , filter: "src"      , values: ["bbci","theguardian","planetrugby","ruck"], price: "$0.005", ask: "UK/Ireland/SA/ANZ betting agents and rugby-media aggregators" },
  rugbyleague:     { route: "/rugbyleague/latest"       , filter: "src"      , values: ["bbci","zerotackle"], price: "$0.005", ask: "Australian betting agents , NRL is a top-three betting code in Australia" },
  tennis:          { route: "/tennis/latest"            , filter: "src"      , values: ["bbci","theguardian","sports","tennismajors"], price: "$0.005", ask: "Tennis betting agents. Tennis has near-continuous year-round matches and withdrawal/retirement news is directly tradeable" },
  golf:            { route: "/golf/latest"              , filter: "src"      , values: ["sports","golfmonthly","golfwrx","golf"], price: "$0.005", ask: "Outright-market betting agents (golf outrights are a large prop market) and golf equipment/retail content tools" },
  boxing:          { route: "/boxing/latest"            , filter: "src"      , values: ["boxingscene","boxingnews24","badlefthook","sports"], price: "$0.005", ask: "Combat-sports betting agents and fight-card aggregators" },
  mma:             { route: "/mma/latest"               , filter: "src"      , values: ["mmafighting","mmamania","sherdog","sports"], price: "$0.005", ask: "MMA betting agents , fight-card changes and missed weight are hard, priceable events with a short reaction window" },
  horseracing:     { route: "/horseracing/latest"       , filter: "src"      , values: ["sports","theguardian","thoroughbredda","bbci"], price: "$0.005", ask: "Racing betting agents and bloodstock/sales researchers. Racing is the oldest and most data-hungry betting market" },
  cycling:         { route: "/cycling/latest"           , filter: "src"      , values: ["cyclingnews","cyclingweekly","velo","escapecollecti"], price: "$0.005", ask: "Cycling-media aggregators and endurance-gear retail content agents; rider-transfer news has a small but real betting market" },
  running:         { route: "/running/latest"           , filter: "src"      , values: ["athleticsweekl","letsrun","runnersworld","bbci"], price: "$0.005", ask: "Running-gear and race-registration content agents; large consumer audience, negligible betting angle" },
  motogp:          { route: "/motogp/latest"            , filter: "src"      , values: ["motorsport"], price: "$0.005", ask: "Motorsport betting agents and motorcycle-media aggregators" },
  nascar:          { route: "/nascar/latest"            , filter: "src"      , values: ["motorsport","sports"], price: "$0.005", ask: "US motorsport betting agents; NASCAR has a distinct US audience your F1/motorsport wires likely miss" },
  endurance:       { route: "/endurance/latest"         , filter: "src"      , values: ["motorsport","motorsport2","therace"], price: "$0.005", ask: "Motorsport-media aggregators covering the non-F1, non-NASCAR calendar (Le Mans, Indy 500)" },
  olympics:        { route: "/olympics/latest"          , filter: "src"      , values: ["bbci","theguardian"], price: "$0.005", ask: "Games-cycle media and sponsorship researchers" },
  wnba:            { route: "/wnba/latest"              , filter: "src"      , values: ["sports","cbssports","swishappeal","equalizersocce"], price: "$0.005", ask: "Content agents serving the fastest-growing US sports audience; betting interest in WNBA props has grown sharply" },
  eurobasket:      { route: "/eurobasket/latest"        , filter: "src"      , values: ["eurohoops"], price: "$0.005", ask: "European basketball betting agents; EuroLeague is a heavily bet market with far less English-language coverage than the NBA" },
  prowrestling:    { route: "/prowrestling/latest"      , filter: "src"      , values: ["wrestlinginc"], price: "$0.005", ask: "Entertainment/content agents. Wrestling is scripted, so betting utility is near zero , this is pure fandom content" },
  afl:             { route: "/afl/latest"               , filter: "src"      , values: ["zerohanger"], price: "$0.005", ask: "Australian betting agents , AFL is the largest betting code in Australia" },
  cfl:             { route: "/cfl/latest"               , filter: "src"      , values: ["3downnation","sportsnet"], price: "$0.005", ask: "Canadian betting agents (Ontario is a large regulated market) and Canadian sports-media tools" },
  sailing:         { route: "/sailing/latest"           , filter: "src"      , values: ["sailworld","sailingscuttle"], price: "$0.005", ask: "Marine-industry and high-net-worth lifestyle content agents; adjacent to your wine/watches audience" },
  wintersport:     { route: "/wintersport/latest"       , filter: "src"      , values: ["skiracing"], price: "$0.005", ask: "Winter-sport media and ski-resort/gear retail content agents" },
  outdoorsport:    { route: "/outdoorsport/latest"      , filter: "src"      , values: ["surfer","gripped","triathlete"], price: "$0.005", ask: "Outdoor and endurance gear retail content agents; overlaps the consumer-retail pattern of your sneakers/fashion wires" },
  sportsindia:     { route: "/sportsindia/latest"       , filter: "src"      , values: ["crictracker","sports"], price: "$0.005", ask: "Content agents serving the largest English-language sports audience outside the US; fantasy-cricket apps are a huge Indian market" },
  sportsgeneral:   { route: "/sportsgeneral/latest"     , filter: "src"      , values: ["foxsports","defector","skynews"], price: "$0.005", ask: "Agents that want one sports poll rather than 20; likely the default entry point for anyone browsing the catalogue" },
  gamesindustry:   { route: "/gamesindustry/latest"     , filter: "src"      , values: ["80"], price: "$0.005", ask: "Game-studio business-development agents, games-focused VC scouts, and consumer gaming apps and Discord bots" },
  brewing:         { route: "/brewing/latest"           , filter: "src"      , values: ["brewbound","brewersjournal"], price: "$0.005", ask: "Beverage brands and distributors, on-premise buyers, and drinks-recommendation consumer agents" },
  beautytrade:     { route: "/beautytrade/latest"       , filter: "src"      , values: ["cosmeticsbusin","globalcosmetic"], price: "$0.005", ask: "Beauty brands and contract manufacturers, retail buyers, and consumer beauty-recommendation agents" },
  furniture:       { route: "/furniture/latest"         , filter: "src"      , values: ["homenewsnow","bedtimesmagazi","casualnewsnow"], price: "$0.005", ask: "Furniture retailers and importers, home-goods marketplace agents, and interior-design tools" },
  homeimprovement: { route: "/homeimprovement/latest"   , filter: "src"      , values: ["hardwareretail","kbbonline"], price: "$0.005", ask: "Building-products manufacturers, hardware co-ops, and home-renovation planning agents" },
  supplements:     { route: "/supplements/latest"       , filter: "src"      , values: ["newhope","naturalproduct"], price: "$0.005", ask: "Supplement brands and ingredient suppliers, DTC health brands, and consumer wellness agents" },
  seafood:         { route: "/seafood/latest"           , filter: "src"      , values: ["fishfocus","thefishingdail"], price: "$0.005", ask: "Seafood importers and processors, aquaculture investors, and restaurant/retail sourcing agents" },
  casino:          { route: "/casino/latest"            , filter: "src"      , values: ["igamingbusines","cdcgamingrepor"], price: "$0.005", ask: "Operators and affiliates, gaming-compliance tools, and betting-adjacent consumer agents" },
  cannabis:        { route: "/cannabis/latest"          , filter: "src"      , values: ["mjbizdaily","marijuanamomen"], price: "$0.005", ask: "Multi-state operators, cannabis-compliance software, and dispensary-facing consumer agents" },
  events:          { route: "/events/latest"            , filter: "src"      , values: ["tsnn","conferencenews","exhibitionworl"], price: "$0.005", ask: "Event-tech vendors, venue and destination sales teams, and conference-discovery agents" },
  franchise:       { route: "/franchise/latest"         , filter: "src"      , values: ["franchisewire","franchisechatt"], price: "$0.005", ask: "Franchise development teams, franchise brokers, and small-business acquisition agents" },
  pharma:          { route: "/pharma/latest"            , filter: "src"      , values: ["pharmexec","pharmatimes"], price: "$0.005", ask: "Pharma competitive-intelligence teams, biotech BD agents, and healthcare-investor research bots" },
  semiconductors:  { route: "/semiconductors/latest"    , filter: "src"      , values: ["semiengineerin","eetimes","electronicswee"], price: "$0.005", ask: "Semiconductor equipment and EDA vendors, hardware startups, and chip-supply monitoring agents" },
  hpc:             { route: "/hpc/latest"               , filter: "src"      , values: ["nextplatform"], price: "$0.005", ask: "AI-infrastructure buyers, silicon and systems vendors, and infrastructure-research agents" },
  adtech:          { route: "/adtech/latest"            , filter: "src"      , values: ["digiday"], price: "$0.005", ask: "Adtech vendors, agency strategy teams, and marketing-automation agents" },
  cybersecurity:   { route: "/cybersecurity/latest"     , filter: "src"      , values: ["feedburner","securityweek","darkreading","therecord"], price: "$0.005", ask: "Security vendors, SOC automation tools, and threat-intel agents that poll for new disclosures" },
  tv:              { route: "/tv/latest"                , filter: "src"      , values: ["tvline","tvinsider","tvfanatic"], price: "$0.005", ask: "The closest structural sibling to 'film', the only wire that ever converted. Same buyer profile: agents building entertainment-rec" },
  boxoffice:       { route: "/boxoffice/latest"         , filter: "src"      , values: ["deadline","variety"], price: "$0.005", ask: "Trading/prediction-market agents (box office is a settled-outcome market on Polymarket/Kalshi), plus finance bots covering studio" },
  awards:          { route: "/awards/latest"            , filter: "src"      , values: ["goldderby","awardsdaily","awardswatch","goldenglobes"], price: "$0.005", ask: "Prediction-market and betting agents , awards races are heavily traded on Polymarket. Gold Derby is literally an odds-aggregation" },
  streaming:       { route: "/streaming/latest"         , filter: "src"      , values: ["whatsonnetflix"], price: "$0.005", ask: "'What's new on Netflix this week' is one of the highest-volume consumer questions on the internet and a staple of recommendation b" },
  theatre:         { route: "/theatre/latest"           , filter: "src"      , values: ["playbill","broadwaynews","americantheatr","newyorktheater"], price: "$0.005", ask: "Ticketing/resale agents and NYC concierge bots that need closing-notice and casting news before it hits general press" },
  celebrity:       { route: "/celebrity/latest"         , filter: "src"      , values: ["tmz","pagesix","perezhilton"], price: "$0.005", ask: "Social-content generation agents , celebrity news is the highest-velocity fuel for automated short-form/social posting, which is w" },
  kpop:            { route: "/kpop/latest"              , filter: "src"      , values: ["soompi","koreaboo"], price: "$0.005", ask: "Fandom bots. K-pop fandoms are the most organized, most bot-tooled, most globally distributed fan communities online, and they alr" },
  kdrama:          { route: "/kdrama/latest"            , filter: "src"      , values: ["dramabeans","soompi"], price: "$0.005", ask: "Same fandom-bot buyer as k-pop but a separate content axis; recommendation agents for the global K-drama audience on Netflix/Viki" },
  pcgaming:        { route: "/pcgaming/latest"          , filter: "src"      , values: ["pcgamer","rockpapershotg","pcgamesn"], price: "$0.005", ask: "Gaming Discord bots and deal-tracking agents. PC gamers are the most technically literate consumer audience, hence most likely to" },
  gamingnews:      { route: "/gamingnews/latest"        , filter: "src"      , values: ["ign","polygon","eurogamer","videogameschro"], price: "$0.005", ask: "The broadest entertainment-agent buyer: any bot that answers 'what's happening in games'. Five majors in one deduped, ranked strea" },
  gameindustry:    { route: "/gameindustry/latest"      , filter: "src"      , values: ["gamesindustry","gamedeveloper","pocketgamer"], price: "$0.005", ask: "Recruiters, VC/deal-sourcing agents, and market-intel bots tracking the games sector" },
  metal:           { route: "/metal/latest"             , filter: "src"      , values: ["metalinjection","blabbermouth","loudwire"], price: "$0.005", ask: "Genre fandom bots and tour-alert automations. Metal fandom is famously completist and news-hungry" },
  hiphop:          { route: "/hiphop/latest"            , filter: "src"      , values: ["thesource","hiphopwired","soulbounce"], price: "$0.005", ask: "Social-content agents , hip-hop news is among the highest-engagement social content in existence" },
  country:         { route: "/country/latest"           , filter: "src"      , values: ["tasteofcountry","savingcountrym","musicrow"], price: "$0.005", ask: "Genre fandom plus Nashville industry , MusicRow is the actual Nashville trade publication, so this wire spans fan and trade in one" },
  electronic:      { route: "/electronic/latest"        , filter: "src"      , values: ["dancingastrona"], price: "$0.005", ask: "Festival and event-discovery agents; the dance audience is young and app-native" },
  indiemusic:      { route: "/indiemusic/latest"        , filter: "src"      , values: ["stereogum","brooklynvegan","thequietus"], price: "$0.005", ask: "Music-discovery agents and playlist-generation bots that need release news, not just catalog metadata" },
  musicnews:       { route: "/musicnews/latest"         , filter: "src"      , values: ["rollingstone","nme","spin","consequence"], price: "$0.005", ask: "Broadest music-agent buyer; the general-purpose counterpart to the genre wires" },
  livemusic:       { route: "/livemusic/latest"         , filter: "src"      , values: ["relix","liveforlivemus","iqmag"], price: "$0.005", ask: "Ticket-resale and tour-alert agents. Onsale timing has direct, immediate financial value in the resale market , the strongest late" },
  classical:       { route: "/classical/latest"         , filter: "src"      , values: ["slippedisc","operawire"], price: "$0.005", ask: "Affluent, older audience with strong institutional attachment; arts-organization monitoring agents" },
  dance:           { route: "/dance/latest"             , filter: "src"      , values: ["dancemagazine","pointemagazine"], price: "$0.005", ask: "Dance schools, audition-tracking agents, and arts administrators" },
  bollywood:       { route: "/bollywood/latest"         , filter: "src"      , values: ["bollywoodhunga","pinkvilla"], price: "$0.005", ask: "The largest film-audience market on earth by ticket volume, and near-zero English-language agent data coverage. Buyer is any globa" },
  japanculture:    { route: "/japanculture/latest"      , filter: "src"      , values: ["soranews24","animehunch","animeuknews"], price: "$0.005", ask: "Complements your live anime wire on the culture/lifestyle axis rather than the anime-release axis; social-content bots love SoraNe" },
  scifilit:        { route: "/scifilit/latest"          , filter: "src"      , values: ["reactormag","locusmag"], price: "$0.005", ask: "SFF fandom is disproportionately technical and disproportionately likely to be running its own agents. Locus is the genre's trade" },
  musicgear:       { route: "/musicgear/latest"         , filter: "src"      , values: ["musicradar"], price: "$0.005", ask: "Gear-deal agents and producer tooling; overlaps the same buyer profile as your live watches/sneakers collector wires" },
  netops:          { route: "/netops/latest"            , filter: "src"      , values: ["lightreading","networkworld","spectrum","blog"], price: "$0.005", ask: "Telecom equipment vendors, carrier strategy teams, network-automation tooling" },
  linux:           { route: "/linux/latest"             , filter: "src"      , values: ["phoronix","lwn","distrowatch","omgubuntu"], price: "$0.005", ask: "Distro vendors, hardware-enablement teams, and a famously large enthusiast readership" },
  browsers:        { route: "/browsers/latest"          , filter: "src"      , values: ["webkit","blogs","blog"], price: "$0.005", ask: "Web-compat and testing vendors (BrowserStack class), extension developers, ad-tech tracking rendering changes" },
  devtools:        { route: "/devtools/latest"          , filter: "src"      , values: ["github","github2","github3","code"], price: "$0.005", ask: "Extension/plugin developers, DevEx teams, and agent products that must track platform API changes (GitHub changelog especially)" },
  gamedev:         { route: "/gamedev/latest"           , filter: "src"      , values: ["unity","unrealengine","gamefromscratc","gamedeveloper"], price: "$0.005", ask: "Asset-store and middleware vendors, studio tooling, and game-trade analysts , a passionate commercial vertical, the single closest" },
  crossplatform:   { route: "/crossplatform/latest"     , filter: "src"      , values: ["github","github2","github3","github4"], price: "$0.005", ask: "App-shop tooling, desktop-distribution vendors (code signing, auto-update), Wasm edge platforms" },
  engleaders:      { route: "/engleaders/latest"        , filter: "src"      , values: ["newsletter","blog","leaddev","stackoverflow"], price: "$0.005", ask: "Dev-tool marketing teams, recruiters, and B2B content operations tracking what engineering managers are reading" },
  bigtecheng:      { route: "/bigtecheng/latest"        , filter: "src"      , values: ["netflixtechblo","engineering","blog","dropbox"], price: "$0.005", ask: "Technical content teams, interview-prep products, architecture-research agents. Low urgency, so low willingness to pay per call" },
  devnews:         { route: "/devnews/latest"           , filter: "src"      , values: ["ycombinator","simonwillison","theregister"], price: "$0.005", ask: "Trend-detection agents and newsletter automations wanting one call for 'what are developers talking about right now'" },
  wordpress:       { route: "/wordpress/latest"         , filter: "src"      , values: ["wordpress","github","github2"], price: "$0.005", ask: "Plugin/theme vendors, managed-WP hosts and agencies , a large commercial ecosystem where a release breaking a plugin costs real mo" },
  testing:         { route: "/testing/latest"           , filter: "src"      , values: ["github","github2","github3"], price: "$0.005", ask: "QA-tooling vendors and CI providers. Thin , consider folding into devtools rather than shipping standalone" },
  nhl:             { route: "/nhl/latest"               , filter: "src"      , values: ["sports","prohockeyrumor","thehockeynews","dailyfaceoff"], price: "$0.005", ask: "NHL betting agents. Starting-goalie confirmation is the single highest-value pre-game signal in hockey betting, and DailyFaceoff i" },
  transfers:       { route: "/transfers/latest"         , filter: "src"      , values: ["sportwitness","caughtoffside","footballitalia","footballespana"], price: "$0.005", ask: "Football betting agents pricing outrights and specials, plus fantasy-football (FPL) tools and football-media aggregators" },
  soccer:          { route: "/soccer/latest"            , filter: "src"      , values: ["bbci","theguardian","marca","givemesport"], price: "$0.005", ask: "General sports-content agents and football betting tools needing broad coverage as a baseline layer under the transfers wire" },
  cfb:             { route: "/cfb/latest"               , filter: "src"      , values: ["cbssports","sports","saturdaydownso","on3"], price: "$0.005", ask: "College betting agents (CFB spreads are the softest major US market) and recruiting/NIL trackers. On3 is the NIL-valuation outlet" },
  cbb:             { route: "/cbb/latest"               , filter: "src"      , values: ["cbssports","sports","bustingbracket"], price: "$0.005", ask: "March Madness bracket tools and college betting agents; the seasonal spike is enormous and narrow" },
  bettingodds:     { route: "/bettingodds/latest"       , filter: "src"      , values: ["vsin","bettingpros","sportsgambling"], price: "$0.005", ask: "Betting agents and bot builders who want a text feed of line-move rationale to pair with a numeric odds API they buy elsewhere" },
  bettingus:       { route: "/bettingus/latest"         , filter: "src"      , values: ["sbcamericas","vsin","insidersport"], price: "$0.005", ask: "US-focused affiliates and agents that need to know which states are live before serving odds content into them" },
  sportsbiz:       { route: "/sportsbiz/latest"         , filter: "src"      , values: ["sportico","frontofficespo","insidersport"], price: "$0.005", ask: "Sports-industry analysts, agency researchers and finance agents tracking club valuations and sponsorship deals" },
  sportsmedia:     { route: "/sportsmedia/latest"       , filter: "src"      , values: ["awfulannouncin","frontofficespo"], price: "$0.005", ask: "Media-rights researchers and streaming-strategy teams; distinct from sportsbiz in that it is rights-and-carriage specific" },
  tvstreaming:     { route: "/tvstreaming/latest"       , filter: "src"      , values: ["broadbandtvnew","cynopsis","tvtechnology","advancedtelevi"], price: "$0.005", ask: "The same buyer profile that already paid for 'film' , media-tracking agents, streaming-recommendation bots, and entertainment-indu" },
  restauranttrade: { route: "/restauranttrade/latest"   , filter: "src"      , values: ["qsrmagazine","nrn","foodservicedir"], price: "$0.005", ask: "Restaurant-tech vendors (POS, delivery, kitchen automation), foodservice distributors, and franchise-investment scouting agents" },
  retail:          { route: "/retail/latest"            , filter: "src"      , values: ["retaildive","modernretail","retailgazette"], price: "$0.005", ask: "Retail-tech and retail-media vendors, brand-side competitive-intel agents, and commercial-real-estate leasing tools tracking store" },
  ecommerce:       { route: "/ecommerce/latest"         , filter: "src"      , values: ["digitalcommerc","practicalecomm","ecommercenews"], price: "$0.005", ask: "Ecommerce SaaS vendors, agency-side research agents, and the very large population of agent builders working on shopping and merch" },
  grocery:         { route: "/grocery/latest"           , filter: "src"      , values: ["grocerydive","fooddive","supermarketnew"], price: "$0.005", ask: "CPG brand teams tracking retailer moves, grocery-tech vendors, and price/assortment monitoring agents" },
  convenience:     { route: "/convenience/latest"       , filter: "src"      , values: ["conveniencesto","betterretailin"], price: "$0.005", ask: "C-store suppliers and distributors, fuel-retail analytics vendors, and franchise/site-selection agents" },
  autodealers:     { route: "/autodealers/latest"       , filter: "src"      , values: ["automotivedive","autoremarketin","cbtnews"], price: "$0.005", ask: "Dealer-software vendors, wholesale/auction pricing agents, and used-car marketplace bots" },
  traveltrade:     { route: "/traveltrade/latest"       , filter: "src"      , values: ["eturbonews","travelandtourw"], price: "$0.005", ask: "Travel-tech vendors, OTA competitive-intel agents, and trip-planning assistants that want industry context" },
  coffee:          { route: "/coffee/latest"            , filter: "src"      , values: ["dailycoffeenew","perfectdailygr","sprudge","worldcoffeepor"], price: "$0.005", ask: "Coffee importers and roasters, cafe-chain operators, and consumer coffee apps/communities" },
  biotech:         { route: "/biotech/latest"           , filter: "src"      , values: ["labiotech","biopharmadive","genengnews","drugdiscoveryt"], price: "$0.005", ask: "Biotech BD and licensing agents, life-science tool vendors, and venture scouting bots" },
  medtech:         { route: "/medtech/latest"           , filter: "src"      , values: ["medtechdive","medicaldesigna"], price: "$0.005", ask: "Device manufacturers' regulatory and competitive-intel teams, and medtech supplier sales agents" },
  healthcare:      { route: "/healthcare/latest"        , filter: "src"      , values: ["statnews","healthcaredive","medpagetoday"], price: "$0.005", ask: "Health-system strategy teams, payer analytics vendors, and clinician-facing consumer agents" },
  seniorcare:      { route: "/seniorcare/latest"        , filter: "src"      , values: ["skillednursing","homehealthcare","hospicenews","bhbusiness"], price: "$0.005", ask: "Post-acute operators and their vendors, senior-housing investors, and care-placement agents" },
  medicalimaging:  { route: "/medicalimaging/latest"    , filter: "src"      , values: ["radiologybusin","itnonline"], price: "$0.005", ask: "Imaging-equipment and imaging-AI vendors, radiology practice groups" },
  dental:          { route: "/dental/latest"            , filter: "src"      , values: ["dentistrytoday","dentistry"], price: "$0.005", ask: "Dental product manufacturers, DSO acquisition teams, and practice-management software vendors" },
  veterinary:      { route: "/veterinary/latest"        , filter: "src"      , values: ["veterinaryprac","vetpracticemag"], price: "$0.005", ask: "Animal-health pharma, veterinary practice roll-up investors, and pet-owner consumer agents" },
  insurance:       { route: "/insurance/latest"         , filter: "src"      , values: ["insurancejourn","insurancebusin","claimsjournal","carriermanagem"], price: "$0.005", ask: "Insurtech vendors, broker-side competitive intel, cat-bond and ILS investors, and claims-automation agents" },
  mortgage:        { route: "/mortgage/latest"          , filter: "src"      , values: ["mortgagenewsda","themortgagepoi"], price: "$0.005", ask: "Mortgage-tech vendors, loan officers, and rate-tracking consumer agents" },
  banking:         { route: "/banking/latest"           , filter: "src"      , values: ["bankingdive","americanbanker"], price: "$0.005", ask: "Core-banking and compliance vendors, bank strategy teams" },
  payments:        { route: "/payments/latest"          , filter: "src"      , values: ["pymnts","paymentsdive"], price: "$0.005", ask: "Payment processors and PSPs, fintech product teams, and x402-adjacent builders themselves" },
  fintech:         { route: "/fintech/latest"           , filter: "src"      , values: ["finovate","tearsheet"], price: "$0.005", ask: "Fintech product and BD teams, VC scouting agents" },
  accounting:      { route: "/accounting/latest"        , filter: "src"      , values: ["cfodive","accountancyage"], price: "$0.005", ask: "Accounting-software vendors, practice-management tools, and CFO-facing SaaS" },
  legaltrade:      { route: "/legaltrade/latest"        , filter: "src"      , values: ["abovethelaw","artificiallawy","legaltechnolog"], price: "$0.005", ask: "Legal-tech vendors, law-firm competitive intel, and legal-AI startups (a fast-growing agent-building population)" },
  hr:              { route: "/hr/latest"                , filter: "src"      , values: ["hrdive","hrexecutive","joshbersin","personneltoday"], price: "$0.005", ask: "HR-tech vendors, benefits brokers, and employer-compliance agents" },
  recruiting:      { route: "/recruiting/latest"        , filter: "src"      , values: ["onrec","hcamag"], price: "$0.005", ask: "ATS and sourcing-tool vendors, staffing agencies, and recruiting-automation agents" },
  freight:         { route: "/freight/latest"           , filter: "src"      , values: ["ttnews","truckingdive"], price: "$0.005", ask: "Freight brokers and 3PLs, transport-management software, and rate-monitoring agents" },
  maritime:        { route: "/maritime/latest"          , filter: "src"      , values: ["gcaptain","splash247","maritimeexecut","offshoreenergy"], price: "$0.005", ask: "Shipowners and charterers, marine insurers, and commodity/logistics monitoring agents" },
  rail:            { route: "/rail/latest"              , filter: "src"      , values: ["railfreight","railtech"], price: "$0.005", ask: "Rail suppliers and rolling-stock manufacturers, intermodal shippers, and rail enthusiasts (a consumer hobby audience)" },
  aircargo:        { route: "/aircargo/latest"          , filter: "src"      , values: ["aircargonews","aircargoweek"], price: "$0.005", ask: "Freight forwarders, airline cargo teams, and logistics-pricing agents" },
  warehousing:     { route: "/warehousing/latest"       , filter: "src"      , values: ["supplychain247","modernmaterial"], price: "$0.005", ask: "Warehouse-automation vendors, 3PLs, and industrial-real-estate agents" },
  distribution:    { route: "/distribution/latest"      , filter: "src"      , values: ["mdm","globaltrademag"], price: "$0.005", ask: "Industrial distributors, manufacturers' channel teams, and trade-compliance agents" },
  manufacturing:   { route: "/manufacturing/latest"     , filter: "src"      , values: ["manufacturingd","plantengineeri"], price: "$0.005", ask: "Industrial automation vendors, plant engineering teams, and reshoring/site-selection agents" },
  machining:       { route: "/machining/latest"         , filter: "src"      , values: ["mmsonline","productionmach"], price: "$0.005", ask: "Machine-tool builders, tooling suppliers, and job-shop quoting agents" },
  additive:        { route: "/additive/latest"          , filter: "src"      , values: ["3dprintingindu","3dprint","voxelmatters","tctmagazine"], price: "$0.005", ask: "Additive OEMs and materials suppliers, service bureaus, and maker-adjacent consumer agents" },
  construction:    { route: "/construction/latest"      , filter: "src"      , values: ["constructiondi","contractormag"], price: "$0.005", ask: "Construction-tech vendors, GCs and subs tracking bid opportunities, and materials suppliers" },
  architecture:    { route: "/architecture/latest"      , filter: "src"      , values: ["archpaper","architectsjour"], price: "$0.005", ask: "Building-product manufacturers marketing to specifiers, architecture practices, and design-inspiration consumer agents" },
  commercialrealesta: { route: "/commercialrealesta/latest", filter: "src"      , values: ["commercialobse","bisnow"], price: "$0.005", ask: "CRE brokers and investors, proptech vendors, and lease-comparable research agents" },
  hvac:            { route: "/hvac/latest"              , filter: "src"      , values: ["contractingbus","hpac"], price: "$0.005", ask: "HVAC manufacturers and distributors, contractor-software vendors, and home-services lead agents" },
  electrical:      { route: "/electrical/latest"        , filter: "src"      , values: ["ecmweb","tedmag","electricalcont"], price: "$0.005", ask: "Electrical equipment manufacturers and distributors, contractor-facing software, and EV-infrastructure agents" },
  roofing:         { route: "/roofing/latest"           , filter: "src"      , values: ["rooferscoffees","roofingmagazin","constructionsp"], price: "$0.005", ask: "Roofing manufacturers and distributors, restoration contractors, and insurance-claim adjacent agents" },
  mining:          { route: "/mining/latest"            , filter: "src"      , values: ["northernminer","immining"], price: "$0.005", ask: "Mining equipment suppliers, junior-miner investors, and critical-minerals sourcing agents" },
  agriculture:     { route: "/agriculture/latest"       , filter: "src"      , values: ["brownfieldagne","farmanddairy","agriland"], price: "$0.005", ask: "Ag input suppliers, equipment dealers, and farm-management software" },
  agtech:          { route: "/agtech/latest"            , filter: "src"      , values: ["agfundernews","futurefarming"], price: "$0.005", ask: "Agtech startups and their investors, equipment OEMs, and ag-VC scouting agents" },
  chemicals:       { route: "/chemicals/latest"         , filter: "src"      , values: ["chemengonline","thechemicaleng"], price: "$0.005", ask: "Chemical producers' procurement and strategy teams, engineering contractors, and equipment vendors" },
  plastics:        { route: "/plastics/latest"          , filter: "src"      , values: ["plasticstoday","plasticsengine"], price: "$0.005", ask: "Resin buyers and processors, packaging brands tracking recycled-content rules, and machinery suppliers" },
  packaging:       { route: "/packaging/latest"         , filter: "src"      , values: ["packagingdive","packagingnews"], price: "$0.005", ask: "Packaging converters and brand owners, machinery OEMs, and EPR-compliance agents" },
  textiles:        { route: "/textiles/latest"          , filter: "src"      , values: ["textileworld","innovationinte"], price: "$0.005", ask: "Apparel brands' sourcing teams, mills and converters, and supply-chain compliance agents" },
  aerospacemfg:    { route: "/aerospacemfg/latest"      , filter: "src"      , values: ["compositesworl","aerospacetesti","aviationtoday","aerotime"], price: "$0.005", ask: "Aerospace tier-1 and tier-2 suppliers, materials vendors, and defense-industrial analysts" },
  datacenter:      { route: "/datacenter/latest"        , filter: "src"      , values: ["datacenterdyna","datacenterknow","blocksandfiles"], price: "$0.005", ask: "Data-center developers and their suppliers, power/cooling vendors, and AI-infrastructure investors" },
  telecom:         { route: "/telecom/latest"           , filter: "src"      , values: ["mobileworldliv","rcrwireless"], price: "$0.005", ask: "Network equipment vendors, operator strategy teams, and connectivity-analytics agents" },
  cx:              { route: "/cx/latest"                , filter: "src"      , values: ["cxtoday","nojitter","callcentrehelp"], price: "$0.005", ask: "CCaaS and conversational-AI vendors , a sector actively building agents right now" },
  utilities:       { route: "/utilities/latest"         , filter: "src"      , values: ["powermag","tdworld"], price: "$0.005", ask: "Grid equipment vendors, IPPs and developers, and energy-market research agents" },
  solar:           { route: "/solar/latest"             , filter: "src"      , values: ["pvmagazine","solarpowerworl","pvtech","energystorage"], price: "$0.005", ask: "Solar developers and EPCs, module and battery suppliers, and residential-solar lead-gen agents" },
  nuclear:         { route: "/nuclear/latest"           , filter: "src"      , values: ["worldnuclearne","powermag"], price: "$0.005", ask: "Nuclear developers and suppliers, utility planners, and datacenter/AI-power sourcing agents" },
  hydrogen:        { route: "/hydrogen/latest"          , filter: "src"      , values: ["fuelcellsworks"], price: "$0.005", ask: "Hydrogen developers and electrolyzer OEMs, industrial offtakers, and cleantech investors" },
  climatetech:     { route: "/climatetech/latest"       , filter: "src"      , values: ["canarymedia","cleantechnica","carbonherald"], price: "$0.005", ask: "Climate-tech startups and investors, corporate sustainability teams, and carbon-market agents" },
  oilgas:          { route: "/oilgas/latest"            , filter: "src"      , values: ["offshoreenergy"], price: "$0.005", ask: "Oilfield service companies, energy traders, and commodity-monitoring agents" },
  waste:           { route: "/waste/latest"             , filter: "src"      , values: ["wastedive","waste360","wasteadvantage"], price: "$0.005", ask: "Waste haulers and equipment vendors, packaging brands facing EPR rules, and municipal procurement agents" },
  water:           { route: "/water/latest"             , filter: "src"      , values: ["circleofblue","h2oglobalnews","watermagazine"], price: "$0.005", ask: "Water treatment vendors, utility engineering firms, and ESG/water-risk agents" },
  forestry:        { route: "/forestry/latest"          , filter: "src"      , values: ["woodworkingnet","forestryjourna","timberbiz"], price: "$0.005", ask: "Sawmills and wood-products manufacturers, homebuilders tracking lumber, and woodworking hobbyist agents" },
  printing:        { route: "/printing/latest"          , filter: "src"      , values: ["piworld"], price: "$0.005", ask: "Press and consumables manufacturers, print-service providers, and print-procurement agents" },
  signage:         { route: "/signage/latest"           , filter: "src"      , values: ["signsofthetime","digitalsignage"], price: "$0.005", ask: "Sign manufacturers and DOOH network operators, retail-media vendors" },
  promoproducts:   { route: "/promoproducts/latest"     , filter: "src"      , values: ["asicentral","impressionsmag"], price: "$0.005", ask: "Promo-product distributors and suppliers, corporate-swag platforms, and merch-sourcing agents" },
  searchmarketing: { route: "/searchmarketing/latest"   , filter: "src"      , values: ["searchenginela","searchenginejo","martech","seroundtable"], price: "$0.005", ask: "SEO tool vendors, agencies, and the large population of SEO-automation agent builders" },
  edtech:          { route: "/edtech/latest"            , filter: "src"      , values: ["k12dive","highereddive","edsurge","insidehighered"], price: "$0.005", ask: "Edtech vendors selling into districts and universities, and education-policy research agents" },
  nonprofit:       { route: "/nonprofit/latest"         , filter: "src"      , values: ["nonprofitquart","thenonprofitti","philanthropy"], price: "$0.005", ask: "Fundraising software vendors, grant-writing agents (a common agent use case), and foundation research tools" },
  contracts:       { route: "/contracts/latest"         , filter: "size"     , values: ["small-business","under-250k","250k-1m","1m-10m","over-10m"], price: "$0.01", ask: "who just won a US federal contract, for how much, from which agency, or which small businesses are winning work in a state or sector" },
};
// NOTE: this list is a COPY of the server's lib/wires.js and therefore drifts
// every time a wire is added. It shipped 39 wires while the service ran 57.
// The live list is always at https://thebotwire.com/wires.json — regenerate
// from it before publishing, and prefer list_wires at runtime for the truth.
// Routing table for the tool description. Leads with the trigger condition,
// because that is what a model matches its task against when picking a wire.
// Keys only. A trigger line per wire made the tool description tens of
// thousands of characters at 301 wires, sent on every session before the client
// asks anything. list_wires carries the full routing table on demand instead.
const WIRE_MENU = Object.keys(WIRES).join(", ");

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
