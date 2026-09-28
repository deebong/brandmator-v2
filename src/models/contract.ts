import type { Category, WordEntry } from "../data/types";

export type ModelId = "m0" | "m1" | "m2" | "m3" | "m4" | "m5";
export type ModelFamily = "blend" | "dictionary" | "fusion" | "spelling" | "prefix" | "semantic" | "experimental";

export type ModelContext = {
  a: WordEntry;
  b: WordEntry;
  prefix: string;
  suffix: string;
  briefTerms: string[];
};

export type ModelCandidate = {
  name: string;
  method: string;
  evidence?: string[];
};

export type ModelScore = {
  total: number;
  dimensions: Record<string, number>;
  rationale: string[];
};

export type NamingModel = {
  id: Exclude<ModelId, "m0">;
  name: string;
  short: string;
  description: string;
  family: Exclude<ModelFamily, "blend">;
  generate: (context: ModelContext) => ModelCandidate[];
  score: (candidate: ModelCandidate, context: ModelContext) => ModelScore;
};

export type ModelMeta = {
  id: ModelId;
  name: string;
  short: string;
  description: string;
  family: ModelFamily;
};

export type GeneratedEvidence = {
  modelScore: number;
  dimensions: Record<string, number>;
  rationale: string[];
  sourceWords: [string, string];
  categories: Category[];
};
