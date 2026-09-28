import { fusePair } from "../lib/fusion";
import { isSafeName, collect } from "./common";
import { briefFit, categoryFit, lengthFit, rootRetention, sourceSignal, weighted } from "./common";
import type { NamingModel } from "./contract";

export const MODEL_4: NamingModel = {
  id: "m4",
  name: "Model 4 · Semantic Wordform",
  short: "Semantic Wordform",
  description: "Recognizer-friendly names that preserve useful source words and concepts.",
  family: "semantic",

  generate: ({ a, b, prefix, suffix }) => {
    const output = [];
    const seen = new Set<string>();

    // Deliberately allow untouched dictionary words here. Availability is a later domain layer.
    collect(output, seen, a.word, "dictionary-word", isSafeName, ["recognizable source word"]);
    collect(output, seen, b.word, "dictionary-word", isSafeName, ["recognizable source word"]);

    const clippedA = a.word.length > 6 ? a.word.slice(0, 5) : a.word.slice(0, 4);
    const clippedB = b.word.length > 6 ? b.word.slice(0, 5) : b.word.slice(0, 4);
    collect(output, seen, clippedA + b.word, "semantic-clip(a+b)", isSafeName, ["semantic root retained"]);
    collect(output, seen, clippedB + a.word, "semantic-clip(b+a)", isSafeName, ["semantic root retained"]);

    for (const fusion of [...fusePair(a.word, b.word), ...fusePair(b.word, a.word)]) {
      if (fusion.name.length >= 5) {
        collect(output, seen, fusion.name, "semantic-fusion(" + fusion.method + ")", isSafeName, ["fusion with recognizable roots"]);
      }
    }

    if (prefix.trim()) {
      collect(output, seen, prefix + a.word, "semantic-prefix", isSafeName, ["user prefix"]);
      collect(output, seen, prefix + b.word, "semantic-prefix", isSafeName, ["user prefix"]);
    }
    if (suffix.trim()) {
      collect(output, seen, a.word + suffix, "semantic-suffix", isSafeName, ["user suffix"]);
      collect(output, seen, b.word + suffix, "semantic-suffix", isSafeName, ["user suffix"]);
    }

    return output;
  },

  score: (candidate, { a, b, briefTerms }) => {
    const readable = candidate.method === "dictionary-word" ? 98 : 84;
    const retention = Math.max(rootRetention(candidate.name, a.word), rootRetention(candidate.name, b.word));
    const semantic = briefFit(a, b, briefTerms);
    const distinction = candidate.method === "dictionary-word" ? 66 : 86;

    const total = weighted([
      [readable, 22],
      [retention, 24],
      [semantic, 20],
      [sourceSignal(a, b, briefTerms), 12],
      [categoryFit(a, b), 8],
      [lengthFit(candidate.name), 8],
      [distinction, 6]
    ]);

    return {
      total,
      dimensions: {
        readability: readable,
        rootRetention: retention,
        semanticFit: semantic,
        sourceSignal: sourceSignal(a, b, briefTerms),
        categoryFit: categoryFit(a, b),
        length: lengthFit(candidate.name),
        distinction
      },
      rationale: [
        candidate.method === "dictionary-word"
          ? "Recognizer-friendly dictionary candidate"
          : "Semantic/root-preserving construction"
      ]
    };
  }
};
