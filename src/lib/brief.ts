import type { WordEntry } from "../data/types";

const STOP = new Set([
  "a","an","and","are","as","at","be","by","for","from","in","into","is","it","its","of","on","or","our","that","the",
  "this","to","with","we","you","your","their","they","will","can","using","use","build","building","make","making",
  "startup","company","business","brand","product","platform","service"
]);

export function extractBriefTerms(brief: string, library: WordEntry[]) {
  const tokens = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map(token => token.replace(/^-+|-+$/g, ""))
    .filter(token => token.length >= 3 && !STOP.has(token));

  const available = new Set(library.map(entry => entry.word));
  const matched = new Set<string>();

  for (const token of tokens) {
    if (available.has(token)) matched.add(token);
  }

  return [...matched].slice(0, 16);
}
