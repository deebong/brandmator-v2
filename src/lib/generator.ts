import type { Category, WordEntry, WordSource } from "../data/types";
import { WORD_LIBRARY, TLDS } from "../data/word-pools";
import { creativeWordVariants, fusePair, type FusionVariant } from "./fusion";
import { passesNameQuality } from "./quality";
import { scoreName } from "./scoring";

export type Blend = {
  id: string;
  name: string;
  a: string;
  b: string;
  method: string;
  tld: string;
  score: number;
  categories: Category[];
  sourcesA: WordSource[];
  sourcesB: WordSource[];
};

export type GenOptions = {
  categories: Category[];
  sources: WordSource[];
  minLen: number;
  maxLen: number;
  count: number;
  seedA?: string;
  seedB?: string;
  tlds: string[];
};

const pickWeighted = <T extends { weight: number }>(items: T[]) => {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
};

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function library(opts: GenOptions) {
  const sources = new Set(opts.sources);
  const categories = new Set(opts.categories);
  return WORD_LIBRARY.filter(
    entry =>
      entry.sources.some(source => sources.has(source)) &&
      (!categories.size || entry.categories.some(category => categories.has(category)))
  );
}

function customEntry(word: string, selected: WordEntry[]): WordEntry {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  return (
    selected.find(entry => entry.word === normalized) || {
      word: normalized,
      categories: ["abstract"],
      sources: [],
      weight: 0.75
    }
  );
}

function pairVariants(a: WordEntry, b: WordEntry): FusionVariant[] {
  const forward = fusePair(a.word, b.word);
  const reverse = fusePair(b.word, a.word).map(v => ({
    ...v,
    method: "reverse-" + v.method
  }));
  const direct: FusionVariant[] = [...creativeWordVariants(a), ...creativeWordVariants(b)];
  const seen = new Set<string>();
  return [...forward, ...reverse, ...direct].filter(variant => {
    if (seen.has(variant.name)) return false;
    seen.add(variant.name);
    return true;
  });
}

function familyKey(name: string): string {
  const value = name.toLowerCase();
  const suffixes = ["ify", "ora", "ly", "io", "eo", "ia", "ix", "um", "ra", "z", "x", "r", "y"];
  for (const suffix of suffixes) {
    if (value.length > suffix.length + 3 && value.endsWith(suffix)) {
      return value.slice(0, -suffix.length);
    }
  }
  return value.slice(0, Math.min(5, value.length));
}

function diversify(candidates: Blend[], count: number): Blend[] {
  const ordered = [...candidates].sort((a, b) => b.score - a.score);
  const familyCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  const chosen: Blend[] = [];

  for (const candidate of ordered) {
    if (chosen.length >= count) break;

    const family = familyKey(candidate.name);
    const pair = candidate.a + "|" + candidate.b;
    const familyCount = familyCounts.get(family) || 0;
    const pairCount = pairCounts.get(pair) || 0;

    if (familyCount >= 4 || pairCount >= 4) continue;

    familyCounts.set(family, familyCount + 1);
    pairCounts.set(pair, pairCount + 1);
    chosen.push(candidate);
  }

  if (chosen.length < count) {
    const chosenNames = new Set(chosen.map(item => item.name));
    for (const candidate of ordered) {
      if (chosen.length >= count) break;
      if (chosenNames.has(candidate.name)) continue;
      chosenNames.add(candidate.name);
      chosen.push(candidate);
    }
  }

  return chosen.slice(0, count);
}

export function generate(opts: GenOptions): Blend[] {
  const count = Math.max(6, Math.min(120, opts.count));
  const minLen = Math.min(opts.minLen, opts.maxLen);
  const maxLen = Math.max(opts.minLen, opts.maxLen);
  const lib = library(opts);
  const aLock = opts.seedA?.trim() ? customEntry(opts.seedA, lib) : null;
  const bLock = opts.seedB?.trim() ? customEntry(opts.seedB, lib) : null;

  if (!lib.length && !aLock && !bLock) return [];

  const pool: Blend[] = [];
  const seen = new Set<string>();
  const targetPool = Math.max(360, count * 6);
  const maxAttempts = Math.max(9000, count * 180);

  for (let attempt = 0; attempt < maxAttempts && pool.length < targetPool; attempt += 1) {
    const a = aLock || pickWeighted(lib);
    const b = bLock || pickWeighted(lib);
    if (!a || !b || a.word === b.word) continue;

    for (const variant of pairVariants(a, b)) {
      const name = variant.name.toLowerCase();
      if (name.length < minLen || name.length > maxLen) continue;
      if (!passesNameQuality(name) || seen.has(name)) continue;

      const scored = scoreName(name, a, b, variant.method);
      if (scored.total < 63) continue;

      const tld = (opts.tlds.length ? pick(opts.tlds) : pick(TLDS)) || ".com";
      seen.add(name);
      pool.push({
        id: name + "-" + variant.method + "-" + attempt,
        name,
        a: a.word,
        b: b.word,
        method: variant.method,
        tld,
        score: scored.total,
        categories: [...new Set([...a.categories, ...b.categories])],
        sourcesA: a.sources,
        sourcesB: b.sources
      });

      if (pool.length >= targetPool) break;
    }
  }

  return diversify(pool, count);
}

export const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
