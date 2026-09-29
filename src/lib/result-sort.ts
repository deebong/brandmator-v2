import { TLD_COST_SORT_VALUE } from "../data/tlds";
import type { Blend } from "./generator";

export type ResultSort =
  | "score-desc"
  | "score-asc"
  | "length-asc"
  | "length-desc"
  | "cost-asc";

export const RESULT_SORTS: Array<{ value: ResultSort; label: string }> = [
  { value: "length-asc", label: "Low–High" },
  { value: "length-desc", label: "High–Low" },
  { value: "score-desc", label: "High score" },
  { value: "score-asc", label: "Low score" },
  { value: "cost-asc", label: "Low–High" }
];

export function sortResults(items: Blend[], sort: ResultSort): Blend[] {
  const copy = [...items];
  return copy.sort((a, b) => {
    if (sort === "length-asc") return a.name.length - b.name.length || b.score - a.score;
    if (sort === "length-desc") return b.name.length - a.name.length || b.score - a.score;
    if (sort === "score-asc") return a.score - b.score || a.name.localeCompare(b.name);
    if (sort === "cost-asc") {
      const ac = TLD_COST_SORT_VALUE(a.tld);
      const bc = TLD_COST_SORT_VALUE(b.tld);
      return ac - bc || b.score - a.score || a.name.localeCompare(b.name);
    }
    return b.score - a.score || a.name.localeCompare(b.name);
  });
}
