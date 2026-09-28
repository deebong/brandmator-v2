import type { Category, WordEntry, WordSource } from "../data/types";
import { WORD_LIBRARY, TLDS } from "../data/word-pools";
import { generateModelCandidates, blendModelCandidates, modelMeta, type CandidateFamily, type ModelId } from "./models";
import { passesNameQuality } from "./quality";
import { scoreName } from "./scoring";

export type Blend = {
  id: string;
  name: string;
  a: string;
  b: string;
  method: string;
  modelId: ModelId;
  modelName: string;
  family: CandidateFamily;
  tld: string;
  score: number;
  categories: Category[];
  sourcesA: WordSource[];
  sourcesB: WordSource[];
};

export type GenOptions = {
  modelId: ModelId;
  categories: Category[];
  sources: WordSource[];
  minLen: number;
  maxLen: number;
  count: number;
  seedA?: string;
  seedB?: string;
  prefix?: string;
  suffix?: string;
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
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

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
  const normalized = normalize(word);
  return (
    selected.find(entry => entry.word === normalized) || {
      word: normalized,
      categories: ["abstract"],
      sources: [],
      weight: 0.75
    }
  );
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

function applyUserModifiers(
  candidates: Array<{ name: string; method: string; modelId: ModelId; family: CandidateFamily }>,
  prefix: string,
  suffix: string
) {
  const p = normalize(prefix);
  const s = normalize(suffix);
  if (!p && !s) return candidates;

  const output = [...candidates];
  const seen = new Set(candidates.map(item => item.name));

  for (const candidate of candidates.slice(0, Math.min(40, candidates.length))) {
    const alreadyPrefixed = !p || candidate.name.startsWith(p);
    const alreadySuffixed = !s || candidate.name.endsWith(s);
    const name = (alreadyPrefixed ? "" : p) + candidate.name + (alreadySuffixed ? "" : s);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    output.push({
      ...candidate,
      name,
      method: "user-modified(" + candidate.method + ")"
    });
  }

  return output;
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
  const targetPool = Math.max(300, count * 5);
  const maxAttempts = Math.max(7000, count * 160);
  const modelIds: ModelId[] = opts.modelId === "m0" ? ["m1", "m2", "m3", "m4", "m5"] : [opts.modelId];

  for (let attempt = 0; attempt < maxAttempts && pool.length < targetPool; attempt += 1) {
    const a = aLock || pickWeighted(lib);
    const b = bLock || pickWeighted(lib);

    if (!a || !b || a.word === b.word) continue;

    const candidates = modelIds.flatMap(modelId => {
      const variants =
        modelId === "m0"
          ? []
          : generateModelCandidates(modelId, a, b, opts.prefix || "", opts.suffix || "");

      return variants.map(variant => ({
        ...variant,
        modelId,
        family: modelMeta(modelId).family
      }));
    });

    const blendedCandidates =
      opts.modelId === "m0" ? blendModelCandidates(a, b, opts.prefix || "", opts.suffix || "") : candidates;

    const finalCandidates = applyUserModifiers(
      blendedCandidates,
      opts.prefix || "",
      opts.suffix || ""
    );

    for (const variant of finalCandidates) {
      const name = normalize(variant.name);
      if (name.length < minLen || name.length > maxLen || seen.has(name)) continue;

      const modelRelaxed =
        variant.modelId === "m3" &&
        (variant.method.startsWith("user-prefix") || variant.method.startsWith("initial"));

      const passes = modelRelaxed ? name.length >= minLen && name.length <= maxLen : passesNameQuality(name);
      if (!passes) continue;

      const scored = scoreName(name, a, b, variant.method);
      const floor = variant.modelId === "m3" ? 54 : variant.modelId === "m5" ? 50 : 61;
      if (scored.total < floor) continue;

      const tld = (opts.tlds.length ? pick(opts.tlds) : pick(TLDS)) || ".com";
      const model = modelMeta(variant.modelId);
      seen.add(name);
      pool.push({
        id: name + "-" + variant.modelId + "-" + variant.method + "-" + attempt,
        name,
        a: a.word,
        b: b.word,
        method: variant.method,
        modelId: variant.modelId,
        modelName: model.short,
        family: variant.family,
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
