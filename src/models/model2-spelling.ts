import { creativeWordVariants, fusePair } from "../lib/fusion";
import { isSafeName } from "./common";
import { briefFit, categoryFit, collect, lengthFit, rootRetention, sourceSignal, weighted } from "./common";
import { scoringText } from "./scoring/common";
import type { NamingModel } from "./contract";

export const MODEL_2: NamingModel = {
  id: "m2",
  name: "Model 2 · Brand Spelling",
  short: "Brand Spelling",
  description: "Compression, respelling, controlled letter changes and familiar brand endings.",
  family: "spelling",

  generate: ({ a, b }) => {
    const output = [];
    const seen = new Set<string>();
    for (const entry of [a, b]) {
      for (const variant of creativeWordVariants(entry)) {
        collect(output, seen, variant.name, variant.method, isSafeName, ["controlled spelling"]);
      }
    }
    for (const fusion of [...fusePair(a.word, b.word), ...fusePair(b.word, a.word)]) {
      for (const variant of creativeWordVariants({ ...a, word: fusion.name })) {
        collect(output, seen, variant.name, variant.method + "(" + fusion.method + ")", isSafeName, ["fusion-derived spelling"]);
      }
    }
    return output;
  },

  accept: candidate => isSafeName(candidate.name),
  score: (candidate, { a, b, briefTerms }) => {
    const shape = scoringText(candidate.name);
    const retention = Math.max(rootRetention(candidate.name, a.word), rootRetention(candidate.name, b.word));
    const ending = /(ly|io|eo|ify|ora|ix|um|ia|ra|z|x|r|y)$/.test(candidate.name) ? 95 : 70;
    const transformation = candidate.method.includes("vowel") || candidate.method.includes("initial") || candidate.method.includes("suffix")
      ? 96
      : 82;

    const total = weighted([
      [shape.pronounceability, 21],
      [shape.flow, 17],
      [retention, 17],
      [transformation, 14],
      [ending, 10],
      [lengthFit(candidate.name), 9],
      [sourceSignal(a, b, briefTerms), 6],
      [briefFit(a, b, briefTerms), 4],
      [categoryFit(a, b), 2]
    ]);

    return {
      total,
      dimensions: {
        pronounceability: shape.pronounceability,
        phoneticFlow: shape.flow,
        rootRetention: retention,
        transformation,
        brandEnding: ending,
        length: lengthFit(candidate.name),
        sourceSignal: sourceSignal(a, b, briefTerms),
        briefFit: briefFit(a, b, briefTerms),
        categoryFit: categoryFit(a, b)
      },
      rationale: ["Brand-spelling model", "Rewards recognizable transformations and intentional endings"]
    };
  }
};
