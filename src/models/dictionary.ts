import type { WordEntry } from "../data/types";
import { briefFit, categoryFit, lengthFit, sourceSignal, weighted } from "./common";
import type { GeneratedEvidence } from "./contract";

export type DictionaryCandidate = {
  name: string;
  a: WordEntry;
  b?: WordEntry;
  method: "dictionary-one-word" | "dictionary-two-word";
  score: number;
  evidence: GeneratedEvidence;
};

function scoreOne(word: WordEntry, briefTerms: string[]) {
  return weighted([
    [lengthFit(word.word), 28],
    [sourceSignal(word, word, briefTerms), 24],
    [briefFit(word, word, briefTerms), 22],
    [word.sources.includes("top") || word.sources.includes("popular") ? 92 : 72, 16],
    [word.categories.length > 1 ? 84 : 68, 10]
  ]);
}

function scoreTwo(a: WordEntry, b: WordEntry, briefTerms: string[]) {
  return weighted([
    [lengthFit(a.word + b.word), 24],
    [sourceSignal(a, b, briefTerms), 22],
    [briefFit(a, b, briefTerms), 20],
    [categoryFit(a, b), 16],
    [a.sources.includes("top") || b.sources.includes("top") || a.sources.includes("popular") || b.sources.includes("popular") ? 86 : 70, 10],
    [a.categories.filter(category => b.categories.includes(category)).length ? 90 : 65, 8]
  ]);
}

export function dictionaryOne(entries: WordEntry[], count: number, briefTerms: string[]) {
  const ranked = entries
    .map(entry => ({
      name: entry.word,
      a: entry,
      method: "dictionary-one-word" as const,
      score: scoreOne(entry, briefTerms)
    }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, count).map(item => {
    const evidence: GeneratedEvidence = {
      modelScore: item.score,
      dimensions: {
        length: lengthFit(item.name),
        sourceSignal: sourceSignal(item.a, item.a, briefTerms),
        briefFit: briefFit(item.a, item.a, briefTerms)
      },
      rationale: ["Pure dictionary word", "No fusion or spelling transformation"],
      sourceWords: [item.a.word, item.a.word],
      categories: item.a.categories
    };

    return { ...item, evidence };
  });
}

export function dictionaryTwo(entries: WordEntry[], count: number, briefTerms: string[]) {
  const candidates: DictionaryCandidate[] = [];
  const seen = new Set<string>();
  const limit = Math.min(entries.length, 180);

  for (let i = 0; i < limit; i += 1) {
    for (let j = 0; j < limit; j += 1) {
      if (i === j) continue;
      const a = entries[i];
      const b = entries[j];
      const name = a.word + b.word;
      if (name.length < 5 || name.length > 16 || seen.has(name)) continue;
      seen.add(name);
      const score = scoreTwo(a, b, briefTerms);
      candidates.push({
        name,
        a,
        b,
        method: "dictionary-two-word",
        score,
        evidence: {
          modelScore: score,
          dimensions: {
            length: lengthFit(name),
            sourceSignal: sourceSignal(a, b, briefTerms),
            briefFit: briefFit(a, b, briefTerms),
            categoryFit: categoryFit(a, b)
          },
          rationale: ["Pure two-word dictionary combination", "No fusion or spelling transformation"],
          sourceWords: [a.word, b.word],
          categories: [...new Set([...a.categories, ...b.categories])]
        }
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, count);
}
