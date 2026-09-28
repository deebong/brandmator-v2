import { fusePair } from "../lib/fusion";
import { passesNameQuality } from "../lib/quality";
import { briefFit, categoryFit, collect, lengthFit, sourceSignal, weighted } from "./common";
import { scoringText } from "./scoring/common";
import type { NamingModel } from "./contract";

export const MODEL_1: NamingModel = {
  id: "m1",
  name: "Model 1 · Inventive Fusion",
  short: "Inventive Fusion",
  description: "Strict two-word fusion with model-specific phonetic, CV-pattern and pronounceability scoring.",
  family: "fusion",

  generate: ({ a, b, briefTerms }) => {
    const output = [];
    const seen = new Set<string>();
    const variants = [...fusePair(a.word, b.word), ...fusePair(b.word, a.word).map(v => ({ ...v, method: "reverse-" + v.method }))];

    for (const variant of variants) {
      collect(output, seen, variant.name, variant.method, value => passesNameQuality(value), [
        "two-word fusion",
        briefTerms.includes(a.word) || briefTerms.includes(b.word) ? "brief-aligned" : "source-driven"
      ]);
    }

    return output;
  },

  accept: candidate => passesNameQuality(candidate.name),
  score: (candidate, { a, b, briefTerms }) => {
    const shape = scoringText(candidate.name);
    const method = candidate.method.includes("overlap")
      ? 98
      : candidate.method.includes("head+tail") || candidate.method.includes("tail+head")
        ? 91
        : candidate.method.includes("vowel-bridge")
          ? 86
          : 78;

    const total = weighted([
      [shape.flow, 25],
      [shape.pattern, 20],
      [shape.pronounceability, 20],
      [lengthFit(candidate.name), 12],
      [sourceSignal(a, b, briefTerms), 8],
      [categoryFit(a, b), 6],
      [briefFit(a, b, briefTerms), 5],
      [method, 4]
    ]);

    return {
      total,
      dimensions: {
        phoneticFlow: shape.flow,
        cvPattern: shape.pattern,
        pronounceability: shape.pronounceability,
        length: lengthFit(candidate.name),
        sourceSignal: sourceSignal(a, b, briefTerms),
        categoryFit: categoryFit(a, b),
        briefFit: briefFit(a, b, briefTerms),
        method
      },
      rationale: ["Strict fusion model", "Passed phonetic/CV quality gate"]
    };
  }
};
