import type { WordEntry } from "../data/types";
import type { ModelCandidate } from "./contract";

export const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
export const isSafeName = (value: string) => /^[a-z]+$/.test(value) && value.length >= 3 && value.length <= 16;

export function collect(
  output: ModelCandidate[],
  seen: Set<string>,
  name: string,
  method: string,
  gate: (value: string) => boolean = isSafeName,
  evidence: string[] = []
) {
  const value = normalize(name);
  if (!value || seen.has(value) || !gate(value)) return;
  seen.add(value);
  output.push({ name: value, method, evidence });
}

export function sourceSignal(a: WordEntry, b: WordEntry, briefTerms: string[] = []) {
  const sourceRichness = new Set([...a.sources, ...b.sources]).size;
  const sourceScore = Math.min(100, 38 + sourceRichness * 12);
  const briefHits = briefTerms.filter(term => term === a.word || term === b.word).length;
  return Math.min(100, sourceScore + briefHits * 10);
}

export function categoryFit(a: WordEntry, b: WordEntry) {
  const overlap = a.categories.filter(category => b.categories.includes(category)).length;
  return Math.min(100, 48 + overlap * 18);
}

export function briefFit(a: WordEntry, b: WordEntry, terms: string[]) {
  if (!terms.length) return 55;
  const hits = terms.filter(term => term === a.word || term === b.word).length;
  const partial = terms.filter(term =>
    a.word.startsWith(term) || b.word.startsWith(term) || term.startsWith(a.word) || term.startsWith(b.word)
  ).length;
  return Math.min(100, 42 + hits * 25 + Math.min(18, partial * 6));
}

export function lengthFit(name: string, idealMin = 6, idealMax = 9) {
  if (name.length >= idealMin && name.length <= idealMax) return 100;
  if (name.length === idealMin - 1 || name.length === idealMax + 1) return 86;
  if (name.length === 4 || name.length === 10) return 70;
  if (name.length === 3 || name.length === 11) return 52;
  return 35;
}

export function rootRetention(name: string, root: string) {
  const candidate = normalize(name);
  const source = normalize(root);
  if (candidate === source) return 100;
  if (candidate.includes(source)) return 96;
  if (source.includes(candidate) && candidate.length >= 4) return 82;
  const common = [...candidate].filter((char, index) => source[index] === char).length;
  return Math.min(90, 45 + Math.round((common / Math.max(1, source.length)) * 45));
}

export function weighted(parts: Array<[value: number, weight: number]>) {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  return Math.max(1, Math.min(99, Math.round(parts.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight)));
}
