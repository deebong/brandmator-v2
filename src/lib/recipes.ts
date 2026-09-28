export type RecipeId =
  | "surprise"
  | "invented"
  | "spelling"
  | "prefix"
  | "meaningful"
  | "experimental"
  | "dictionary-one"
  | "dictionary-two";

export type Recipe = {
  id: RecipeId;
  label: string;
  description: string;
  modelId: "m0" | "m1" | "m2" | "m3" | "m4" | "m5";
  candidateMode: "models" | "dictionary-one" | "dictionary-two";
};

export const RECIPES: Recipe[] = [
  { id: "surprise", label: "Surprise me", description: "Blend different naming approaches.", modelId: "m0", candidateMode: "models" },
  { id: "invented", label: "Invented words", description: "Create compact coined names from ideas.", modelId: "m1", candidateMode: "models" },
  { id: "spelling", label: "Creative spelling", description: "Compress, reshape and respell familiar words.", modelId: "m2", candidateMode: "models" },
  { id: "prefix", label: "Prefix & initials", description: "Build names around a beginning, initial or root.", modelId: "m3", candidateMode: "models" },
  { id: "meaningful", label: "Meaningful names", description: "Keep useful semantic clues and recognizable roots.", modelId: "m4", candidateMode: "models" },
  { id: "experimental", label: "Wild ideas", description: "Allow looser transformations and unusual constructions.", modelId: "m5", candidateMode: "models" },
  { id: "dictionary-one", label: "Real word", description: "Use an untouched dictionary word.", modelId: "m0", candidateMode: "dictionary-one" },
  { id: "dictionary-two", label: "Two real words", description: "Join two untouched words; show them in CamelCase.", modelId: "m0", candidateMode: "dictionary-two" }
];

export const getRecipe = (id: RecipeId) => RECIPES.find(recipe => recipe.id === id) || RECIPES[0];
