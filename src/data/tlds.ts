export type TldInfo = {
  register: number | null;
  renewal: number | null;
  minYears?: number;
  source: string;
};

export const TLD_INFO: Record<string, TldInfo> = {
  ".com": { register: 14.98, renewal: 18.48, source: "Namecheap" },
  ".ai": { register: 89.98, renewal: 114.98, minYears: 2, source: "Namecheap" },
  ".io": { register: 65.98, renewal: 75.98, source: "Namecheap" },
  ".co": { register: 38.48, renewal: 45.48, source: "Namecheap" },
  ".app": { register: 17.98, renewal: 22.98, source: "Namecheap" },
  ".dev": { register: 15.98, renewal: 20.98, source: "Namecheap" },
  ".tech": { register: 68.98, renewal: 78.98, source: "Namecheap" },
  ".xyz": { register: 21.48, renewal: 21.48, source: "Namecheap" },
  ".me": { register: 19.98, renewal: 23.98, source: "Namecheap" },
  ".org": { register: 14.48, renewal: 18.98, source: "Namecheap" },
  ".net": { register: 14.98, renewal: 18.58, source: "Namecheap" },
  ".store": { register: 1.78, renewal: 66.98, source: "Namecheap" },
  ".shop": { register: 38.98, renewal: 48.98, source: "Namecheap" },
  ".cloud": { register: null, renewal: null, source: "Unknown" },
  ".studio": { register: null, renewal: null, source: "Unknown" },
  ".one": { register: null, renewal: null, source: "Unknown" }
};

export const TLD_COST_SORT_VALUE = (tld: string) => {\n  const info = TLD_INFO[tld];\n  if (!info || info.register === null || info.renewal === null) return Number.POSITIVE_INFINITY;\n  return (info.register + info.renewal) / 2;\n};
