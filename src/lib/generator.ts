import type { Category, WordEntry, WordSource } from "../data/types";
import { WORD_LIBRARY, PURE_DICTIONARY_LIBRARY, TLDS } from "../data/word-pools";
import { analyzeBrief } from "./brief";
import { adjustScore, type NamingStyleId } from "./style";
import { getModel, MODEL_REGISTRY } from "../models/registry";
import type { ModelFamily, ModelId, ModelScore, ModelCandidate, GeneratedEvidence } from "../models/contract";
import { dictionaryOne, dictionaryTwo } from "../models/dictionary";
import { creativeWordVariants } from "./fusion";
import { isSafeName, normalize } from "../models/common";

export type CandidateMode = "models" | "dictionary-one" | "dictionary-two";
export type GenerateProgress = { phase: "preparing" | "generating" | "finishing"; percent: number; found: number };

export type Blend = {
  id: string;
  name: string;
  displayName: string;
  a: string;
  b: string;
  method: string;
  modelId: ModelId;
  modelName: string;
  family: Exclude<ModelFamily, "blend">;
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
  lite?: boolean;
  excludeNames?: string[];
};

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function splitOptions(value: string) {
  return [...new Set(
    value
      .split(/[,;|\s]+/)
      .map(normalize)
      .filter(Boolean)
  )].slice(0, 12);
}

function matchesConstraints(name: string, prefixes: string[], suffixes: string[]) {
  const value = normalize(name);
  if (prefixes.length && !prefixes.some(prefix => value.startsWith(prefix))) return false;
  if (suffixes.length && !suffixes.some(suffix => value.endsWith(suffix))) return false;
  return true;
}

function applyAffixVariants(name: string, prefixes: string[], suffixes: string[]) {
  const value = normalize(name);
  if (!value) return [];

  if (!prefixes.length && !suffixes.length) return [value];

  const variants = new Set<string>();

  if (prefixes.length) {
    for (const prefix of prefixes) {
      const base = value.startsWith(prefix) ? value : prefix + value;
      if (suffixes.length) {
        for (const suffix of suffixes) {
          variants.add(base.endsWith(suffix) ? base : base + suffix);
        }
      } else {
        variants.add(base);
      }
    }
  }

  if (suffixes.length && !prefixes.length) {
    for (const suffix of suffixes) {
      variants.add(value.endsWith(suffix) ? value : value + suffix);
    }
  }

  return [...variants];
}

function hasExplicitAffix(prefixes: string[], suffixes: string[]) {
  return prefixes.length > 0 || suffixes.length > 0;
}

function passesLiteQuality(value: string) {
  const word = normalize(value);
  if (!/^[a-z]+$/.test(word) || word.length < 5 || word.length > 12) return false;
  if (/(.)\1\1/.test(word)) return false;
  if (/(fuck|shit|porn|rape|nazi|suicide|terror)/.test(word)) return false;
  return true;
}

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

function library(opts: GenOptions, briefMatches: Map<string, number>, briefCategories: Category[]) {
  const sources = new Set(opts.sources);
  const categories = new Set([...opts.categories, ...briefCategories]);
  const matchedWords = new Set(briefMatches.keys());

  return WORD_LIBRARY.filter(entry => {
    if (!entry.sources.some(source => sources.has(source))) return false;
    if (!opts.categories.length && !briefCategories.length) return true;

    return entry.categories.some(category => categories.has(category)) || matchedWords.has(entry.word);
  });
}

function customEntry(word: string, selected: WordEntry[]): WordEntry {
  const normalized = normalize(word);

  return (
    selected.find(entry => entry.word === normalized) || {
      word: normalized,
      categories: ["abstract"],
      sources: [],
      weight: 1.1
    }
  );
}

function familyKey(name: string, prefixes: string[] = [], suffixes: string[] = []) {
  let value = name.toLowerCase();

  const userPrefix = [...prefixes].sort((a, b) => b.length - a.length).find(prefix => value.startsWith(prefix));
  if (userPrefix && value.length > userPrefix.length + 2) value = value.slice(userPrefix.length);

  const userSuffix = [...suffixes].sort((a, b) => b.length - a.length).find(suffix => value.endsWith(suffix));
  if (userSuffix && value.length > userSuffix.length + 2) value = value.slice(0, -userSuffix.length);

  const brandSuffixes = ["ify", "ora", "ly", "io", "eo", "ia", "ix", "um", "ra", "z", "x", "r", "y"];
  for (const suffix of brandSuffixes) {
    if (value.length > suffix.length + 3 && value.endsWith(suffix)) {
      return value.slice(0, -suffix.length);
    }
  }

  return value.slice(0, Math.min(5, value.length));
}

function diversify(candidates: Blend[], count: number, anchors: WordEntry[] = [], prefixes: string[] = [], suffixes: string[] = []) {
  const ordered = [...candidates].sort((a, b) => b.score - a.score);
  const familyCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  const chosen: Blend[] = [];
  const chosenNames = new Set<string>();

  const addCandidate = (candidate: Blend) => {
    if (chosen.length >= count || chosenNames.has(candidate.name)) return false;

    const family = familyKey(candidate.name, prefixes, suffixes);
    const model = candidate.modelId;
    const pair = candidate.a + "|" + candidate.b;
    const familyCap = candidate.family === "dictionary" ? 10 : 5;
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

  for (const anchor of anchors) {
    const match = ordered.find(candidate => candidate.a === anchor.word || candidate.b === anchor.word);
    if (match) addCandidate(match);
  }

  for (const candidate of ordered) addCandidate(candidate);

  return chosen.slice(0, count);
}

function camelCaseTwoWords(a: string, b: string) {
  const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  return cap(a) + cap(b);
}

type DictionaryWorkCandidate = {
  name: string;
  a: WordEntry;
  b?: WordEntry;
  method: string;
  score: number;
  evidence: GeneratedEvidence;
};

function dictionaryBlend(
  candidate: DictionaryWorkCandidate,
  tld: string,
  mode: CandidateMode,
  style: NamingStyleId,
  displayName?: string
): Blend {
  const b = candidate.b || candidate.a;
  const adjusted = adjustScore(candidate.score, candidate.name, candidate.method, style);

  return {
    id: candidate.name + "-" + mode + "-" + candidate.method,
    name: candidate.name,
    displayName: displayName || (mode === "dictionary-two" ? camelCaseTwoWords(candidate.a.word, b.word) : candidate.name),
    a: candidate.a.word,
    b: b.word,
    method: candidate.method,
    modelId: "m0",
    modelName: mode === "dictionary-one" ? "Real Word" : "Two Real Words",
    family: "dictionary",
    tld,
    score: adjusted,
    scoreDimensions: { ...candidate.evidence.dimensions, stylePreference: adjusted },
    rationale: [
      ...candidate.evidence.rationale,
      mode === "dictionary-two" ? "Two untouched words; displayed in CamelCase" : "Untouched single-word vocabulary or word form"
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

export async function generateAsync(
  opts: GenOptions,
  onProgress?: (progress: GenerateProgress) => void
): Promise<Blend[]> {
  const count = Math.max(6, Math.min(1000, opts.count));
  const minLen = Math.min(opts.minLen, opts.maxLen);
  const maxLen = Math.max(opts.minLen, opts.maxLen);
  const prefixes = splitOptions(opts.prefix || "");
  const suffixes = splitOptions(opts.suffix || "");

  onProgress?.({ phase: "preparing", percent: 2, found: 0 });

  const briefAnalysis = analyzeBrief(opts.brief || "", WORD_LIBRARY);
  const matches = new Map(briefAnalysis.matches.map(match => [match.word, match.score]));
  const lib = library(opts, matches, briefAnalysis.categories);

  const exactWords = (opts.seedWords || [])
    .map(normalize)
    .filter(Boolean)
    .slice(0, 12);

  const customPool = exactWords.map(word => customEntry(word, lib));
  const aLock = opts.seedA?.trim() ? customEntry(opts.seedA, lib) : customPool.length === 1 ? customPool[0] : null;
  const bLock = opts.seedB?.trim() ? customEntry(opts.seedB, lib) : customPool.length === 2 ? customPool[1] : null;

  const selectionPool = lib.length ? lib : customPool;
  const briefTerms = briefAnalysis.matches.map(match => match.word);

  if (!selectionPool.length) return [];

  const tldPool = opts.tlds.length ? opts.tlds : TLDS;
  const excluded = new Set((opts.excludeNames || []).map(normalize));

  if (opts.lite) {
    const allModels = MODEL_REGISTRY;
    const litePool: Blend[] = [];
    const liteSeen = new Set(excluded);
    const anchorWords = customPool.length
      ? customPool
      : [...selectionPool].sort(() => Math.random() - 0.5).slice(0, Math.min(24, selectionPool.length));
    const partnerPool = selectionPool;

    const addLite = (
      candidate: ModelCandidate,
      modelId: Exclude<ModelId, "m0">,
      a: WordEntry,
      b: WordEntry
    ) => {
      const name = normalize(candidate.name);
      if (!passesLiteQuality(name) || name.length < 5 || name.length > 12) return;
      if (liteSeen.has(name)) return;

      const model = getModel(modelId);
      const score = model.score(
        { ...candidate, name },
        { a, b, prefix: "", suffix: "", briefTerms, style: "balanced" }
      );
      const adjusted = adjustScore(score.total, name, candidate.method, "balanced");
      if (adjusted < 34) return;

      liteSeen.add(name);
      litePool.push(buildBlend(
        { ...candidate, name },
        modelId,
        a,
        b,
        pick(tldPool) || ".com",
        { ...score, total: adjusted },
        "balanced"
      ));
    };

    // Preserve direct word-family exploration for a user keyword.
    for (const anchor of anchorWords) {
      const direct = creativeWordVariants(anchor);
      const selfCandidate: ModelCandidate = {
        name: anchor.word,
        method: "keyword-root",
        evidence: ["user keyword anchor"]
      };
      addLite(selfCandidate, "m2", anchor, anchor);

      for (const variant of direct) {
        addLite(
          { name: variant.name, method: variant.method, evidence: ["keyword spelling variant"] },
          "m2",
          anchor,
          anchor
        );
      }
    }

    const maxPartners = Math.min(120, partnerPool.length);
    let attempts = 0;
    const target = Math.max(count * 5, 600);

    const maxLiteAttempts = Math.min(
      3000,
      Math.max(600, anchorWords.length * Math.min(120, Math.max(1, partnerPool.length)) * 2)
    );

    while (litePool.length < target && attempts < maxLiteAttempts) {
      const anchor = anchorWords[attempts % anchorWords.length];
      const partner = partnerPool[(attempts * 37) % maxPartners];
      attempts += 1;
      if (!anchor || !partner || anchor.word === partner.word) continue;

      for (const model of allModels) {
        const rawCandidates = model.generate({
          a: anchor,
          b: partner,
          prefix: "",
          suffix: "",
          briefTerms,
          style: "balanced"
        });

        for (const candidate of rawCandidates) {
          // Lite is a broad exploration layer. The model scorer still ranks candidates,
          // but its strict model acceptance gate does not eliminate the candidate.
          addLite(candidate, model.id, anchor, partner);
          if (litePool.length >= target) break;
        }
        if (litePool.length >= target) break;
      }

      if (attempts % 24 === 0) {
        const percent = Math.min(96, Math.round((attempts / maxLiteAttempts) * 96));
        onProgress?.({ phase: "generating", percent, found: Math.min(litePool.length, count) });
        await yieldToBrowser();
      }
    }

    // A permissive second pass guarantees Lite remains useful for a single keyword,
    // without dropping unsafe or overlong strings.
    if (litePool.length < count) {
      const fallbackSeen = new Set(litePool.map(item => item.name));
      for (const anchor of anchorWords) {
        for (const partner of partnerPool.slice(0, maxPartners)) {
          for (const fusion of [
            ...creativeWordVariants(anchor).map(v => ({ name: v.name, method: "lite-" + v.method })),
            ...creativeWordVariants(partner).map(v => ({ name: anchor.word + v.name, method: "lite-keyword+" + v.method })),
            { name: anchor.word + partner.word, method: "lite-word+word" },
            { name: partner.word + anchor.word, method: "lite-word+keyword" }
          ]) {
            const value = normalize(fusion.name);
            if (!passesLiteQuality(value) || value.length < 5 || value.length > 12) continue;
            if (fallbackSeen.has(value) || excluded.has(value)) continue;

            fallbackSeen.add(value);
            litePool.push({
              id: value + "-lite",
              name: value,
              displayName: value,
              a: anchor.word,
              b: partner.word,
              method: fusion.method,
              modelId: "m0",
              modelName: "Lite Mix",
              family: "experimental",
              tld: pick(tldPool) || ".com",
              score: 55,
              scoreDimensions: { liteExploration: 55 },
              rationale: ["Broad Lite exploration", "Passed safety, length and duplication checks"],
              categories: [...new Set([...anchor.categories, ...partner.categories])],
              sourcesA: anchor.sources,
              sourcesB: partner.sources
            });
            if (litePool.length >= count) break;
          }
          if (litePool.length >= count) break;
        }
        if (litePool.length >= count) break;
      }
    }

    onProgress?.({ phase: "finishing", percent: 98, found: Math.min(litePool.length, count) });
    const liteResult = diversify(litePool, count, customPool);
    onProgress?.({ phase: "finishing", percent: 100, found: liteResult.length });
    return liteResult;
  }

  if (opts.candidateMode === "dictionary-one") {
    // Real word mode is intentionally literal:
    // take an untouched dictionary word and optionally attach the user's prefix/suffix.
    // No spelling alterations, fusion, clipping or creative variants are allowed here.
    const dictionaryPool = PURE_DICTIONARY_LIBRARY.filter(entry => {
      if (!entry.sources.length) return true;
      return entry.sources.some(source => opts.sources.includes(source));
    });

    const entries = [...dictionaryPool.length ? dictionaryPool : PURE_DICTIONARY_LIBRARY]
      .filter(entry => entry.word.length + prefixes.reduce((n, p) => n + p.length, 0) + suffixes.reduce((n, s) => n + s.length, 0) >= minLen)
      .filter(entry => entry.word.length <= maxLen)
      .sort((a, b) => (matches.get(b.word) || 0) - (matches.get(a.word) || 0));

    // Explicit user words remain available when the user supplied them, but normal
    // Real Word generation is sourced strictly from the pure dictionary library.
    for (const custom of customPool) {
      if (custom.kind === "dictionary" && !entries.some(entry => entry.word === custom.word)) entries.unshift(custom);
    }

    const baseCandidates = dictionaryOne(entries, entries.length, briefTerms);
    const seen = new Set<string>();
    const result: Blend[] = [];

    for (const candidate of baseCandidates) {
      const names = applyAffixVariants(candidate.a.word, prefixes, suffixes);

      for (const finalName of names) {
        if (excluded.has(finalName)) continue;
        if (!/^[a-z]+$/.test(finalName)) continue;
        if (finalName.length < minLen || finalName.length > maxLen) continue;
        if (!matchesConstraints(finalName, prefixes, suffixes)) continue;
        if (seen.has(finalName)) continue;

        seen.add(finalName);
        result.push(
          dictionaryBlend(
            {
              ...candidate,
              name: finalName,
              method: hasExplicitAffix(prefixes, suffixes)
                ? "user-affix(dictionary-word)"
                : "dictionary-word"
            },
            pick(tldPool) || ".com",
            "dictionary-one",
            opts.style
          )
        );

        if (result.length >= count) break;
      }

      if (result.length >= count) break;
    }

    onProgress?.({ phase: "finishing", percent: 100, found: result.length });
    return result;
  }

  if (opts.candidateMode === "dictionary-two") {
    const pairEntries = selectionPool.length > 220 ? selectionPool.slice(0, 220) : selectionPool;
    const rawCandidates = dictionaryTwo(pairEntries, Math.max(count * 12, 600), briefTerms)
      .map(candidate => {
        const finalNames = applyAffixVariants(candidate.name, prefixes, suffixes);
        return finalNames.map(name => ({
          ...candidate,
          name,
          method: hasExplicitAffix(prefixes, suffixes)
            ? "user-affix(" + candidate.method + ")"
            : candidate.method
        }));
      })
      .flat()
      .filter(candidate =>
        candidate.name.length >= minLen &&
        candidate.name.length <= maxLen &&
        matchesConstraints(candidate.name, prefixes, suffixes)
      )
      .slice(0, Math.max(count * 4, 400));

    const seen = new Set<string>();
    const result = rawCandidates
      .filter(candidate => {
        if (seen.has(candidate.name)) return false;
        seen.add(candidate.name);
        return true;
      })
      .slice(0, count)
      .map(candidate =>
        dictionaryBlend(
          candidate,
          pick(tldPool) || ".com",
          "dictionary-two",
          opts.style
        )
      );

    onProgress?.({ phase: "finishing", percent: 100, found: result.length });
    return result;
  }

  const modelIds: Array<Exclude<ModelId, "m0">> =
    opts.modelId === "m0" ? MODEL_REGISTRY.map(model => model.id) : [opts.modelId];

  const pool: Blend[] = [];
  const seen = new Set<string>();
  const anchors = customPool;
  const targetPool = Math.max(360, Math.min(2200, count * 2));
  const maxAttempts = Math.max(900, Math.min(4200, count * 3 + 400));

  for (let attempt = 0; attempt < maxAttempts && pool.length < targetPool; attempt += 1) {
    const anchor = anchors.length ? anchors[attempt % anchors.length] : null;
    const a = aLock || anchor || weightedPick(selectionPool, matches);
    const b =
      bLock ||
      (anchor
        ? weightedPick(selectionPool.filter(entry => entry.word !== anchor.word), matches)
        : weightedPick(selectionPool, matches));

    if (!a || !b || a.word === b.word) continue;

    for (const modelId of modelIds) {
      const model = getModel(modelId);
      const rawCandidates = model.generate({
        a,
        b,
        prefix: prefixes.length === 1 ? prefixes[0] : "",
        suffix: suffixes.length === 1 ? suffixes[0] : "",
        briefTerms,
        style: opts.style
      });

      for (const rawCandidate of rawCandidates) {
        const finalNames = applyAffixVariants(rawCandidate.name, prefixes, suffixes);
        for (const finalName of finalNames) {
          if (!isSafeName(finalName)) continue;
          if (finalName.length < minLen || finalName.length > maxLen) continue;
          if (!matchesConstraints(finalName, prefixes, suffixes)) continue;
          if (seen.has(finalName)) continue;

          const baseName = rawCandidate.name;
          if (!model.accept({ ...rawCandidate, name: baseName }, {
            a,
            b,
            prefix: prefixes.length === 1 ? prefixes[0] : "",
            suffix: suffixes.length === 1 ? suffixes[0] : "",
            briefTerms,
            style: opts.style
          })) continue;

          const score = model.score(
            { ...rawCandidate, name: finalName },
            {
              a,
              b,
              prefix: prefixes.join(" "),
              suffix: suffixes.join(" "),
              briefTerms,
              style: opts.style
            }
          );

          const adjustedScore = adjustScore(score.total, finalName, rawCandidate.method, opts.style);
          const floor = modelId === "m3" ? 38 : modelId === "m5" ? 36 : 40;
          if (adjustedScore < floor) continue;

          seen.add(finalName);
          pool.push(
            buildBlend(
              { ...rawCandidate, name: finalName },
              modelId,
              a,
              b,
              pick(tldPool) || ".com",
              { ...score, total: adjustedScore },
              opts.style
            )
          );

          if (pool.length >= targetPool) break;
        }

        if (pool.length >= targetPool) break;
      }
    }

    if (attempt % 40 === 0) {
      const percent = Math.min(96, Math.round((attempt / maxAttempts) * 96));
      onProgress?.({ phase: "generating", percent, found: Math.min(pool.length, count) });
      await yieldToBrowser();
    }
  }

  onProgress?.({ phase: "finishing", percent: 98, found: Math.min(pool.length, count) });
  const result = diversify(pool, count, customPool);
  onProgress?.({ phase: "finishing", percent: 100, found: result.length });
  return result;
}

export const generate = generateAsync;
export const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
