export type Category = "tech" | "ai" | "business" | "finance" | "commerce" | "health" | "creative" | "nature" | "energy" | "food" | "science" | "mythic" | "abstract";
export type WordSource = "core" | "top" | "popular" | "trending" | "company" | "sales";
export type WordSeed = [word: string, categories: Category[]];
export type WordKind = "dictionary" | "brandable";
export type WordEntry = {
  word: string;
  categories: Category[];
  sources: WordSource[];
  weight: number;
  kind: WordKind;
};