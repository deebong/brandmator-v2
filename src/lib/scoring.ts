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
  Math.min(10, Math.round((e.sources.length - 1) * 2 + Math.min(e.weight, 5) * 0.65));

const catBoost = (a: WordEntry, b: WordEntry) =>
  Math.min(7, a.categories.filter(category => b.categories.includes(category)).length * 2);

function methodBonus(method: string): number {
  if (method.includes("overlap")) return 8;
  if (method.includes("head+tail") || method.includes("tail+head")) return 6;
  if (method.includes("clip+clip")) return 5;
  if (method.includes("vowel-bridge")) return 4;
  if (method.includes("compressed-ending") || method.includes("vowel-drop")) return 6;
  if (method.includes("suffix-ify") || method.includes("suffix-ly") || method.includes("suffix-io")) return 5;
  if (method.includes("suffix-") || method.includes("prefix-") || method.includes("initial-")) return 3;
  if (method.includes("head+word") || method.includes("word+tail")) return 2;
  return 0;
}

export function scoreName(
  name: string,
  a: WordEntry,
  b: WordEntry,
  fusionMethod: string
): ScoreBreakdown {
  const w = name.toLowerCase().replace(/[^a-z]/g, "");
  const shape = analyzeNameShape(w);

  const length =
    w.length >= 5 && w.length <= 9 ? 18 :
    w.length === 4 || w.length === 10 ? 8 :
    w.length === 11 || w.length === 12 ? 2 : -8;

  const vowels =
    shape.vowelRatio >= 0.30 && shape.vowelRatio <= 0.52 ? 12 :
    shape.vowelRatio >= 0.25 && shape.vowelRatio <= 0.58 ? 5 : -10;

  let phonetics = shape.phoneticScore;
  if (w.length >= 5 && w.length <= 9) phonetics += 2;
  if (shape.syllables >= 2 && shape.syllables <= 3) phonetics += 2;
  phonetics = Math.max(-12, Math.min(18, phonetics));

  const pattern = Math.max(-8, Math.min(20, shape.patternScore));
  const sourceSignals = Math.min(14, srcBoost(a) + srcBoost(b));
  const categoryFit = catBoost(a, b);
  const method = methodBonus(fusionMethod);
  const riskPenalty = BAD.some(fragment => w.includes(fragment)) ? -40 : passesNameQuality(w) ? 0 : -30;

  const total = Math.max(
    1,
    Math.min(
      99,
      Math.round(32 + length + vowels + phonetics + pattern + sourceSignals + categoryFit + method + riskPenalty)
    )
  );

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
