import { fusePair } from "../lib/fusion";
import { isSafeName, normalize, collect } from "./common";
import { lengthFit, weighted } from "./common";
import type { NamingModel } from "./contract";

const VOWELS = "aeiouy";
const isVowel = (value: string) => VOWELS.includes(value);

export const MODEL_5: NamingModel = {
  id: "m5",
  name: "Model 5 · Experimental",
  short: "Experimental",
  description: "Looser transformations for unexpected candidates that strict models may miss.",
  family: "experimental",

  generate: ({ a, b, prefix, suffix }) => {
    const output = [];
    const seen = new Set<string>();
    const roots = [a.word, b.word, ...fusePair(a.word, b.word).map(v => v.name), ...fusePair(b.word, a.word).map(v => v.name)];

    for (const rootRaw of roots) {
      const root = normalize(rootRaw);
      if (!root) continue;

      if (prefix) collect(output, seen, prefix + root, "experimental-prefix", isSafeName, ["user prefix"]);
      if (suffix) collect(output, seen, root + suffix, "experimental-suffix", isSafeName, ["user suffix"]);

      const chars = [...root];
      if (chars.length >= 6) {
        for (let i = 1; i < chars.length - 2; i += 1) {
          if (!isVowel(chars[i])) continue;
          collect(output, seen, chars.slice(0, i).concat(chars.slice(i + 1)).join(""), "experimental-vowel-drop", isSafeName, ["vowel compression"]);
          break;
        }
      }

      if (chars.length >= 5 && !isVowel(chars[0])) {
        for (const replacement of ["z", "j", "v", "k"]) {
          if (replacement === chars[0]) continue;
          collect(output, seen, replacement + chars.slice(1).join(""), "experimental-initial-" + replacement, isSafeName, ["initial substitution"]);
        }
      }
    }

    return output;
  },

  accept: candidate => isSafeName(candidate.name),
  score: (candidate, context) => {
    const { a, b } = context;
    const length = lengthFit(candidate.name);
    const surprise = candidate.method.includes("initial") || candidate.method.includes("vowel")
      ? 92
      : candidate.method.includes("prefix") || candidate.method.includes("suffix")
        ? 84
        : 78;
    const recognizable = Math.max(
      candidate.name.includes(a.word) ? 92 : 68,
      candidate.name.includes(b.word) ? 92 : 68
    );

    const total = weighted([
      [surprise, 32],
      [recognizable, 22],
      [length, 20],
      [72, 14],
      [58, 12]
    ]);

    return {
      total,
      dimensions: {
        creativity: surprise,
        recognizability: recognizable,
        length,
        compactness: 72,
        experimentation: 58
      },
      rationale: ["Experimental model", "Deliberately tolerates constructions stricter models may reject"]
    };
  }
};
