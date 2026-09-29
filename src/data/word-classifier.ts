import type { WordKind } from "../types";

const FORCE_BRANDABLE = new Set([
  "tapzz",
  "boltz",
  "gathr",
  "djvu",
  "thundr",
  "flickr",
  "censord",
  "blastr",
  "zomato",
  "ragent",
  "difi",
  "paydux",
  "binbid",
  "uplyte",
  "myfy",
  "skweezer",
  "speedz",
  "reseravtion",
  "reseravtions",
  "bockchain",
  "signable"
]);

const PURE_SHORT_WORDS = new Set([
  "ai","api","app","bio","bot","car","cat","dog","eco","ev","fit","fun","gym","home",
  "key","lab","llm","map","ml","net","pet","pro","sun","tax","web","work","you"
]);

const COMMON_CONSONANT_CLUSTERS = new Set([
  "bl","br","ch","cl","cr","dr","fl","fr","gl","gr","pl","pr","sc","sh","sk","sl","sm",
  "sn","sp","st","sw","th","tr","tw","wh","wr",
  "str","spr","spl","scr","shr","sch","squ","thr"
]);

function hasUnusualEnding(word: string) {
  const endings = [
    "ngth","rld","lds","lth","nth","mpt","nst","rth","rst","rch","lch",
    "nd","st","sk","lk","mp","lp","ft","ct","pt","rd","rt","rn","rm","rk","rg",
    "nk","ng","th"
  ];

  const match = word.match(/[bcdfghjklmnpqrstvwxz]{3,}$/)?.[0];
  return Boolean(match && !endings.some(ending => match.endsWith(ending)));
}

export function classifyWord(word: string): WordKind {
  const value = word.toLowerCase().replace(/[^a-z]/g, "");

  if (FORCE_BRANDABLE.has(value)) return "brandable";
  if (!value) return "brandable";
  if (PURE_SHORT_WORDS.has(value)) return "dictionary";

  // Stylized/experimental spellings commonly seen in domain sales.
  if (/([a-z])\1{2,}/.test(value)) return "brandable";
  if (!/[aeiouy]/.test(value)) return "brandable";
  if (hasUnusualEnding(value)) return "brandable";
  if (/(?:^|[^aeiou])(?:[qxz])(?:[^aeiou]|$)/.test(value) && value.length <= 6) return "brandable";
  if (/(?:zz|xx|qq)$/.test(value) && !["buzz","fizz","jazz","fuzz","quiz"].includes(value)) return "brandable";
  if (/(?:tz|zr|zv|qj|jq|xq|jv)$/.test(value)) return "brandable";
  if (/[0-9]/.test(word) || /[-_]/.test(word)) return "brandable";

  return "dictionary";
}
