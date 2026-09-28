import type { Category, WordEntry } from "../data/types";
import { creativeWordVariants, fusePair, type FusionVariant } from "./fusion";
import { passesNameQuality } from "./quality";

export type ModelId = "m0" | "m1" | "m2" | "m3" | "m4" | "m5";
export type CandidateFamily = "fusion" | "spelling" | "prefix" | "semantic" | "experimental";

export type NamingModel = {
  id: ModelId;
  name: string;
  short: string;
  description: string;
  family: CandidateFamily;
};

export const NAMING_MODELS: NamingModel[] = [
  {
    id: "m0",
    name: "Model 0 · Blend All",
    short: "Blend All",
    description: "Explores every naming model and mixes their strongest candidates.",
    family: "experimental"
  },
  {
    id: "m1",
    name: "Model 1 · Inventive Fusion",
    short: "Inventive Fusion",
    description: "Strict two-word fusion with phonetic, CV-pattern and pronounceability gates.",
    family: "fusion"
  },
  {
    id: "m2",
    name: "Model 2 · Brand Spelling",
    short: "Brand Spelling",
    description: "Compression, respelling, controlled letter changes and familiar endings.",
    family: "spelling"
  },
  {
    id: "m3",
    name: "Model 3 · Prefix & Initial",
    short: "Prefix & Initial",
    description: "Prefix + root and initial-letter constructions where meaning can matter more than phonetics.",
    family: "prefix"
  },
  {
    id: "m4",
    name: "Model 4 · Semantic Wordform",
    short: "Semantic Wordform",
    description: "Keeps more of the recognizable source words while creating compact brand forms.",
    family: "semantic"
  },
  {
    id: "m5",
    name: "Model 5 · Experimental",
    short: "Experimental",
    description: "Looser transformations for surprising candidates that stricter models may reject.",
    family: "experimental"
  }
];

const vowels = "aeiouy";
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
const isVowel = (value: string) => vowels.includes(value);
const safe = (value: string) => value.length >= 4 && value.length <= 12 && /^[a-z]+$/.test(value);

function add(
  output: FusionVariant[],
  seen: Set<string>,
  name: string,
  method: string,
  gate: (value: string) => boolean
) {
  const value = normalize(name);
  if (!safe(value) || seen.has(value) || !gate(value)) return;
  seen.add(value);
  output.push({ name: value, method });
}

function strictGate(value: string) {
  return passesNameQuality(value);
}

function relaxedBrandGate(value: string) {
  if (!safe(value)) return false;
  if (/(.)\1\1/.test(value)) return false;
  if (/(fuck|shit|porn|rape|nazi|suicide|terror)/.test(value)) return false;
  return true;
}

function prefixGate(value: string, root: string) {
  if (!relaxedBrandGate(value)) return false;
  return value.endsWith(root) || value.includes(root.slice(0, Math.max(4, root.length - 1)));
}

function wordEntry(word: string, source: WordEntry): WordEntry {
  return {
    word,
    categories: source.categories,
    sources: source.sources,
    weight: source.weight
  };
}

function spellingCandidates(a: WordEntry, b: WordEntry): FusionVariant[] {
  const output: FusionVariant[] = [];
  const seen = new Set<string>();
  for (const entry of [a, b]) {
    for (const variant of creativeWordVariants(entry)) {
      add(output, seen, variant.name, variant.method, relaxedBrandGate);
    }
  }

  for (const fusion of [...fusePair(a.word, b.word), ...fusePair(b.word, a.word)]) {
    for (const variant of creativeWordVariants(wordEntry(fusion.name, a))) {
      add(output, seen, variant.name, variant.method + "(" + fusion.method + ")", relaxedBrandGate);
    }
  }
  return output;
}

function prefixCandidates(a: WordEntry, b: WordEntry, prefix: string): FusionVariant[] {
  const output: FusionVariant[] = [];
  const seen = new Set<string>();
  const roots = [a.word, b.word];
  const requested = normalize(prefix);

  for (const root of roots) {
    const prefixes = requested ? [requested] : ["i", "e", "o", root.slice(0, 1)];
    for (const value of prefixes) {
      add(output, seen, value + root, requested ? "user-prefix+" + root : "prefix-" + value + "+" + root, v => prefixGate(v, root));
    }
  }

  if (a.word && b.word) {
    add(output, seen, a.word.slice(0, 1) + b.word, "initial+" + b.word, v => prefixGate(v, b.word));
    add(output, seen, b.word.slice(0, 1) + a.word, "initial+" + a.word, v => prefixGate(v, a.word));
    add(output, seen, a.word.slice(0, 1) + b.word.slice(0, 1) + b.word, "initials+" + b.word, v => prefixGate(v, b.word));
  }

  return output;
}

function semanticCandidates(a: WordEntry, b: WordEntry, prefix: string, suffix: string): FusionVariant[] {
  const output: FusionVariant[] = [];
  const seen = new Set<string>();

  const addRootForms = (root: string, label: string) => {
    const clipped = root.length > 6 ? root.slice(0, 4) : root.slice(0, 3);
    add(output, seen, clipped + b.word, "semantic-clip(" + label + ")", strictGate);
    add(output, seen, root + b.word.slice(0, Math.max(3, Math.min(5, b.word.length))), "semantic-root(" + label + ")", strictGate);
  };

  addRootForms(a.word, "a+b");
  addRootForms(b.word, "b+a");
  add(output, seen, prefix + a.word, "semantic-prefix", v => prefixGate(v, a.word));
  add(output, seen, prefix + b.word, "semantic-prefix", v => prefixGate(v, b.word));
  add(output, seen, a.word + suffix, "semantic-suffix", relaxedBrandGate);
  add(output, seen, b.word + suffix, "semantic-suffix", relaxedBrandGate);

  for (const fusion of [...fusePair(a.word, b.word), ...fusePair(b.word, a.word)]) {
    if (fusion.name.length >= 6) {
      add(output, seen, fusion.name.slice(0, Math.min(7, fusion.name.length)), "semantic-fusion(" + fusion.method + ")", strictGate);
    }
  }

  return output;
}

function experimentalCandidates(a: WordEntry, b: WordEntry, prefix: string, suffix: string): FusionVariant[] {
  const output: FusionVariant[] = [];
  const seen = new Set<string>();
  const roots = [a.word, b.word, ...fusePair(a.word, b.word).map(v => v.name), ...fusePair(b.word, a.word).map(v => v.name)];

  for (const rootRaw of roots) {
    const root = normalize(rootRaw);
    if (!root) continue;

    add(output, seen, prefix + root, "experimental-prefix", relaxedBrandGate);
    add(output, seen, root + suffix, "experimental-suffix", relaxedBrandGate);

    const chars = [...root];
    if (chars.length >= 6) {
      for (let i = 1; i < chars.length - 2; i += 1) {
        if (!isVowel(chars[i])) continue;
        add(output, seen, chars.slice(0, i).concat(chars.slice(i + 1)).join(""), "experimental-vowel-drop", relaxedBrandGate);
        break;
      }
    }

    for (let i = 1; i < chars.length - 1; i += 1) {
      if (!isVowel(chars[i])) continue;
      for (const replacement of ["a", "e", "i", "o"]) {
        if (replacement === chars[i]) continue;
        const next = [...chars];
        next[i] = replacement;
        add(output, seen, next.join(""), "experimental-vowel-swap", relaxedBrandGate);
      }
      break;
    }
  }

  return output;
}

export function generateModelCandidates(
  modelId: ModelId,
  a: WordEntry,
  b: WordEntry,
  prefix: string,
  suffix: string
): FusionVariant[] {
  if (modelId === "m1") return [...fusePair(a.word, b.word), ...fusePair(b.word, a.word).map(v => ({ ...v, method: "reverse-" + v.method }))];
  if (modelId === "m2") return spellingCandidates(a, b);
  if (modelId === "m3") return prefixCandidates(a, b, prefix);
  if (modelId === "m4") return semanticCandidates(a, b, prefix, suffix);
  return experimentalCandidates(a, b, prefix, suffix);
}

export function modelMeta(id: ModelId): NamingModel {
  return NAMING_MODELS.find(model => model.id === id) || NAMING_MODELS[0];
}

export function blendModelCandidates(
  a: WordEntry,
  b: WordEntry,
  prefix: string,
  suffix: string
): Array<FusionVariant & { modelId: ModelId; family: CandidateFamily }> {
  const output: Array<FusionVariant & { modelId: ModelId; family: CandidateFamily }> = [];
  for (const model of NAMING_MODELS.slice(1)) {
    for (const variant of generateModelCandidates(model.id, a, b, prefix, suffix)) {
      output.push({ ...variant, modelId: model.id, family: model.family });
    }
  }
  return output;
}
