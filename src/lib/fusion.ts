import type { WordEntry } from "../data/types";
import { passesNameQuality } from "./quality";

const VOWELS = "aeiouy";
const isV = (c: string) => VOWELS.includes(c);
const normalize = (w: string) => w.toLowerCase().replace(/[^a-z]/g, "");

const head = (w: string) => {
  let i = 0;
  while (i < w.length && !isV(w[i])) i += 1;
  while (i < w.length && isV(w[i])) i += 1;
  return Math.max(2, Math.min(i, w.length));
};

const tail = (w: string) => {
  let i = w.length - 1;
  while (i >= 0 && !isV(w[i])) i -= 1;
  while (i >= 0 && isV(w[i])) i -= 1;
  return Math.max(1, i + 1);
};

const clean = (w: string) =>
  normalize(w)
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/([aeiouy])\1+/g, "$1");

function overlap(a: string, b: string) {
  for (let n = Math.min(4, a.length - 1, b.length - 1); n >= 2; n -= 1) {
    if (a.slice(-n) === b.slice(0, n)) return a + b.slice(n);
  }
  return a.slice(-1) === b[0] ? a + b.slice(1) : null;
}

function bridge(a: string, b: string) {
  const av = [...a].reverse().find(isV);
  const bv = [...b].find(isV);
  if (!av || !bv || av === bv) return null;
  return clean(a.slice(0, -1) + bv + b.slice(1));
}

/*
 * Controlled brand-spelling transformations:
 * suffixes, short prefixes, vowel compression, and initial consonant shifts.
 */
const SUFFIXES = ["ly", "io", "eo", "z", "x", "r", "y", "ia", "ify", "ora", "ix", "um", "ra"];
const PREFIXES = ["i", "e", "o"];
const CREATIVE_INITIALS = ["z", "j", "v", "k"];

function creativeVariants(raw: string): FusionVariant[] {
  const root = normalize(raw);
  if (!root || root.length < 4) return [];

  const output: FusionVariant[] = [];
  const add = (name: string, method: string) => {
    const value = clean(name);
    if (!value || value === root || !passesNameQuality(value)) return;
    output.push({ name: value, method });
  };

  for (const suffix of SUFFIXES) {
    if (root.length <= 10) add(root + suffix, `suffix-${suffix}`);
  }

  for (const prefix of PREFIXES) {
    if (root.length <= 9) add(prefix + root, `prefix-${prefix}`);
  }

  if (root.length >= 6) {
    const chars = [...root];

    // Terminal-vowel compression: flicker -> flickr, censored -> censord.
    const terminalVowelIndex = chars.length - 2;
    if (terminalVowelIndex > 1 && isV(chars[terminalVowelIndex]) && !isV(chars[chars.length - 1])) {
      add(
        chars.slice(0, terminalVowelIndex).join("") + chars.slice(terminalVowelIndex + 1).join(""),
        "compressed-ending"
      );
    }

    // One internal vowel removal for a compact spelling family.
    for (let i = 1; i < chars.length - 2; i += 1) {
      if (!isV(chars[i])) continue;
      const candidate = chars.slice(0, i).concat(chars.slice(i + 1)).join("");
      if (candidate.length >= 5) {
        add(candidate, "vowel-drop");
        break;
      }
    }
  }

  if (!isV(root[0]) && root.length >= 5) {
    for (const initial of CREATIVE_INITIALS) {
      if (initial === root[0]) continue;
      add(initial + root.slice(1), `initial-${initial}`);
    }
  }

  return output;
}

export type FusionVariant = { name: string; method: string };

export function fusePair(aRaw: string, bRaw: string): FusionVariant[] {
  const a = normalize(aRaw);
  const b = normalize(bRaw);
  if (!a || !b || a === b) return [];

  const ah = head(a);
  const at = tail(a);
  const bh = head(b);
  const bt = tail(b);

  const raw: FusionVariant[] = [
    { name: a.slice(0, ah) + b.slice(bt), method: "head+tail" },
    { name: b.slice(0, bh) + a.slice(at), method: "tail+head" },
    { name: a.slice(0, ah) + b.slice(0, bh), method: "clip+clip" },
    { name: a.slice(0, ah) + b, method: "head+word" },
    { name: a + b.slice(bt), method: "word+tail" },
    { name: a.slice(0, at) + b, method: "last-vowel+word" },
    { name: overlap(a, b) || "", method: "overlap" },
    { name: bridge(a, b) || "", method: "vowel-bridge" }
  ];

  const base = raw
    .map(v => ({ ...v, name: clean(v.name) }))
    .filter(v => v.name.length >= 4 && v.name.length <= 10 && passesNameQuality(v.name));

  const seen = new Set<string>();
  return base.filter(v => {
    if (!v.name || seen.has(v.name)) return false;
    seen.add(v.name);
    return true;
  });
}

export function creativeWordVariants(word: WordEntry): FusionVariant[] {
  return creativeVariants(word.word);
}
