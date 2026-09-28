import type { Recipe } from "../lib/recipes";

export default function RecipeCards({
  recipes,
  value,
  onChange
}: {
  recipes: Recipe[];
  value: Recipe["id"];
  onChange: (value: Recipe["id"]) => void;
}) {
  const columns = recipes.length >= 4 ? "lg:grid-cols-4" : recipes.length === 3 ? "lg:grid-cols-3" : recipes.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";

  return (
    <div className={"grid gap-2 sm:grid-cols-2 " + columns}>
      {recipes.map(recipe => {
        const active = value === recipe.id;
        return (
          <button
            key={recipe.id}
            type="button"
            onClick={() => onChange(recipe.id)}
            aria-pressed={active}
            className={
              "rounded-2xl border p-3.5 text-left transition " +
              (active
                ? "border-indigo-400/70 bg-indigo-500/12 shadow-sm ring-1 ring-indigo-400/20"
                : "border-[var(--border)] bg-[var(--chip)] hover:border-[var(--border-strong)] hover:bg-[var(--chip-hover)]")
            }
          >
            <span className={"block text-sm font-semibold " + (active ? "text-indigo-600 dark:text-indigo-200" : "text-[var(--text)]")}>
              {recipe.label}
            </span>
            <span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">
              {recipe.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
