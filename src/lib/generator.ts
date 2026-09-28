import type { Category, WordEntry, WordSource } from "../data/types";
import { WORD_LIBRARY, TLDS } from "../data/word-pools";
import { analyzeBrief } from "./brief";
import { adjustScore, type NamingStyleId } from "./style";
import { getModel, MODEL_REGISTRY } from "../models/registry";
import type { CandidateFamily, ModelId, ModelScore, ModelCandidate } from "../models/contract";
import { dictionaryOne, dictionaryTwo } from "../models/dictionary";
import { isSafeName, normalize } from "../models/common";

export type CandidateMode = "models" | "dictionary-one" | "dictionary-two";

export type Blend = {
  id: string;
  name: string;
  displayName: string;
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
  style: NamingStyleId;
  categories: Category[];
  sources: WordSource[];
  minLen: number;
  maxLen: number;
  count: number;
  seedA?: string;
  seedB?: string;
  seedWords?: string[];
  prefix?: string;
  suffix?: string;
  brief?: string;
  tlds: string[];
};

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function weightedPick(items: WordEntry[], matches: Map<string, number>) {
  if (!items.length) return null;

  const total = items.reduce((sum, entry) => {
    const briefBoost = 1 + ((matches.get(entry.word) || 0) / 100) * 2.4;
    return sum + entry.weight * briefBoost;
  }, 0);

  let roll = Math.random() * total;
  for (const entry of items) {
    const briefBoost = 1 + ((matches.get(entry.word) || 0) / 100) * 2.4;
    roll -= entry.weight * briefBoost;
    if (roll <= 0) return entry;
  }

  return items[items.length - 1];
}

function library(
  opts: GenOptions,
  briefMatches: Map<string, number>,
  briefCategories: Category[]
) {
  const sources = new Set(opts.sources);
  const categories = new Set([...opts.categories, ...briefCategories]);
  const matchedWords = new Set(briefMatches.keys());

  return WORD_LIBRARY.filter(entry => {
    if (!entry.sources.some(source => sources.has(source))) return false;
    if (!opts.categories.length && !briefCategories.length) return true;

    return (
      entry.categories.some(category => categories.has(category)) ||
      matchedWords.has(entry.word)
    );
  });
}

function customEntry(word: string, selected: WordEntry[]): WordEntry {
  const normalized = normalize(word);

  return (
    selected.find(entry => entry.word === normalized) || {
      word: normalized,
      categories: ["abstract"],
      sources: [],
      weight: 0.9
    }
  );
}

function matchesConstraints(name: string, prefix: string, suffix: string) {
  const value = normalize(name);
  const start = normalize(prefix);
  const end = normalize(suffix);

  if (start && !value.startsWith(start)) return false;
  if (end && !value.endsWith(end)) return false;
  return true;
}

function applyAffixes(name: string, prefix: string, suffix: string) {
  const value = normalize(name);
  const start = normalize(prefix);
  const end = normalize(suffix);

  if (!value) return value;

  const withPrefix = start && !value.startsWith(start) ? start + value : value;
  return end && !withPrefix.endsWith(end) ? withPrefix + end : withPrefix;
}

function hasExplicitAffix(prefix: string, suffix: string) {
  return Boolean(normalize(prefix) || normalize(suffix));
}

function userAnchorEntries(customPool: WordEntry[], lib: WordEntry[]) {
  if (!customPool.length) return [];
  const seen = new Set<string>();
  const entries: WordEntry[] = [];

  for (const entry of customPool) {
    if (!entry.word || seen.has(entry.word)) continue;
    seen.add(entry.word);
    entries.push(entry);
  }

  // Keep a useful pool of non-user words for pairing.
  for (const entry of lib) {
    if (entries.length >= 120) break;
    if (seen.has(entry.word)) continue;
    seen.add(entry.word);
    entries.push(entry);
  }

  return entries;
}

function familyKey(name: string) {
  const value = name.toLowerCase();
  const suffixes = ["ify", "ora", "ly", "io", "eo", "ia", "ix", "um", "ra", "z", "x", "r", "y"];

  for (const suffix of suffixes) {
    if (value.length > suffix.length + 3 && value.endsWith(suffix)) {
      return value.slice(0, -suffix.length);
    }
  }

  return value.slice(0, Math.min(5, value.length));
}

function diversify(candidates: Blend[], count: number, anchors: WordEntry[] = []) {
  const ordered = [...candidates].sort((a, b) => b.score - a.score);
  const familyCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  const chosen: Blend[] = [];
  const chosenNames = new Set<string>();

  const addCandidate = (candidate: Blend) => {
    if (chosen.length >= count || chosenNames.has(candidate.name)) return false;

    const family = familyKey(candidate.name);
    const model = candidate.modelId;
    const pair = candidate.a + "|" + candidate.b;
    const familyCap = candidate.family === "dictionary" ? 8 : 4;
    const modelCap = candidate.modelId === "m0" ? count : Math.ceil(count * 0.42);

    if ((familyCounts.get(family) || 0) >= familyCap) return false;
    if ((modelCounts.get(model) || 0) >= modelCap) return false;
    if ((pairCounts.get(pair) || 0) >= 4) return false;

    familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
    pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    chosenNames.add(candidate.name);
    chosen.push(candidate);
    return true;
  };

  // Preserve explicit user-word coverage before general score-based diversification.
  for (const anchor of anchors) {
    const match = ordered.find(candidate =>
      candidate.a === anchor.word || candidate.b === anchor.word
    );
    if (match) addCandidate(match);
  }

  for (const candidate of ordered) {
    if (chosen.length >= count) break;
    addCandidate(candidate);
  }

  if (chosen.length < count) {
    for (const candidate of ordered) {
      if (chosen.length >= count) break;
      if (chosenNames.has(candidate.name)) continue;
      chosenNames.add(candidate.name);
      chosen.push(candidate);
    }
  }

  return chosen.slice(0, count);
}

function camelCaseTwoWords(a: string, b: string) {
  const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  return cap(a) + cap(b);
}

function dictionaryBlend(
  candidate: ReturnType<typeof dictionaryOne>[number] | ReturnType<typeof dictionaryTwo>[number],
  tld: string,
  mode: CandidateMode,
  style: NamingStyleId,
  prefix = "",
  suffix = ""
): Blend {
  const b = candidate.b || candidate.a;
  const displayName =
    mode === "dictionary-two"
      ? (hasExplicitAffix(prefix, suffix)
          ? [prefix, camelCaseTwoWords(candidate.a.word, b.word), suffix].filter(Boolean).map(value => {
              const cleaned = normalize(value);
              return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
            }).join("")
          : camelCaseTwoWords(candidate.a.word, b.word))
      : candidate.name;
  const adjusted = adjustScore(candidate.score, candidate.name, candidate.method, style);

  return {
    id: candidate.name + "-" + mode,
    name: candidate.name,
    displayName,
    a: candidate.a.word,
    b: b.word,
    method: candidate.method,
    modelId: "m0",
    modelName: mode === "dictionary-one" ? "Dictionary · One word" : "Dictionary · Two words",
    family: "dictionary",
    tld,
    score: adjusted,
    scoreDimensions: { ...candidate.evidence.dimensions, stylePreference: adjusted },
    rationale: [
      ...candidate.evidence.rationale,
      mode === "dictionary-two" ? "Displayed in CamelCase; domain remains lowercase" : "Untouched dictionary word"
    ],
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
  score: ModelScore,
  style: NamingStyleId
): Blend {
  const model = getModel(modelId);
  const adjusted = adjustScore(score.total, candidate.name, candidate.method, style);

  return {
    id: candidate.name + "-" + modelId + "-" + candidate.method,
    name: candidate.name,
    displayName: candidate.name,
    a: a.word,
    b: b.word,
    method: candidate.method,
    modelId,
    modelName: model.short,
    family: model.family,
    tld,
    score: adjusted,
    scoreDimensions: { ...score.dimensions, stylePreference: adjusted },
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

  const briefAnalysis = analyzeBrief(opts.brief || "", WORD_LIBRARY);
  const matches = new Map(briefAnalysis.matches.map(match => [match.word, match.score]));

  const lib = library(opts, matches, briefAnalysis.categories);
  const briefTerms = briefAnalysis.matches.map(match => match.word);

  const exactWords = (opts.seedWords || [])
    .map(word => normalize(word))
    .filter(Boolean)
    .slice(0, 8);
  const customPool = exactWords.map(word => customEntry(word, lib));

  const aLock = opts.seedA?.trim()
    ? customEntry(opts.seedA, lib)
    : customPool.length === 1
      ? customPool[0]
      : null;
  const bLock = opts.seedB?.trim()
    ? customEntry(opts.seedB, lib)
    : customPool.length === 2
      ? customPool[1]
      : null;

  // User-entered words are anchors, not merely weighted suggestions.
  // The library remains available so anchored words can be paired with fresh vocabulary.
  const selectionPool = lib.length ? lib : customPool;

  if (!lib.length && !customPool.length && !aLock && !bLock) return [];

  if (opts.candidateMode === "dictionary-one") {
    const entries = [...lib]
      .filter(entry =>
        entry.word.length >= Math.max(1, minLen - normalize(opts.prefix || "").length) &&
        entry.word.length <= maxLen &&
        matchesConstraints(applyAffixes(entry.word, opts.prefix || "", opts.suffix || ""), opts.prefix || "", opts.suffix || "")
      )
      .sort((a, b) => (matches.get(b.word) || 0) - (matches.get(a.word) || 0));

    for (const custom of customPool) {
      const candidateName = applyAffixes(custom.word, opts.prefix || "", opts.suffix || "");
      if (
        candidateName.length >= minLen &&
        candidateName.length <= maxLen &&
        matchesConstraints(candidateName, opts.prefix || "", opts.suffix || "") &&
        !entries.some(entry => entry.word === custom.word)
      ) {
        entries.unshift(custom);
      }
    }

    const candidates = dictionaryOne(entries, Math.min(count * 5, entries.length), briefTerms)
      .map(candidate => ({
        ...candidate,
        name: applyAffixes(candidate.name, opts.prefix || "", opts.suffix || ""),
        method: hasExplicitAffix(opts.prefix || "", opts.suffix || "")
          ? "user-affix(" + candidate.method + ")"
          : candidate.method
      }))
      .filter(candidate =>
        candidate.name.length >= minLen &&
        candidate.name.length <= maxLen &&
        matchesConstraints(candidate.name, opts.prefix || "", opts.suffix || "")
      );

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(candidate =>
        dictionaryBlend(
          candidate,
          pick(opts.tlds.length ? opts.tlds : TLDS) || ".com",
          "dictionary-one",
          opts.style,
          opts.prefix || "",
          opts.suffix || ""
        )
      );
  }

  if (opts.candidateMode === "dictionary-two") {
    const dictionaryEntries = userAnchorEntries(customPool, lib);
    const candidates = dictionaryTwo(dictionaryEntries, Math.max(count * 12, 300))
      .filter(candidate => customPool.length === 0 || customPool.some(anchor =>
        candidate.a.word === anchor.word || candidate.b?.word === anchor.word
      ))
      .map(candidate => ({
        ...candidate,
        name: applyAffixes(candidate.name, opts.prefix || "", opts.suffix || ""),
        method: hasExplicitAffix(opts.prefix || "", opts.suffix || "")
          ? "user-affix(" + candidate.method + ")"
          : candidate.method
      }))
      .filter(candidate =>
        candidate.name.length >= minLen &&
        candidate.name.length <= maxLen &&
        matchesConstraints(candidate.name, opts.prefix || "", opts.suffix || "")
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(count * 5, 120));

    return candidates
      .slice(0, count)
      .map(candidate =>
        dictionaryBlend(
          candidate,
          pick(opts.tlds.length ? opts.tlds : TLDS) || ".com",
          "dictionary-two",
          opts.style,
          opts.prefix || "",
          opts.suffix || ""
        )
      );
  }

  const modelIds: Array<Exclude<ModelId, "m0">> =
    opts.modelId === "m0" ? MODEL_REGISTRY.map(model => model.id) : [opts.modelId];

  const pool: Blend[] = [];
  const seen = new Set<string>();
  const targetPool = Math.max(360, count * 6);
  const maxAttempts = opts.modelId === "m0" ? 2800 : 1900;
  const anchors = customPool.length ? customPool : [];
  const partnerPool = selectionPool.length ? selectionPool : customPool;

  for (let attempt = 0; attempt < maxAttempts && pool.length < targetPool; attempt += 1) {
    const anchor = anchors.length
      ? anchors[attempt % anchors.length]
      : null;

    const a = aLock || anchor || weightedPick(partnerPool, matches);
    const b = bLock || (
      anchor
        ? weightedPick(partnerPool.filter(entry => entry.word !== anchor.word), matches)
        : weightedPick(partnerPool, matches)
    );

    if (!a || !b || a.word === b.word) continue;

    for (const modelId of modelIds) {
      const model = getModel(modelId);
      const rawCandidates = model.generate({
        a,
        b,
        prefix: opts.prefix || "",
        suffix: opts.suffix || "",
        briefTerms,
        style: opts.style
      });

      const candidates = [...rawCandidates];
      const baseNameByCandidate = new Map<string, string>();

      for (const candidate of rawCandidates) {
        baseNameByCandidate.set(candidate.name, candidate.name);
      }

      if (hasExplicitAffix(opts.prefix || "", opts.suffix || "")) {
        for (const candidate of rawCandidates.slice(0, 80)) {
          const name = applyAffixes(candidate.name, opts.prefix || "", opts.suffix || "");
          if (!isSafeName(name) || seen.has(name)) continue;
          baseNameByCandidate.set(name, candidate.name);
          candidates.push({
            ...candidate,
            name,
            method: "user-affix(" + candidate.method + ")"
          });
        }
      }

      for (const candidate of candidates) {
        const name = normalize(candidate.name);
        if (!isSafeName(name)) continue;
        if (anchors.length && !anchors.some(anchor => anchor.word === a.word || anchor.word === b.word)) continue;
        if (name.length < minLen || name.length > maxLen || seen.has(name)) continue;
        if (!matchesConstraints(name, opts.prefix || "", opts.suffix || "")) continue;

        const baseName = baseNameByCandidate.get(name) || name;
        const acceptanceCandidate = { ...candidate, name: baseName };

        if (!model.accept(acceptanceCandidate, {
          a,
          b,
          prefix: opts.prefix || "",
          suffix: opts.suffix || "",
          briefTerms,
          style: opts.style
        })) continue;

        const score = model.score(
          { ...candidate, name },
          {
            a,
            b,
            prefix: opts.prefix || "",
            suffix: opts.suffix || "",
            briefTerms,
            style: opts.style
          }
        );

        const floor = modelId === "m3" ? 42 : modelId === "m5" ? 40 : 44;
        if (score.total < floor) continue;

        const adjusted = buildBlend(
          { ...candidate, name },
          modelId,
          a,
          b,
          pick(opts.tlds.length ? opts.tlds : TLDS) || ".com",
          score,
          opts.style
        );

        seen.add(name);
        pool.push(adjusted);

        if (pool.length >= targetPool) break;
      }
    }
  }

  return diversify(pool, count, customPool);
}

export const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
