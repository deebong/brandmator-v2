import type { Category, WordEntry } from "../data/types";

const STOP = new Set([
  "a","an","and","are","as","at","be","by","for","from","in","into","is","it","its","of","on","or","our","that",
  "the","this","to","with","we","you","your","their","they","will","can","using","use","build","building","make",
  "making","startup","company","brand","product","service","thing","things","really","very","good","best"
]);

// Terms that describe a business but are too generic to act as strong naming concepts.
const GENERIC = new Set([
  "platform","solutions","solution","technology","technologies","innovative","innovation","smart","next","hub",
  "labs","lab","digital","global","group","systems","system","network","services","service","software","business"
]);

const CATEGORY_TERMS: Record<Category, string[]> = {
  tech: ["software","cloud","saas","app","developer","infrastructure","platform","data","api","server","stack","web","technology","automation"],
  ai: ["ai","artificial","machine","learning","model","agent","agents","inference","reasoning","intelligence","automation","copilot"],
  business: ["business","startup","company","b2b","workflow","operations","growth","enterprise","team","work"],
  finance: ["finance","fintech","payment","payments","bank","banking","money","capital","credit","insurance","wealth","wallet"],
  commerce: ["commerce","ecommerce","retail","shop","shopping","store","marketplace","seller","buy","sell"],
  health: ["health","medical","medicine","clinic","care","wellness","fitness","nutrition","therapy","biotech"],
  creative: ["creative","design","media","music","video","story","creator","content","art","studio","brand"],
  nature: ["forest","forestry","tree","trees","woodland","nature","green","eco","ecology","wildlife","conservation","climate","planet","sustainability"],
  energy: ["energy","solar","battery","power","grid","electric","ev","fuel","renewable","climate"],
  food: ["food","meal","kitchen","restaurant","recipe","nutrition","snack","beverage","drink","grocery","cooking"],
  science: ["science","research","chemistry","physics","biology","laboratory","lab","genomics","space","quantum"],
  mythic: ["myth","legend","hero","oracle","atlas","titan","phoenix","cosmos"],
  abstract: ["abstract","idea","concept","spark","flow","shift","core","edge"]
};

const ALIASES: Record<string, string[]> = {
  automate: ["automation","automated","automating","autonomous"],
  automation: ["automate","automated","automating"],
  finance: ["financial","fintech","money","payments"],
  conservation: ["conserve","preserve","preservation","sustainability"],
  forest: ["forestry","woodland","trees","nature"],
  sustainable: ["sustainability","eco","green","renewable"],
  security: ["secure","cyber","privacy","safety","identity"],
  commerce: ["ecommerce","retail","shopping","marketplace"],
  health: ["healthy","wellness","medical","care"],
  design: ["creative","branding","visual","art"],
  intelligent: ["intelligence","ai","smart","reasoning"],
  workflow: ["workflows","operations","process","automation"],
  robotics: ["robot","robots","robotic","autonomous"],
  realtime: ["real-time","live","instant"]
};

function tokenize(brief: string) {
  return brief
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map(token => token.replace(/^-+|-+$/g, ""))
    .filter(token => token.length >= 3 && !STOP.has(token));
}

function stems(token: string) {
  const variants = new Set<string>([token]);
  if (token.endsWith("ies") && token.length > 4) variants.add(token.slice(0, -3) + "y");
  if (token.endsWith("ing") && token.length > 5) variants.add(token.slice(0, -3));
  if (token.endsWith("ed") && token.length > 4) variants.add(token.slice(0, -2));
  if (token.endsWith("es") && token.length > 4) variants.add(token.slice(0, -2));
  if (token.endsWith("s") && token.length > 4) variants.add(token.slice(0, -1));
  return [...variants];
}

function relatedTokens(token: string) {
  const normalized = stems(token);
  const output = new Set(normalized);
  for (const [key, aliases] of Object.entries(ALIASES)) {
    if (normalized.includes(key) || aliases.some(alias => normalized.includes(alias) || alias.includes(token))) {
      output.add(key);
      aliases.forEach(alias => output.add(alias));
    }
  }
  return [...output];
}

function tokenMatchesWord(token: string, word: string) {
  const tokenVariants = relatedTokens(token);
  return tokenVariants.some(candidate =>
    candidate === word ||
    candidate.includes(word) ||
    word.includes(candidate)
  );
}

export type BriefMatch = { word: string; score: number; matchedBy: string[] };
export type BriefAnalysis = {
  focusTerms: string[];
  matches: BriefMatch[];
  categories: Category[];
  genericTerms: string[];
};

export function analyzeBrief(brief: string, library: WordEntry[]): BriefAnalysis {
  const tokens = tokenize(brief);
  const genericTerms = [...new Set(tokens.filter(token => GENERIC.has(token)))];
  const focusTokens = tokens.filter(token => !GENERIC.has(token));

  const matches: BriefMatch[] = library
    .map(entry => {
      const matchedBy = focusTokens.filter(token => tokenMatchesWord(token, entry.word));
      if (!matchedBy.length) return null;
      const exact = matchedBy.filter(token => relatedTokens(token).includes(entry.word)).length;
      const partial = matchedBy.length - exact;
      const score = Math.min(100, 56 + exact * 22 + Math.min(3, partial) * 8);
      return { word: entry.word, score, matchedBy: [...new Set(matchedBy)].slice(0, 4) };
    })
    .filter((match): match is BriefMatch => Boolean(match))
    .sort((a, b) => b.score - a.score);

  const categories = (Object.keys(CATEGORY_TERMS) as Category[]).filter(category => {
    const terms = CATEGORY_TERMS[category];
    return focusTokens.some(token => terms.some(term => tokenMatchesWord(token, term)));
  });

  const focusTerms = [...new Set(focusTokens)].slice(0, 24);
  return { focusTerms, matches: matches.slice(0, 40), categories, genericTerms };
}

export function extractBriefTerms(brief: string, library: WordEntry[]) {
  return analyzeBrief(brief, library).matches.slice(0, 20).map(match => match.word);
}
