import type { Category, WordEntry, WordSource } from "../data/types";
import { WORD_LIBRARY, TLDS } from "../data/word-pools";
import { extractBriefTerms } from "./brief";
import { getModel, MODEL_REGISTRY } from "../models/registry";
import type { CandidateFamily, ModelId, ModelScore } from "../models/contract";
import { dictionaryOne, dictionaryTwo } from "../models/dictionary";
import type { ModelCandidate } from "../models/contract";
import { isSafeName, normalize } from "../models/common";

export type CandidateMode = "models" | "dictionary-one" | "dictionary-two";

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
  scoreDimensions: Record<string, number>;
  rationale: string[];
  categories: Category[];
  sourcesA: WordSource[];
  sourcesB: WordSource[];
};

export type GenOptions = {
  modelId: ModelId;
  candidateMode?: CandidateMode;
  categories: Category[];
  sources: WordSource[];
  minLen: number;
  maxLen: number;
  count: number;
  seedA?: string;
  seedB?: string;
  prefix?: string;
  suffix?: string;
  brief?: string;
  tlds: string[];
};

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function weightedPick(items: WordEntry[], briefTerms: string[]) {
  if (!items.length) return null;
  const total = items.reduce((sum, entry) => {
    const briefBoost = briefTerms.includes(entry.word) ? 2.25 : 1;
    return sum + entry.weight * briefBoost;
  }, 0);
  let roll = Math.random() * total;
  for (const entry of items) {
    roll -= entry.weight * (briefTerms.includes(entry.word) ? 2.25 : 1);
    if (roll <= 0) return entry;
  }
  return items[items.length - 1];
}

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

function applyUserModifiers(
  candidates: Array<ModelCandidate & { modelId: Exclude<ModelId, "m0">; family: Exclude<CandidateFamily, "blend" | "dictionary"> }>,
  prefix: string,
  suffix: string
) {
  const p = normalize(prefix);
  const s = normalize(suffix);
  if (!p && !s) return candidates;

  const output = [...candidates];
  const seen = new Set(candidates.map(item => item.name));

  for (const candidate of candidates.slice(0, 50)) {
    const alreadyPrefixed = !p || candidate.name.startsWith(p);
    const alreadySuffixed = !s || candidate.name.endsWith(s);
    const name = (alreadyPrefixed ? "" : p) + candidate.name + (alreadySuffixed ? "" : s);
    if (!isSafeName(name) || seen.has(name)) continue;

    seen.add(name);
    output.push({
      ...candidate,
      name,
      method: "user-modified(" + candidate.method + ")"
    });
  }

  return output;
}

function familyKey(name: string) {
  const value = name.toLowerCase();
  const suffixes = ["ify", "ora", "ly", "io", "eo", "ia", "ix", "um", "ra", "z", "x", "r", "y"];
  for (const suffix of suffixes) {
    if (value.length > suffix.length + 3 && value.endsWith(suffix)) return value.slice(0, -suffix.length);
  }
  return value.slice(0, Math.min(5, value.length));
}

function diversify(candidates: Blend[], count: number) {
  const ordered = [...candidates].sort((a, b) => b.score - a.score);
  const familyCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  const chosen: Blend[] = [];

  for (const candidate of ordered) {
    if (chosen.length >= count) break;

    const family = familyKey(candidate.name);
    const model = candidate.modelId;
    const pair = candidate.a + "|" + candidate.b;
    const familyCap = candidate.family === "dictionary" ? 8 : 4;
    const modelCap = Math.ceil(count * 0.42);

    if ((familyCounts.get(family) || 0) >= familyCap) continue;
    if ((modelCounts.get(model) || 0) >= modelCap) continue;
    if ((pairCounts.get(pair) || 0) >= 4) continue;

    familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
    pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
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

function dictionaryBlend(
  candidate: ReturnType<typeof dictionaryOne>[number] | ReturnType<typeof dictionaryTwo>[number],
  tld: string,
  mode: CandidateMode
): Blend {
  const b = candidate.b || candidate.a;
  const modelName = mode === "dictionary-one" ? "Dictionary · One word" : "Dictionary · Two words";
  return {
    id: candidate.name + "-" + mode,
    name: candidate.name,
    a: candidate.a.word,
    b: b.word,
    method: candidate.method,
    modelId: "m0",
    modelName,
    family: "dictionary",
    tld,
    score: candidate.score,
    scoreDimensions: candidate.evidence.dimensions,
    rationale: candidate.evidence.rationale,
    categories: candidate.evidence.categories,
    sourcesA: candidate.a.sources,
    sourcesB: b.sources
  };
}

function buildBlend(
  candidate: ModelCandidate,
  modelId: Exclude<ModelId, "m0">,
  a: WordEntry,
  b: WordEntry,
  tld: string,
  score: ModelScore
): Blend {
  const model = getModel(modelId);
  return {
    id: candidate.name + "-" + modelId + "-" + candidate.method,
    name: candidate.name,
    a: a.word,
    b: b.word,
    method: candidate.method,
    modelId,
    modelName: model.short,
    family: model.family,
    tld,
    score: score.total,
    scoreDimensions: score.dimensions,
    rationale: [...(candidate.evidence || []), ...score.rationale],
    categories: [...new Set([...a.categories, ...b.categories])],
    sourcesA: a.sources,
    sourcesB: b.sources
  };
}

export function generate(opts: GenOptions): Blend[] {
  const count = Math.max(6, Math.min(120, opts.count));
  const minLen = Math.min(opts.minLen, opts.maxLen);
  const maxLen = Math.max(opts.minLen, opts.maxLen);
  const lib = library(opts);
  const briefTerms = extractBriefTerms(opts.brief || "", lib);
  const aLock = opts.seedA?.trim() ? customEntry(opts.seedA, lib) : null;
  const bLock = opts.seedB?.trim() ? customEntry(opts.seedB, lib) : null;

  if (!lib.length && !aLock && !bLock) return [];

  if (opts.candidateMode === "dictionary-one") {
    const entries = [...lib].filter(entry => entry.word.length >= minLen && entry.word.length <= maxLen);
    if (aLock && aLock.word && !entries.some(entry => entry.word === aLock.word)) entries.unshift(aLock);
    const candidates = dictionaryOne(entries, Math.min(count * 3, entries.length), briefTerms);
    return candidates
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map(candidate => dictionaryBlend(candidate, pick(opts.tlds.length ? opts.tlds : TLDS) || ".com", "dictionary-one"));
  }

  if (opts.candidateMode === "dictionary-two") {
    const candidates = dictionaryTwo(lib, Math.max(count * 5, 100), briefTerms)
      .filter(candidate => candidate.name.length >= minLen && candidate.name.length <= maxLen)
      .sort((a, b) => b.score - a.score);

    const selected: typeof candidates = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (selected.length >= count) break;
      const jitter = Math.random();
      if (jitter < 0.25 && selected.length > Math.floor(count * 0.5)) continue;
      if (seen.has(candidate.name)) continue;
      seen.add(candidate.name);
      selected.push(candidate);
    }
    return selected.map(candidate =>
      dictionaryBlend(candidate, pick(opts.tlds.length ? opts.tlds : TLDS) || ".com", "dictionary-two")
    );
  }

  const modelIds: Array<Exclude<ModelId, "m0">> =
    opts.modelId === "m0" ? MODEL_REGISTRY.map(model => model.id) : [opts.modelId];

  const pool: Blend[] = [];
  const seen = new Set<string>();
  const targetPool = Math.max(360, count * 6);
  const maxAttempts = opts.modelId === "m0" ? 2600 : 1800;

  for (let attempt = 0; attempt < maxAttempts && pool.length < targetPool; attempt += 1) {
    const a = aLock || weightedPick(lib, briefTerms);
    const b = bLock || weightedPick(lib, briefTerms);
    if (!a || !b || a.word === b.word) continue;

    for (const modelId of modelIds) {
      const model = getModel(modelId);
      const rawCandidates = model.generate({
        a,
        b,
        prefix: opts.prefix || "",
        suffix: opts.suffix || "",
        briefTerms
      });

      const modified = applyUserModifiers(
        rawCandidates.map(candidate => ({ ...candidate, modelId, family: model.family })),
        opts.prefix || "",
        opts.suffix || ""
      );

      for (const candidate of modified) {
        const name = normalize(candidate.name);
        if (!isSafeName(name)) continue;
        if (name.length < minLen || name.length > maxLen || seen.has(name)) continue;

        const normalizedCandidate = { ...candidate, name };
        const score = model.score(normalizedCandidate, { a, b, prefix: opts.prefix || "", suffix: opts.suffix || "", briefTerms });
        const floor = modelId === "m3" ? 48 : modelId === "m5" ? 45 : 50;
        if (score.total < floor) continue;

        const tld = pick(opts.tlds.length ? opts.tlds : TLDS) || ".com";
        seen.add(name);
        pool.push(buildBlend(normalizedCandidate, modelId, a, b, tld, score));

        if (pool.length >= targetPool) break;
      }
    }
  }

  return diversify(pool, count);
}

export const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
