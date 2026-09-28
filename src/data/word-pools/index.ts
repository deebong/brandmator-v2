import type { Category, WordEntry, WordSeed, WordSource } from "../types";
import { CORE_WORDS } from "./core";
import { POPULAR_WORDS } from "./popular";
import { TOP_WORDS } from "./top";
import { TRENDING_WORDS } from "./trending";
import { COMPANY_WORDS } from "./company";
import { SALES_WORDS } from "./sales";
export { TLD_INFO, TLD_COST_SORT_VALUE } from "../tlds";
export const CATEGORY_META: Record<Category,{label:string;emoji:string;accent:string}> = {
tech:{label:"Tech",emoji:"◈",accent:"from-sky-400 to-indigo-500"},ai:{label:"AI",emoji:"✦",accent:"from-violet-400 to-fuchsia-500"},business:{label:"Business",emoji:"◫",accent:"from-blue-400 to-cyan-500"},finance:{label:"Finance",emoji:"◉",accent:"from-emerald-400 to-teal-500"},commerce:{label:"Commerce",emoji:"◇",accent:"from-rose-400 to-orange-500"},health:{label:"Health",emoji:"＋",accent:"from-green-400 to-lime-500"},creative:{label:"Creative",emoji:"✎",accent:"from-pink-400 to-purple-500"},nature:{label:"Nature",emoji:"❋",accent:"from-emerald-400 to-cyan-500"},energy:{label:"Energy",emoji:"ϟ",accent:"from-amber-400 to-orange-500"},food:{label:"Food",emoji:"●",accent:"from-orange-400 to-pink-500"},science:{label:"Science",emoji:"⊕",accent:"from-cyan-400 to-blue-500"},mythic:{label:"Mythic",emoji:"◇",accent:"from-violet-400 to-indigo-500"},abstract:{label:"Abstract",emoji:"○",accent:"from-fuchsia-400 to-purple-500"}
};
export const SOURCE_META: Record<WordSource,{label:string;short:string;weight:number}> = {
core:{label:"Core library",short:"Core",weight:.85},top:{label:"Top brand vocabulary",short:"Top",weight:1.05},popular:{label:"Popular vocabulary",short:"Popular",weight:1},trending:{label:"Trending signals",short:"Trending",weight:1.15},company:{label:"Company vocabulary",short:"Company",weight:1.05},sales:{label:"Domain-sale vocabulary",short:"Sales",weight:1.2}
};
const POOLS:[WordSource,WordSeed[]][] = [["core",CORE_WORDS],["top",TOP_WORDS],["popular",POPULAR_WORDS],["trending",TRENDING_WORDS],["company",COMPANY_WORDS],["sales",SALES_WORDS]];
function mergeEntries():WordEntry[]{const map=new Map<string,WordEntry>();for(const [source,seeds] of POOLS){for(const [rawWord,categories] of seeds){const word=rawWord.toLowerCase().replace(/[^a-z]/g,"");if(!word||word.length<2)continue;const e=map.get(word);if(!e){map.set(word,{word,categories:[...new Set(categories)],sources:[source],weight:SOURCE_META[source].weight});}else{e.categories=[...new Set([...e.categories,...categories])];if(!e.sources.includes(source))e.sources.push(source);e.weight+=SOURCE_META[source].weight;}}}return [...map.values()]}
export const WORD_LIBRARY=mergeEntries();
export const CATEGORY_NAMES=Object.keys(CATEGORY_META) as Category[];
export const SOURCE_NAMES=Object.keys(SOURCE_META) as WordSource[];
export const TLDS=[".com",".ai",".io",".co",".app",".dev",".tech",".cloud",".xyz",".me",".org",".net",".studio",".store",".shop",".one"];
export function getLibraryStats(){const bySource=Object.fromEntries(SOURCE_NAMES.map(source=>[source,WORD_LIBRARY.filter(w=>w.sources.includes(source)).length])) as Record<WordSource,number>;return{total:WORD_LIBRARY.length,bySource};}
