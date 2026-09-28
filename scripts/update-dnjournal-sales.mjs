import fs from "node:fs/promises";

const PAGES = [
  ["2026-ytd", "https://dnjournal.com/ytd-sales-charts.htm"],
  ["2025", "https://dnjournal.com/archive/domainsales/2025/2025-top-100-sales-charts.htm"],
  ["2024", "https://dnjournal.com/archive/domainsales/2024/2024-top-100-sales-charts.htm"],
  ["2023", "https://dnjournal.com/archive/domainsales/2023/2023-top-100-sales-charts.htm"],
  ["2022", "https://dnjournal.com/archive/domainsales/2022/2022-top-100-sales-charts.htm"],
  ["2021", "https://dnjournal.com/archive/domainsales/2021/2021-top-100-sales-charts.htm"]
];

const STOP = new Set([
  "the","and","for","with","from","this","that","was","were","has","had","sale","sales",
  "domain","domains","com","net","org","www","http","https","sold","site","online",
  "home","your","my","new","all","top","www","llc","inc","llp","group","brand","brands",
  "company","companies"
]);

const VENDORS = new Set([
  "dnjournal","sedo","godaddy","afternic","namecheap","dynadot","atom","spaceship",
  "domainbooth","saw","dropcatch","namepros","domainmarket","uniregistry","namesilo",
  "dan","efty","brandbucket","above","legalbrandmarketing","getyourdomain",
  "domainagents","domainlore","namestudio","domainnames","namejet","perfectname",
  "medioptions","mediaoptions","snagged","defining","fruits","gritbrokerage"
]);

const AI = new Set(["ai","agent","agentic","agents","artificial","bot","copilot","intelligence","inference","model","synthetic","vision","reasoning","genie","assistant","nft","metaverse","chat","prompt","llm"]);
const TECH = new Set(["api","app","cloud","code","data","digital","domain","deploy","edge","engine","forge","gateway","graph","infrastructure","io","logic","mesh","network","node","platform","proxy","runtime","search","serverless","stack","stream","sync","tech","token","vector","web","wire","cursor","database","robotics","compute"]);
const FINANCE = new Set(["bank","capital","cash","coin","credit","crypto","currency","dollars","finance","fund","gold","invest","ledger","lend","loan","market","mint","money","mortgage","pay","pays","portfolio","profile","profit","risk","trade","trading","wallet","wealth","yield"]);
const COMMERCE = new Set(["buy","buyer","cart","casino","commerce","consumer","deal","dealer","dollars","ecommerce","eshop","exchange","fanbase","golf","listing","market","marketplace","pack","retail","sales","shop","store"]);
const HEALTH = new Set(["care","derm","health","healing","longevity","medical","mental","patient","remedy","surgery","vital","well","wellness"]);
const NATURE = new Set(["aqua","amber","balaena","cinder","climb","coast","coral","earth","fireside","forest","green","grove","harbor","lake","leaf","lotus","meadow","mountain","ocean","rain","rainstorm","river","root","sand","shore","solar","storm","surface","tree","twig","wave","weather","wind","world"]);
const ENERGY = new Set(["bolt","charge","electric","energy","ignite","power","rush","speed","spark","surge","thunder","volt"]);
const FOOD = new Set(["bean","bite","food","grocery","honey","kitchen","meal","plate","plateful","restaurant","spice","sugar"]);
const CREATIVE = new Set(["aesthetic","angel","avatar","buzz","canvas","color","design","divinity","gallery","genie","icon","joy","magic","meme","motion","music","paperboy","prism","script","story","studio","symphony","tattoo","thoughtful","tone","viral","wisdom"]);
const SCIENCE = new Set(["atom","benchmark","cell","climate","compound","concentration","detector","evolution","fragment","genome","graph","industry","molecule","nexus","orbit","probe","quant","quantum","reasoning","science","statistic","synthetic","terafab","theory","vector"]);

function categoriesFor(word) {
  const categories = new Set();
  const w = word.toLowerCase();
  if (AI.has(w)) categories.add("ai");
  if (TECH.has(w)) categories.add("tech");
  if (FINANCE.has(w)) categories.add("finance");
  if (COMMERCE.has(w)) categories.add("commerce");
  if (HEALTH.has(w)) categories.add("health");
  if (NATURE.has(w)) categories.add("nature");
  if (ENERGY.has(w)) categories.add("energy");
  if (FOOD.has(w)) categories.add("food");
  if (CREATIVE.has(w)) categories.add("creative");
  if (SCIENCE.has(w)) categories.add("science");
  if (!categories.size) categories.add("business");
  return [...categories];
}

function decode(html) {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractDomains(html) {
  const prepared = decode(html)
    .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<br\\s*\\/?\s*>/gi, "\n")
    .replace(/<\\/tr>/gi, "\n")
    .replace(/<\\/td>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const rows = prepared
    .split(/\\n+/)
    .map(row => row.replace(/\\s+/g, " ").trim())
    .filter(Boolean);

  const found = new Set();

  for (const row of rows) {
    const matches = row.match(/\\b[A-Za-z0-9][A-Za-z0-9-]{0,62}(?:\\.[A-Za-z0-9-]{1,63})+\\b/g) || [];
    for (const raw of matches) {
      const value = raw.replace(/^[.]+|[.,;:]+$/g, "");
      const lower = value.toLowerCase();
      const root = lower.split(".")[0];

      if (!value.includes(".") || VENDORS.has(root) || STOP.has(root)) continue;
      if (!/^[a-z0-9-]+(?:\\.[a-z0-9-]+)+$/.test(lower)) continue;

      // Only accept compact domain-like names; reject obvious URLs and source references.
      if (lower.includes("www.") || lower.includes("dnjournal.")) continue;
      if (root.length < 2 || root.length > 36) continue;

      found.add(value);
      break; // first domain-looking token in a sales row is normally the sold domain
    }
  }

  return [...found];
}

function splitRoot(root) {
  const camel = root.replace(/([a-z])([A-Z])/g, "$1 $2");
  return camel
    .replace(/[^A-Za-z]+/g, " ")
    .trim()
    .split(/\\s+/)
    .map(v => v.toLowerCase())
    .filter(Boolean);
}

async function fetchPage(label, url) {
  try {
    const response = await fetch(url, { headers: { "user-agent": "Brandmator-DNJournal-Library/1.0" } });
    if (!response.ok) throw new Error(String(response.status));
    const html = await response.text();
    return { label, domains: extractDomains(html), error: null };
  } catch (error) {
    return { label, domains: [], error: String(error) };
  }
}

const results = await Promise.all(PAGES.map(([label, url]) => fetchPage(label, url)));

const domainRoots = new Map();
for (const result of results) {
  for (const domain of result.domains) {
    const root = domain.split(".")[0];
    const tokens = splitRoot(root);
    const values = [root.toLowerCase(), ...tokens];

    for (const raw of values) {
      const word = raw.replace(/[^a-z]/g, "").toLowerCase();
      if (!word || STOP.has(word)) continue;
      if (word.length < 3 && !["ai","ml","ev","nft","api"].includes(word)) continue;
      domainRoots.set(word, (domainRoots.get(word) || 0) + 1);
    }
  }
}

const lines = [...domainRoots.entries()]
  .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([word]) => `["${word}",${JSON.stringify(categoriesFor(word))}]`);

const output = `import type { WordSeed } from "../types";\n\n// Auto-refreshed from DNJournal annual/YTD reported-sale charts.\nexport const DNJOURNAL_LIVE_WORDS: WordSeed[] = [\n${lines.join(",\n")}\n];\n`;

await fs.writeFile("src/data/word-pools/dnjournal-live.ts", output, "utf8");

console.log(JSON.stringify({
  pages: results.map(item => ({ label: item.label, domains: item.domains.length, error: item.error })),
  uniqueWords: domainRoots.size
}, null, 2));
