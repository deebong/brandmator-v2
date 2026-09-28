const VOWELS = "aeiouy";
const CONSONANTS = "bcdfghjklmnpqrstvwxz";

const COMMON_VOWEL_PAIRS = new Set([
  "ai", "au", "ay", "ea", "ee", "ei", "ie", "oi", "oo", "ou", "oy", "ua", "ue", "ui", "ia", "io", "eo"
]);

const COMMON_CONSONANT_CLUSTERS = new Set([
  "bl", "br", "ch", "cl", "cr", "dr", "dw", "fl", "fr", "gl", "gr", "kl", "kr", "pl", "pr", "sc",
  "sh", "sk", "sl", "sm", "sn", "sp", "st", "sw", "th", "tr", "tw", "wr",
  "ck", "ct", "ft", "ld", "lf", "lm", "lp", "lt", "mp", "nd", "ng", "nk", "ns", "nt", "pt", "rd",
  "rk", "rl", "rm", "rn", "rs", "rt", "sk", "sp", "ss", "st", "ts", "ks", "ps"
]);

const COMMON_TRIPLES = new Set([
  "str", "spr", "scr", "spl", "thr", "shr", "sch", "ckr", "ndr", "ntr", "stl"
]);

const BAD_PATTERNS = [
  /fuck/, /shit/, /porn/, /rape/, /nazi/, /suicide/, /terror/,
  /q(?!u)/, /xq/, /qz/, /jq/, /jv/
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

const isVowel = (c: string) => VOWELS.includes(c);
const isConsonant = (c: string) => CONSONANTS.includes(c);

function runs(word: string, vowel: boolean): string[] {
  const output: string[] = [];
  let current = "";
  for (const char of word) {
    if (isVowel(char) === vowel) current += char;
    else if (current) {
      output.push(current);
      current = "";
    }
  }
  if (current) output.push(current);
  return output;
}

function transitionDensity(word: string): number {
  if (word.length < 2) return 0;
  let changes = 0;
  for (let i = 1; i < word.length; i += 1) {
    if (isVowel(word[i]) !== isVowel(word[i - 1])) changes += 1;
  }
  return changes / (word.length - 1);
}

function unusualClusterPenalty(word: string): number {
  let penalty = 0;
  for (const cluster of runs(word, false)) {
    if (cluster.length === 2 && !COMMON_CONSONANT_CLUSTERS.has(cluster)) penalty += 7;
    if (cluster.length === 3 && !COMMON_TRIPLES.has(cluster)) penalty += 12;
    if (cluster.length > 3) penalty += 24;
  }
  return penalty;
}

function vowelFlowPenalty(word: string): number {
  let penalty = 0;
  for (const group of runs(word, true)) {
    if (group.length <= 1) continue;
    if (group.length === 2) {
      if (!COMMON_VOWEL_PAIRS.has(group)) penalty += 5;
    } else {
      penalty += 12 + (group.length - 3) * 4;
    }
  }
  return penalty;
}

export type NameShape = {
  normalized: string;
  syllables: number;
  vowelRatio: number;
  transitionDensity: number;
  maxConsonantRun: number;
  maxVowelRun: number;
  clusterPenalty: number;
  vowelFlowPenalty: number;
  patternScore: number;
  phoneticScore: number;
};

export function analyzeNameShape(value: string): NameShape {
  const word = normalize(value);
  const vowelRuns = runs(word, true);
  const consonantRuns = runs(word, false);
  const vowelRatio = [...word].filter(isVowel).length / Math.max(1, word.length);
  const density = transitionDensity(word);
  const maxConsonantRun = Math.max(0, ...consonantRuns.map(x => x.length));
  const maxVowelRun = Math.max(0, ...vowelRuns.map(x => x.length));
  const clusterPenalty = unusualClusterPenalty(word);
  const vowelFlowPenaltyValue = vowelFlowPenalty(word);

  let patternScore = 8;
  const perfectlyAlternating = density >= 0.90 && maxConsonantRun <= 1 && maxVowelRun <= 1;
  if (perfectlyAlternating) patternScore += 9;
  else if (density >= 0.42 && density <= 0.78) patternScore += 9;
  else if (density >= 0.32 && density <= 0.86) patternScore += 4;
  else patternScore -= 7;

  if (vowelRatio >= 0.30 && vowelRatio <= 0.52) patternScore += 5;
  else if (vowelRatio >= 0.25 && vowelRatio <= 0.58) patternScore += 2;
  else patternScore -= 7;

  if (maxConsonantRun <= 2) patternScore += 4;
  else if (maxConsonantRun === 3) patternScore += 1;
  else patternScore -= 12;

  if (maxVowelRun <= 1) patternScore += 3;
  else if (maxVowelRun === 2 && vowelFlowPenaltyValue === 0) patternScore += 2;
  else if (maxVowelRun >= 3) patternScore -= 10;

  const syllables = vowelRuns.length;
  if (syllables >= 2 && syllables <= 3) patternScore += 4;
  else if (syllables === 1) patternScore += 1;
  else if (syllables === 4) patternScore -= 1;
  else if (syllables > 4) patternScore -= 8;

  patternScore -= Math.min(18, clusterPenalty);
  patternScore -= Math.min(15, vowelFlowPenaltyValue);

  let phoneticScore = Math.round(density * 12);
  phoneticScore -= Math.min(16, clusterPenalty);
  phoneticScore -= Math.min(12, vowelFlowPenaltyValue);

  if (/^(.)\1/.test(word)) phoneticScore -= 4;
  if (/(.)\1/.test(word)) phoneticScore -= 3;
  if (/^[aeiou]/.test(word)) phoneticScore += 2;
  if (/[aeiouy]$/.test(word)) phoneticScore += 2;
  if (/(ly|io|eo|ia|ra|ify|ora|ix|um|z|x|r)$/.test(word)) phoneticScore += 3;

  return {
    normalized: word,
    syllables,
    vowelRatio,
    transitionDensity: density,
    maxConsonantRun,
    maxVowelRun,
    clusterPenalty,
    vowelFlowPenalty: vowelFlowPenaltyValue,
    patternScore,
    phoneticScore: Math.max(-12, Math.min(18, phoneticScore))
  };
}

export function passesNameQuality(value: string): boolean {
  const word = normalize(value);
  if (word.length < 4 || word.length > 12) return false;
  if (!/^[a-z]+$/.test(word)) return false;
  if (BAD_PATTERNS.some(pattern => pattern.test(word))) return false;
  if (/(.)\1\1/.test(word)) return false;

  const shape = analyzeNameShape(word);
  const compactMonosyllable =
    shape.syllables === 1 &&
    shape.vowelRatio >= 0.16 &&
    shape.maxConsonantRun <= 3 &&
    shape.clusterPenalty < 12;

  if ((!compactMonosyllable && shape.vowelRatio < 0.23) || shape.vowelRatio > 0.60) return false;
  if (shape.syllables < 1 || shape.syllables > 4) return false;
  if (shape.maxConsonantRun > 3 || shape.maxVowelRun > 2) return false;
  if (shape.transitionDensity < 0.28 || shape.transitionDensity > 0.88) {
    const alternating = shape.transitionDensity > 0.88 && shape.maxConsonantRun <= 1 && shape.maxVowelRun <= 1;
    if (!alternating) return false;
  }
  if (shape.clusterPenalty >= 15) return false;
  if (shape.vowelFlowPenalty >= 5 && shape.syllables > 1) return false;

  const ending = word.slice(-1);
  if (ending === "q" || ending === "j" || ending === "v") return false;
  return true;
}
