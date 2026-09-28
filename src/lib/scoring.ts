import type { WordEntry } from "../data/types";
import { analyzeNameShape, passesNameQuality } from "./quality";

const BAD = ["fuck", "shit", "porn", "rape", "nazi", "suicide", "terror"];

export type ScoreBreakdown = {
  length: number;
  vowels: number;
  phonetics: number;
  pattern: number;
  sourceSignals: number;
  categoryFit: number;
  method: number;
  riskPenalty: number;
  total: number;
};

const srcBoost = (e: WordEntry) =>
  Math.min(12, Math.round((e.sources.length - 1) * 2 + Math.min(e.weight, 5) * 0.55));

const catBoost = (a: WordEntry, b: WordEntry) =>
  Math.min(6, a.categories.filter(category => b.categories.includes(category)).length * 2);

function methodBonus(fusionMethod: string): number {
  if (fusionMethod.includes("overlap")) return 7;
  if (fusionMethod.includes("head+tail") || fusionMethod.includes("tail+head")) return 6;
  if (fusionMethod.includes("clip+clip")) return 5;
  if (fusionMethod.includes("vowel-bridge")) return 4;
  if (fusionMethod.includes("compressed-ending") || fusionMethod.includes("vowel-drop")) return 5;
  if (fusionMethod.includes("suffix-ify") || fusionMethod.includes("suffix-ly") || fusionMethod.includes("suffix-io")) return 5;
  if (fusionMethod.includes("user-prefix") || fusionMethod.includes("initial")) return 7;
  if (fusionMethod.includes("suffix-") || fusionMethod.includes("prefix-")) return 3;
  if (fusionMethod.includes("head+word") || fusionMethod.includes("word+tail")) return 2;
  return 1;
}

export function scoreName(
  name: string,
  a: WordEntry,
  b: WordEntry,
  fusionMethod: string
): ScoreBreakdown {
  const w = name.toLowerCase().replace(/[^a-z]/g, "");
  const shape = analyzeNameShape(w);

  const length = (() => {
    if (w.length >= 6 && w.length <= 9) return 16;
    if (w.length === 5 || w.length === 10) return 12;
    if (w.length === 4 || w.length === 11) return 8;
    if (w.length === 12) return 4;
    return 0;
  })();

  const vowels =
    shape.vowelRatio >= 0.31 && shape.vowelRatio <= 0.52 ? 10 :
    shape.vowelRatio >= 0.25 && shape.vowelRatio <= 0.58 ? 7 :
    shape.vowelRatio >= 0.20 && shape.vowelRatio <= 0.62 ? 3 : 0;

  const phonetics = Math.max(-2, Math.min(16,
    shape.phoneticScore +
    (shape.syllables >= 2 && shape.syllables <= 3 ? 3 : shape.syllables === 1 ? 1 : 0)
  ));

  const pattern = Math.max(0, Math.min(14, shape.patternScore));
  const sourceSignals = Math.min(12, srcBoost(a) + srcBoost(b));
  const categoryFit = catBoost(a, b);
  const method = methodBonus(fusionMethod);

  // Only apply a catastrophic penalty for explicit risk terms or a failed quality gate.
  const riskPenalty =
    BAD.some(fragment => w.includes(fragment)) ? -45 :
    passesNameQuality(w) ? 0 : -24;

  // Deliberately budgeted to avoid the previous "everything becomes 99" ceiling.
  const raw = 4 + length + vowels + phonetics + pattern + sourceSignals + categoryFit + method + riskPenalty;
  const total = Math.max(1, Math.min(99, Math.round(raw)));

  return {
    length,
    vowels,
    phonetics,
    pattern,
    sourceSignals,
    categoryFit,
    method,
    riskPenalty,
    total
  };
}
