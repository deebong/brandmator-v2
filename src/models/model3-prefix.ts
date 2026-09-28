import { isSafeName, normalize, collect } from "./common";
import { briefFit, categoryFit, lengthFit, rootRetention, sourceSignal, weighted } from "./common";
import type { NamingModel } from "./contract";

const BAD = /(fuck|shit|porn|rape|nazi|suicide|terror)/;

export const MODEL_3: NamingModel = {
  id: "m3",
  name: "Model 3 · Prefix & Initial",
  short: "Prefix & Initial",
  description: "Prefix + root, initial-letter and semantic short-prefix structures.",
  family: "prefix",

  generate: ({ a, b, prefix }) => {
    const output = [];
    const seen = new Set<string>();
    const roots = [a.word, b.word];
    const requested = normalize(prefix);

    for (const root of roots) {
      const prefixes = requested ? [requested] : ["i", "e", "o", root.slice(0, 1)];
      for (const value of prefixes) {
        collect(output, seen, value + root, requested ? "user-prefix+" + root : "prefix-" + value + "+" + root, value => isSafeName(value) && !BAD.test(value), [
          requested ? "user-selected prefix" : "short prefix",
          "root retained"
        ]);
      }
    }

    collect(output, seen, a.word.slice(0, 1) + b.word, "initial+" + b.word, value => isSafeName(value) && !BAD.test(value), ["initial + root"]);
    collect(output, seen, b.word.slice(0, 1) + a.word, "initial+" + a.word, value => isSafeName(value) && !BAD.test(value), ["initial + root"]);

    return output;
  },

  score: (candidate, { a, b, briefTerms }) => {
    const sourceRoot = candidate.name.includes(a.word) ? a.word : candidate.name.includes(b.word) ? b.word : a.word;
    const retention = rootRetention(candidate.name, sourceRoot);
    const prefixLength = Math.max(1, candidate.name.length - sourceRoot.length);
    const prefixClarity = prefixLength <= 2 ? 96 : prefixLength <= 3 ? 84 : 68;
    const semantic = briefFit(a, b, briefTerms);

    const total = weighted([
      [retention, 28],
      [prefixClarity, 18],
      [semantic, 18],
      [sourceSignal(a, b, briefTerms), 10],
      [categoryFit(a, b), 8],
      [lengthFit(candidate.name), 10],
      [candidate.name.includes(a.word) || candidate.name.includes(b.word) ? 94 : 70, 8]
    ]);

    return {
      total,
      dimensions: {
        rootRetention: retention,
        prefixClarity,
        semanticFit: semantic,
        sourceSignal: sourceSignal(a, b, briefTerms),
        categoryFit: categoryFit(a, b),
        length: lengthFit(candidate.name)
      },
      rationale: ["Prefix/initialism model", "Meaning and root retention prioritized over strict phonetic rules"]
    };
  }
};
