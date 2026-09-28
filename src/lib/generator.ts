import { Category, SUFFIXES, TLDS, WORDS } from "../data/words";

const VOWELS = "aeiouy";
const isV = (c: string) => VOWELS.includes(c);

export type Blend = {
  id: string;
  name: string;
  a: string;
  b: string;
  method: string;
  tld: string;
  score: number;
  categories: Category[];
};

/** index just after the first vowel-group of the word */
function headCut(w: string): number {
  let i = 0;
  while (i < w.length && !isV(w[i])) i++;
  while (i < w.length && isV(w[i])) i++;
  return Math.min(Math.max(i, 2), w.length);
}

/** index where the last vowel-group begins (tail start) */
function tailCut(w: string): number {
  let i = w.length - 1;
  while (i >= 0 && !isV(w[i])) i--;
  while (i >= 0 && isV(w[i])) i--;
  return Math.max(i, 1);
}

function overlapMerge(a: string, b: string): string | null {
  for (let n = Math.min(4, a.length - 1, b.length - 1); n >= 2; n--) {
    if (a.slice(-n) === b.slice(0, n)) return a + b.slice(n);
  }
  // single-letter join if the letter is shared
  if (a.slice(-1) === b.slice(0, 1)) return a + b.slice(1);
  return null;
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

type Method = { key: string; fn: (a: string, b: string) => string | null };

const METHODS: Method[] = [
  { key: "head+tail", fn: (a, b) => a.slice(0, headCut(a)) + b.slice(tailCut(b)) },
  { key: "head+word", fn: (a, b) => a.slice(0, headCut(a)) + b },
  { key: "clip-clip", fn: (a, b) => a.slice(0, headCut(a)) + b.slice(0, headCut(b)) },
  { key: "overlap", fn: (a, b) => overlapMerge(a, b) },
  { key: "word+tail", fn: (a, b) => a + b.slice(tailCut(b) + 1) },
  { key: "swap", fn: (a, b) => b.slice(0, headCut(b)) + a.slice(tailCut(a)) },
  {
    key: "suffixed",
    fn: (a, b) => {
      const stem = a.slice(0, headCut(a)) + b.slice(tailCut(b));
      const s = pick(SUFFIXES);
      const base = isV(stem.slice(-1)) && isV(s[0]) ? stem.slice(0, -1) : stem;
      return base + s;
    },
  },
];

function cleanup(w: string): string {
  return w
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z]/g, "")
    .replace(/([aeiou])\1+/g, "$1");
}

/** 0-100 brandability heuristic */
function scoreName(name: string): number {
  let s = 60;
  const n = name.length;
  if (n >= 5 && n <= 9) s += 18;
  else if (n === 10) s += 8;
  else if (n > 11) s -= (n - 11) * 7;
  else if (n < 5) s -= 12;

  const vowelCount = [...name].filter(isV).length;
  const ratio = vowelCount / n;
  if (ratio >= 0.32 && ratio <= 0.55) s += 12;
  else s -= 10;

  if (/[bcdfghjklmnpqrstvwxz]{3,}/.test(name)) s -= 18;
  if (/^[aeiou]/.test(name)) s += 3;
  if (/(a|o|i|us|ly|io|ia)$/.test(name)) s += 6;
  // alternation bonus
  let alt = 0;
  for (let i = 1; i < n; i++) if (isV(name[i]) !== isV(name[i - 1])) alt++;
  s += Math.round((alt / (n - 1)) * 10);
  return Math.max(12, Math.min(99, Math.round(s)));
}

export type GenOptions = {
  categories: Category[];
  minLen: number;
  maxLen: number;
  count: number;
  seedA?: string;
  seedB?: string;
  tlds: string[];
};

export function generate(opts: GenOptions): Blend[] {
  const pools = opts.categories.length ? opts.categories : (Object.keys(WORDS) as Category[]);
  const catOf = (w: string) => pools.filter((c) => WORDS[c].includes(w));

  const out: Blend[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < opts.count && guard < opts.count * 120) {
    guard++;
    const ca = pick(pools);
    const cb = pick(pools);
    const a = (opts.seedA || pick(WORDS[ca])).toLowerCase().replace(/[^a-z]/g, "");
    const b = (opts.seedB || pick(WORDS[cb])).toLowerCase().replace(/[^a-z]/g, "");
    if (!a || !b || a === b) continue;

    const m = pick(METHODS);
    const raw = m.fn(a, b);
    if (!raw) continue;
    const name = cleanup(raw);
    if (name.length < opts.minLen || name.length > opts.maxLen) continue;
    if (name === a || name === b) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    const tld = opts.tlds.length ? pick(opts.tlds) : pick(TLDS);
    out.push({
      id: name + tld + guard,
      name,
      a,
      b,
      method: m.key,
      tld,
      score: scoreName(name),
      categories: Array.from(new Set([...catOf(a), ...catOf(b)])),
    });
  }
  return out.sort((x, y) => y.score - x.score);
}

export const title = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);