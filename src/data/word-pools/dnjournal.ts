import type { WordSeed, Category } from "../types";

const AI = new Set(["ai","agent","agentic","agents","artificial","bot","copilot","intelligence","inference","model","synthetic","vision","reasoning","genie","assistant","nft","metaverse","chat","prompt"]);
const TECH = new Set(["api","app","cloud","code","data","digital","domain","deploy","edge","engine","forge","gateway","graph","infrastructure","io","logic","mesh","network","node","platform","proxy","runtime","search","serverless","stack","stream","sync","tech","token","vector","web","wire","cursor","database","robotics"]);
const FINANCE = new Set(["bank","capital","cash","coin","credit","crypto","currency","dollars","finance","fund","gold","invest","ledger","lend","loan","market","mint","money","mortgage","pay","pays","portfolio","profile","profit","risk","trade","trading","wallet","wealth","yield"]);
const COMMERCE = new Set(["buy","buyer","cart","casino","commerce","consumer","deal","dealer","dollars","ecommerce","eshop","exchange","fanbase","golf","listing","market","marketplace","pack","retail","sales","shop","store"]);
const HEALTH = new Set(["care","derm","health","healing","longevity","medical","mental","patient","remedy","surgery","vital","well","wellness"]);
const NATURE = new Set(["aqua","amber","balaena","bolt","cinder","climb","coast","coral","earth","fireside","forest","green","grove","harbor","lake","leaf","lotus","meadow","mountain","ocean","rain","rainstorm","river","root","sand","shore","solar","storm","surface","tree","twig","wave","weather","wind","world"]);
const ENERGY = new Set(["bolt","charge","climb","electric","energy","everydayelectric","ignite","power","rush","solar","speed","spark","surge","thunder","volt"]);
const FOOD = new Set(["bean","bite","food","grocery","honey","kitchen","meal","plate","plateful","restaurant","spice","sugar"]);
const CREATIVE = new Set(["aesthetic","angel","avatar","buzz","canvas","color","design","divinity","gallery","genie","icon","joy","magic","meme","motion","music","paperboy","prism","script","story","studio","symphony","tattoo","thoughtful","tone","viral","wisdom"]);
const SCIENCE = new Set(["atom","benchmark","cell","climate","compound","concentration","detector","evolution","fragment","genome","graph","industry","molecule","nexus","orbit","probe","quant","quantum","reasoning","science","statistic","synthetic","terafab","theory","vector"]);

function categoriesFor(word: string): Category[] {
  const w = word.toLowerCase();
  const categories = new Set<Category>();
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

/*
 * Immediate seed terms distilled from DNJournal annual/YTD reported-sale charts.
 * A scheduled scraper in scripts/update-dnjournal-sales.mjs refreshes the live file
 * from the 2026 YTD page plus the 2021-2025 annual charts.
 */
const TERMS = `
ai club green nas bot midnight highlevel derm twig txt bar pub evan genesis lotus goka amos free neo kbf privatellm agon superapp crude symphony thunder terafab fluorish speed ngbet mindmesh agenticintelligence honeypot on fragment durable corgi amber rupees surface certify hazlo since syncore confidential magnus kmau skills thundr mainstreet aqua choice dealer climb enclave evo synthetic expressai ninja artificial celeste mila buzz kiven everydayelectric primitive execute salesperson balaena janet kai skiressort world ploy adaptive eve naive totalrx remedy deploy liberate una paperboy coscientist longevity improving fireside
icon commerce fuse anything sword skins slash double spend divinity wisdom nolimit arch cloud pack dollars fanbase rush super crypto tools breeze seed sim serp ace smartchoice leo intelligence beside haggle weather crossfire bind demand fintiv mini weaverobotics bitz
rocket gold peace cursor babyandbeyond pose cancel trill galatea girlfriend sound fluid motion mindsprint paragon profile photobooth crew invent travel green odyssey halo convergence textfree advice
chat help max top-hotels tactic roofs vegetarian yourride txt plans skywin solarenergy hot7 nuum schematic swiper throne accelerator coa statistic anxiety nevis study genie viral aim nomos precise normal matched biti millionaires vital clockwork aiwriter
nfts connect it myhome teamo chill gaming auto drive sports mountain stuff bling raven seal electra assistant proton bull wrap capital profile bolt
av hippo christmas floor yolo marketing forge angel exodus near ebike selfmade recursion public gobet tattoo poker livewire zerocarbon lender wolf able blade snappy overview worldclass steam arbitrage pays portugal velvet yachts exclusive arizona monero weshare important canadian laced followup mint triple let https listings smartwallet bookstore metaverse unchained dealmaker link fume scottish thoughtful chronic cluster skates mules eshop nutun cows clearstreet
`.trim().split(/\\s+/).map(word => word.replace(/[^a-z]/gi,"").toLowerCase()).filter(word => word.length >= 2);

export const DNJOURNAL_WORDS: WordSeed[] = [...new Set(TERMS)].map(word => [word, categoriesFor(word)] as WordSeed);
