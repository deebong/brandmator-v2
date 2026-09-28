export type NamingStyleId =
  | "balanced"
  | "inventive"
  | "meaningful"
  | "playful"
  | "professional"
  | "short";

export type NamingStyle = {
  id: NamingStyleId;
  name: string;
  description: string;
};

export const NAMING_STYLES: NamingStyle[] = [
  { id: "balanced", name: "Balanced", description: "A broad mix of invented, meaningful and modern brand patterns." },
  { id: "inventive", name: "More Inventive", description: "Favors coined, unusual and transformed names over literal words." },
  { id: "meaningful", name: "More Meaningful", description: "Favors recognizable roots and names that retain semantic clues." },
  { id: "playful", name: "More Playful", description: "Favors friendly endings, creative spelling and memorable twists." },
  { id: "professional", name: "More Professional", description: "Favors clear, restrained and business-friendly constructions." },
  { id: "short", name: "Short & Punchy", description: "Favors compact names that are easy to type and remember." }
];

const methodFit = (method: string, style: NamingStyleId) => {
  const playful = /suffix|experimental|vowel|initial|compressed/i.test(method);
  const inventive = /fusion|overlap|bridge|vowel|initial|compressed/i.test(method);
  const meaningful = /dictionary|semantic|root|user-prefix/i.test(method);

  if (style === "inventive") return inventive ? 100 : meaningful ? 68 : 78;
  if (style === "meaningful") return meaningful ? 100 : inventive ? 70 : 82;
  if (style === "playful") return playful ? 100 : 75;
  if (style === "professional") return /semantic|dictionary|root|head+tail/i.test(method) ? 95 : playful ? 65 : 82;
  return style === "short" ? 82 : 85;
};

const lengthFit = (name: string, style: NamingStyleId) => {
  if (style === "short") {
    if (name.length <= 6) return 100;
    if (name.length === 7) return 90;
    if (name.length <= 9) return 74;
    return 50;
  }
  if (name.length >= 6 && name.length <= 9) return 100;
  if (name.length === 5 || name.length === 10) return 88;
  if (name.length === 4 || name.length === 11) return 70;
  return 50;
};

export function styleFit(name: string, method: string, style: NamingStyleId): number {
  const methodScore = methodFit(method, style);
  const lengthScore = lengthFit(name, style);
  return Math.round(methodScore * 0.62 + lengthScore * 0.38);
}

export function adjustScore(baseScore: number, name: string, method: string, style: NamingStyleId) {
  if (style === "balanced") return baseScore;
  const preference = styleFit(name, method, style);
  return Math.max(1, Math.min(99, Math.round(baseScore * 0.78 + preference * 0.22)));
}

export function styleLabel(style: NamingStyleId) {
  return NAMING_STYLES.find(item => item.id === style)?.name ?? "Balanced";
}
