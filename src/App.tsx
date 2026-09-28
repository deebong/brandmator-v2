import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORY_META,
  CATEGORY_NAMES,
  SOURCE_META,
  SOURCE_NAMES,
  TLDS,
  TLD_INFO,
  WORD_LIBRARY,
  getLibraryStats
} from "./data/word-pools";
import { NAMING_STYLES, type NamingStyleId } from "./lib/style";
import { RECIPES, type RecipeId, getRecipe } from "./lib/recipes";
import { RESULT_SORTS, sortResults, type ResultSort } from "./lib/result-sort";
import { analyzeBrief } from "./lib/brief";
import type { Category, WordSource } from "./data/types";
import { generateAsync, type Blend, type GenerateProgress } from "./lib/generator";
import NameCard from "./components/NameCard";
import StyledSelect from "./components/StyledSelect";
import RangeSlider from "./components/RangeSlider";
import RecipeCards from "./components/RecipeCards";
import { track } from "./analytics";

const STORE_KEY = "brandmator.saved.v2";
const THEME_KEY = "brandmator.theme.v1";
const PAGE_SIZE = 24;

type SourcePreset = "broad" | "current" | "startup" | "sales" | "custom";

const SOURCE_PRESETS: Array<{ value: SourcePreset; label: string; description: string; sources: WordSource[] }> = [
  {
    value: "broad",
    label: "Broad mix",
    description: "All current vocabulary pools.",
    sources: ["core", "top", "trending", "company", "sales"]
  },
  {
    value: "current",
    label: "Current signals",
    description: "Top + trending vocabulary.",
    sources: ["core", "top", "trending"]
  },
  {
    value: "startup",
    label: "Startup signals",
    description: "Top + trending + company vocabulary.",
    sources: ["top", "trending", "company"]
  },
  {
    value: "sales",
    label: "Sales-led",
    description: "Reported sales signals with top/trending vocabulary.",
    sources: ["top", "trending", "sales"]
  },
  {
    value: "custom",
    label: "Choose sources",
    description: "Pick the exact pools yourself.",
    sources: ["core", "top", "trending", "company", "sales"]
  }
];

const TOPIC_PRESETS: Array<{ id: string; label: string; categories: Category[] }> = [
  { id: "auto", label: "Auto from brief", categories: [] },
  { id: "tech", label: "Technology", categories: ["tech", "ai"] },
  { id: "business", label: "Business", categories: ["business", "finance", "commerce"] },
  { id: "consumer", label: "Consumer", categories: ["food", "health", "creative"] },
  { id: "science", label: "Science & nature", categories: ["science", "nature", "energy"] }
];

const primaryRecipes = RECIPES.filter(recipe =>
  ["surprise", "invented", "spelling", "dictionary-one"].includes(recipe.id)
);

const secondaryRecipes = RECIPES.filter(recipe =>
  ["prefix", "meaningful", "experimental", "dictionary-two"].includes(recipe.id)
);

function Logo() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
      <defs>
        <linearGradient id="bm" x1="5" y1="5" x2="43" y2="43">
          <stop stopColor="#7dd3fc" />
          <stop offset=".5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
      <path
        d="M11 15a4 4 0 0 1 4-4h2.8a3 3 0 0 1 2.4 1.2L24 16l3.8-3.8A3 3 0 0 1 30.2 11H33a4 4 0 0 1 4 4v3a4 4 0 0 1-1.6 3.2L29 24l6.4 2.8A4 4 0 0 1 37 30v3a4 4 0 0 1-4 4h-2.8a3 3 0 0 1-2.4-1.2L24 32l-3.8 3.8a3 3 0 0 1-2.4 1.2H15a4 4 0 0 1-4-4v-3a4 4 0 0 1 1.6-3.2L19 24l-6.4-3.8A4 4 0 0 1 11 17v-2Z"
        fill="url(#bm)"
      />
      <circle cx="24" cy="24" r="4.5" fill="var(--logo-core)" />
    </svg>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-xs font-medium transition " +
        (active
          ? "border-indigo-300/60 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
          : "border-[var(--border)] bg-[var(--chip)] text-[var(--text-soft)] hover:bg-[var(--chip-hover)]")
      }
    >
      {children}
    </button>
  );
}

function tldValid(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const tld = raw.startsWith(".") ? raw : "." + raw;
  return /^\.[a-z0-9-]{1,23}$/.test(tld) ? tld : null;
}

function inputClass() {
  return "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-indigo-400";
}

export default function App() {
  const [interfaceMode, setInterfaceMode] = useState<"lite" | "full">("lite");
  const [recipeId, setRecipeId] = useState<RecipeId>("surprise");
  const [style, setStyle] = useState<NamingStyleId>("balanced");
  const [topicPreset, setTopicPreset] = useState("auto");
  const [categories, setCategories] = useState<Category[]>([]);
  const [sourcePreset, setSourcePreset] = useState<SourcePreset>("broad");
  const [sources, setSources] = useState<WordSource[]>(SOURCE_PRESETS[0].sources);
  const [tlds, setTlds] = useState<string[]>([".com", ".ai", ".io", ".co"]);
  const [tldInput, setTldInput] = useState("");
  const [brief, setBrief] = useState("");
  const [seedWordsInput, setSeedWordsInput] = useState("");
  const [liteKeywords, setLiteKeywords] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [minLen, setMinLen] = useState(5);
  const [maxLen, setMaxLen] = useState(10);
  const [count, setCount] = useState(120);
  const [results, setResults] = useState<Blend[]>([]);
  const [saved, setSaved] = useState<Blend[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showSaved, setShowSaved] = useState(false);
  const [light, setLight] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [resultSort, setResultSort] = useState<ResultSort>("score-desc");
  const [generationProgress, setGenerationProgress] = useState<GenerateProgress>({ phase: "preparing", percent: 0, found: 0 });
  const liteKeyRef = useRef("");
  const liteUsedNamesRef = useRef<Set<string>>(new Set());
  const [showMoreRecipes, setShowMoreRecipes] = useState(false);
  const [showMoreSettings, setShowMoreSettings] = useState(false);

  const stats = getLibraryStats();
  const recipe = getRecipe(recipeId);
  const briefAnalysis = useMemo(() => analyzeBrief(brief, WORD_LIBRARY), [brief]);
  const selectedStyle = NAMING_STYLES.find(item => item.id === style) || NAMING_STYLES[0];
  const topicSummary =
    topicPreset === "auto"
      ? "Auto from brief"
      : TOPIC_PRESETS.find(item => item.id === topicPreset)?.label || "Custom topics";

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) setSaved(JSON.parse(stored));
      setLight(localStorage.getItem(THEME_KEY) === "light");
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", !light);
    document.documentElement.dataset.theme = light ? "light" : "dark";
    localStorage.setItem(THEME_KEY, light ? "light" : "dark");
  }, [light]);

  useEffect(() => {
    const preset = TOPIC_PRESETS.find(item => item.id === topicPreset);
    if (preset) setCategories(preset.categories);
  }, [topicPreset]);

  const run = useCallback(async () => {
    if (spinning) return;

    setSpinning(true);
    setGenerationProgress({ phase: "preparing", percent: 2, found: 0 });
    setPage(1);
    setShowSaved(false);
    setResults([]);

    const seedWords = seedWordsInput
      .split(/[,\\n]+/)
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, 12);

    const nextResults = await generateAsync(
      {
        modelId: recipe.modelId,
        candidateMode: recipe.candidateMode,
        style,
        categories,
        sources,
        minLen: Math.min(minLen, maxLen),
        maxLen: Math.max(minLen, maxLen),
        count,
        seedWords,
        seedA: seedWords[0] || undefined,
        seedB: seedWords[1] || undefined,
        prefix: prefix.trim() || undefined,
        suffix: suffix.trim() || undefined,
        brief,
        tlds
      },
      progress => setGenerationProgress(progress)
    );

    setResults(nextResults);
    setSpinning(false);
    setGenerationProgress({ phase: "finishing", percent: 100, found: nextResults.length });
  }, [
    spinning,
    recipe,
    style,
    categories,
    sources,
    minLen,
    maxLen,
    count,
    seedWordsInput,
    prefix,
    suffix,
    brief,
    tlds
  ]);

  const runLite = useCallback(async () => {
    if (spinning) return;

    setSpinning(true);
    setGenerationProgress({ phase: "preparing", percent: 2, found: 0 });
    setPage(1);
    setShowSaved(false);
    setResults([]);

    const keywords = liteKeywords
      .split(/[,\n]+/)
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, 12);

    const key = keywords.map(value => value.toLowerCase()).join("|");
    if (liteKeyRef.current !== key) {
      liteKeyRef.current = key;
      liteUsedNamesRef.current = new Set();
    }

    const nextResults = await generateAsync(
      {
        modelId: "m0",
        candidateMode: "models",
        style: "balanced",
        categories: [],
        sources: ["core", "top", "trending", "company", "sales"],
        minLen: 5,
        maxLen: 12,
        count: 120,
        seedWords: keywords,
        brief: "",
        tlds: [".com"],
        lite: true,
        excludeNames: [...liteUsedNamesRef.current]
      },
      progress => setGenerationProgress(progress)
    );

    for (const item of nextResults) liteUsedNamesRef.current.add(item.name);

    setResults(nextResults);
    setSpinning(false);
    setGenerationProgress({ phase: "finishing", percent: 100, found: nextResults.length });
  }, [spinning, liteKeywords]);

  const setRecipe = (next: RecipeId) => {
    setRecipeId(next);
    track("recipe_change", { recipe: next });
  };

  const customTopic = topicPreset === "custom";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -right-32 top-20 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-500/8 blur-[120px]" />
      </div>

      <div id="top" className="relative mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6 sm:pt-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-3" aria-label="Brandmator home">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <Logo />
            </span>
            <span className="brand-wordmark">Brand<span className="brand-wordmark-accent">mator</span></span>
          </a>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--chip)] p-0.5" aria-label="Interface mode">
              <button
                type="button"
                onClick={() => setInterfaceMode("lite")}
                className={"rounded-lg px-3 py-1.5 text-[11px] font-semibold transition " + (interfaceMode === "lite" ? "bg-indigo-600 text-white shadow-sm" : "text-[var(--text-soft)] hover:bg-[var(--chip-hover)]")}
              >
                Lite
              </button>
              <button
                type="button"
                onClick={() => setInterfaceMode("full")}
                className={"rounded-lg px-3 py-1.5 text-[11px] font-semibold transition " + (interfaceMode === "full" ? "bg-indigo-600 text-white shadow-sm" : "text-[var(--text-soft)] hover:bg-[var(--chip-hover)]")}
              >
                Full
              </button>
            </div>
            <button onClick={() => setLight(value => !value)} className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs font-medium">
              {light ? "☾ Dark" : "☀ Light"}
            </button>
            <button
              onClick={() => setShowSaved(value => !value)}
              className={"rounded-xl px-3 py-2 text-xs font-medium " + (showSaved ? "bg-amber-300/25 text-amber-800 dark:text-amber-200" : "border border-[var(--border)] bg-[var(--chip)] text-[var(--text-soft)]")}
            >
              ★ Shortlist ({saved.length})
            </button>
            <button onClick={() => {
              if (!results.length) return;
              const head = ["domain","brand_display_name","score","model","family","word_a","word_b","method","sources","categories","registration_usd","renewal_usd","score_dimensions","rationale"];
              const rows = results.map(item => [
                item.name + item.tld,
                item.displayName,
                item.score,
                item.modelName,
                item.family,
                item.a,
                item.b,
                item.method,
                [...new Set([...item.sourcesA, ...item.sourcesB])].join("|"),
                item.categories.join("|"),
                TLD_INFO[item.tld]?.register ?? "",
                TLD_INFO[item.tld]?.renewal ?? "",
                Object.entries(item.scoreDimensions).map(([key,value]) => key + "=" + value).join("|"),
                item.rationale.join(" | ")
              ]);
              const esc = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
              const blob = new Blob([[head, ...rows].map(row => row.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "brandmator-results.csv";
              anchor.click();
              URL.revokeObjectURL(url);
            }} disabled={!results.length} className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs font-medium disabled:opacity-40">
              Export CSV
            </button>
            <button onClick={() => {
              if (!results.length) return;
              const blob = new Blob([results.map(item => item.name + item.tld).join("\n")], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `brandmator-${results.length}-names.txt`;
              anchor.click();
              URL.revokeObjectURL(url);
            }} disabled={!results.length} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
              Download all
            </button>
          </div>
        </header>

        <section className="mt-10 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-indigo-500">Startup naming tool</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Find a name worth remembering.
            <br />
            <span className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
              Describe it. Shape it. Generate.
            </span>
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Start with a simple description, choose how you want the name made, then add only the constraints you need.
          </p>
        </section>

        {interfaceMode === "lite" ? (
          <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-7">
            <div className="mx-auto max-w-3xl">
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Lite mode</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">What should the name be about?</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                  Type a keyword or several ideas. Brandmator will mix its naming approaches and return 120 candidates between 5 and 12 letters.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  value={liteKeywords}
                  onChange={event => setLiteKeywords(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") void runLite();
                  }}
                  placeholder="e.g. cat, dog, pet"
                  className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--input)] px-4 py-3.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-indigo-400"
                  aria-label="Lite mode keywords"
                />
                <button
                  type="button"
                  onClick={() => void runLite()}
                  disabled={spinning}
                  className="group shrink-0 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-2xl hover:shadow-indigo-500/20 active:translate-y-0 active:scale-[.98] disabled:cursor-wait disabled:opacity-70"
                >
                  <span className={spinning ? "mr-2 inline-block animate-spin" : "mr-2 inline-block transition-transform duration-200 group-hover:rotate-90"}>✦</span>
                  {spinning ? `Generating ${generationProgress.percent}%` : "Generate names"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-[var(--muted)]">
                <span>120 names</span>
                <span>5–12 letters</span>
                <span>All naming approaches</span>
                <button
                  type="button"
                  onClick={() => setInterfaceMode("full")}
                  className="font-medium text-indigo-500 hover:text-indigo-400"
                >
                  Need more control? Use Full mode
                </button>
              </div>

              {spinning && (
                <div className="mt-5 overflow-hidden rounded-full bg-[var(--slider-track)]">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-100"
                    style={{ width: generationProgress.percent + "%" }}
                  />
                </div>
              )}
            </div>
          </section>
        ) : (
          <div>
        <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
          <div className="space-y-7">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">1 · Describe your brand</p>
                {brief.trim() && (
                  <span className="text-[10px] text-[var(--muted)]">
                    {briefAnalysis.matches.length ? `${briefAnalysis.matches.length} related words found` : "Ready to interpret"}
                  </span>
                )}
              </div>
              <textarea
                value={brief}
                onChange={event => setBrief(event.target.value)}
                rows={4}
                placeholder="Example: Friendly AI tool that helps small businesses automate finance work. Modern, trustworthy, simple."
                className="w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm leading-6 outline-none placeholder:text-[var(--muted)] focus:border-indigo-400"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {brief.trim() && briefAnalysis.matches.length > 0 && (
                  <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-700 dark:text-emerald-200">
                    Using: {briefAnalysis.matches.slice(0, 6).map(item => item.word).join(" · ")}
                  </span>
                )}
                {brief.trim() && briefAnalysis.categories.length > 0 && (
                  <span className="rounded-full border border-indigo-300/40 bg-indigo-500/10 px-2.5 py-1 text-[10px] text-indigo-700 dark:text-indigo-200">
                    Topics detected: {briefAnalysis.categories.map(category => CATEGORY_META[category].label).join(" · ")}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">2 · How should we make the name?</p>
                <button
                  type="button"
                  onClick={() => setShowMoreRecipes(value => !value)}
                  className="text-[11px] font-medium text-indigo-500 hover:text-indigo-400"
                >
                  {showMoreRecipes ? "Show fewer ways" : "More ways"}
                </button>
              </div>

              <RecipeCards
                recipes={primaryRecipes}
                value={recipeId === "dictionary-two" ? "dictionary-one" : recipeId}
                onChange={setRecipe}
              />

              {showMoreRecipes && (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {secondaryRecipes
                    .filter(item => item.id !== "dictionary-two")
                    .map(item => (
                      <RecipeCards key={item.id} recipes={[item]} value={recipeId} onChange={setRecipe} />
                    ))}
                </div>
              )}

              {(recipeId === "dictionary-one" || recipeId === "dictionary-two") && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-[var(--muted)]">Real-word format:</span>
                  <button
                    type="button"
                    onClick={() => setRecipe("dictionary-one")}
                    className={
                      "rounded-full border px-3 py-1.5 text-xs font-medium " +
                      (recipeId === "dictionary-one"
                        ? "border-indigo-300/60 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
                        : "border-[var(--border)] bg-[var(--chip)] text-[var(--text-soft)]")
                    }
                  >
                    One word
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipe("dictionary-two")}
                    className={
                      "rounded-full border px-3 py-1.5 text-xs font-medium " +
                      (recipeId === "dictionary-two"
                        ? "border-indigo-300/60 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
                        : "border-[var(--border)] bg-[var(--chip)] text-[var(--text-soft)]")
                    }
                  >
                    Two words
                  </button>
                  <span className="text-[10px] text-[var(--muted)]">
                    {recipeId === "dictionary-two"
                      ? "Two untouched words; displayed in CamelCase."
                      : "One untouched dictionary word."}
                  </span>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Name feel <span className="font-normal normal-case tracking-normal">(optional)</span></p>
              <div className="flex flex-wrap gap-2">
                <Chip active={style === "balanced"} onClick={() => { setStyle("balanced"); track("style_change", { style: "balanced" }); }}>Any feel</Chip>
                {NAMING_STYLES.filter(item => item.id !== "balanced").map(item => (
                  <Chip key={item.id} active={style === item.id} onClick={() => { setStyle(item.id); track("style_change", { style: item.id }); }}>
                    {item.name.replace("More ", "")}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--muted)]">{selectedStyle.description}</p>
            </div>

            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">3 · Shape the result <span className="font-normal normal-case tracking-normal">(optional)</span></p>
              <div className="grid gap-3 md:grid-cols-3">
                <label>
                  <span className="text-xs font-medium text-[var(--text-soft)]">Words to include</span>
                  <input
                    value={seedWordsInput}
                    onChange={event => setSeedWordsInput(event.target.value)}
                    placeholder="e.g. nova, flow"
                    className={inputClass()}
                  />
                  <span className="mt-1 block text-[10px] text-[var(--muted)]">Separate multiple words with commas.</span>
                </label>
                <label>
                  <span className="text-xs font-medium text-[var(--text-soft)]">Starts with</span>
                  <input
                    value={prefix}
                    onChange={event => setPrefix(event.target.value)}
                    placeholder="e.g. neo, eco, i"
                    className={inputClass()}
                  />
                  <span className="mt-1 block text-[10px] text-[var(--muted)]">Every result starts with one of these prefixes. Separate with commas.</span>
                </label>
                <label>
                  <span className="text-xs font-medium text-[var(--text-soft)]">Ends with</span>
                  <input
                    value={suffix}
                    onChange={event => setSuffix(event.target.value)}
                    placeholder="e.g. ly, io, x"
                    className={inputClass()}
                  />
                  <span className="mt-1 block text-[10px] text-[var(--muted)]">Every result ends with one of these suffixes. Separate with commas.</span>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-[11px] text-[var(--muted)]">
                <span>{Math.min(minLen, maxLen)}–{Math.max(minLen, maxLen)} letters</span>
                <span>{tlds.length || 0} TLDs</span>
                {prefix && <span>starts: <strong className="text-[var(--text-soft)]">{prefix.toLowerCase().split(/[,\\s]+/).filter(Boolean).join(" · ")}</strong></span>}
                {suffix && <span>ends: <strong className="text-[var(--text-soft)]">{suffix.toLowerCase().split(/[,\\s]+/).filter(Boolean).join(" · ")}</strong></span>}
                {seedWordsInput && <span>using your words</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3.5">
              <button
                onClick={run}
                disabled={spinning}
                className="group rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-2xl hover:shadow-indigo-500/20 active:translate-y-0 active:scale-[.98] disabled:cursor-wait disabled:opacity-70"
              >
                <span className={spinning ? "mr-2 inline-block animate-spin" : "mr-2 inline-block transition-transform duration-200 group-hover:rotate-90"}>✦</span>
                {spinning ? `Generating ${generationProgress.percent}%` : "Generate names"}
              </button>
              <div className="min-w-0 flex-1 text-xs text-[var(--muted)]">
                <strong className="text-[var(--text-soft)]">{recipe.label}</strong>
                <span> · {selectedStyle.name}</span>
                {brief.trim() && <span> · brief-aware</span>}
              </div>
              <span className="text-[10px] text-[var(--muted)]">Space also generates</span>
            </div>

            <details open={showMoreSettings} onToggle={event => setShowMoreSettings((event.currentTarget as HTMLDetailsElement).open)} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm font-medium text-[var(--text-soft)] [&::-webkit-details-marker]:hidden">
                <span>Fine-tune vocabulary, length & domains</span>
                <span className="text-xs text-[var(--muted)]">{topicSummary} · {sourcePreset === "custom" ? "Custom sources" : SOURCE_PRESETS.find(item => item.value === sourcePreset)?.label}</span>
              </summary>

              <div className="border-t border-[var(--border)] p-4 sm:p-5">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Topic focus</p>
                    <div className="flex flex-wrap gap-2">
                      {TOPIC_PRESETS.map(preset => (
                        <Chip key={preset.id} active={topicPreset === preset.id} onClick={() => setTopicPreset(preset.id)}>
                          {preset.label}
                        </Chip>
                      ))}
                      <Chip active={customTopic} onClick={() => setTopicPreset("custom")}>Custom topics</Chip>
                    </div>
                    {customTopic && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CATEGORY_NAMES.map(category => (
                          <Chip key={category} active={categories.includes(category)} onClick={() => toggle(categories, category, setCategories)}>
                            {CATEGORY_META[category].emoji} {CATEGORY_META[category].label}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Vocabulary pool</p>
                    <StyledSelect
                      value={sourcePreset}
                      onChange={value => {
                        const next = value as SourcePreset;
                        setSourcePreset(next);
                        if (next !== "custom") setSources(SOURCE_PRESETS.find(item => item.value === next)?.sources || sources);
                      }}
                      ariaLabel="Vocabulary pool"
                      options={SOURCE_PRESETS.map(item => ({ value: item.value, label: item.label, description: item.description }))}
                    />
                    {sourcePreset === "custom" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SOURCE_NAMES.map(source => (
                          <Chip key={source} active={sources.includes(source)} onClick={() => toggle(sources, source, setSources)}>
                            {SOURCE_META[source].short}
                          </Chip>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-[10px] text-[var(--muted)]">{stats.total} words across Core, Top, Trending, Company and Sales libraries.</p>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Name length</p>
                    <div className="grid gap-5 md:grid-cols-2">
                      <RangeSlider label="Minimum" value={minLen} min={3} max={12} onChange={setMinLen} />
                      <RangeSlider label="Maximum" value={maxLen} min={4} max={16} onChange={setMaxLen} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">How many results? (up to 1000)</p>
                    <RangeSlider label="Result count" value={count} min={6} max={1000} step={1} onChange={setCount} />
                  </div>

                  <div className="lg:col-span-2">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Domain extensions</p>
                    <div className="flex flex-wrap gap-2">
                      {[...new Set([...TLDS, ...tlds])].map(tld => (
                        <button
                          key={tld}
                          type="button"
                          onClick={() => toggle(tlds, tld, setTlds)}
                          className={"rounded-full border px-3 py-1.5 text-xs font-medium " + (tlds.includes(tld) ? "border-indigo-300/60 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200" : "border-[var(--border)] bg-[var(--chip)] text-[var(--muted)]")}
                        >
                          {tld}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input value={tldInput} onChange={event => setTldInput(event.target.value)} onKeyDown={event => event.key === "Enter" && addTld()} placeholder="Add a TLD, e.g. .design" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]" />
                      <button onClick={addTld} className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-4 py-2 text-xs font-semibold">Add</button>
                    </div>
                    <p className="mt-2 text-[10px] text-[var(--muted)]">Cost sorting uses regular registration/renewal estimates. Availability is not checked yet.</p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </section>


          </div>
        )}
        <section className="mt-8" aria-labelledby="results-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="results-heading" className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                {showSaved ? "Your shortlist" : "Generated names"}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {sortedShown.length} names · {sortedShown.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{Math.min(current * PAGE_SIZE, sortedShown.length)}
              </p>
              {(prefix || suffix || brief.trim()) && !showSaved && (
                <p className="mt-1 text-[10px] text-indigo-500">
                  {prefix ? `Starts with "${prefix}"` : ""}
                  {prefix && suffix ? " · " : ""}
                  {suffix ? `Ends with "${suffix}"` : ""}
                  {(prefix || suffix) && brief.trim() ? " · " : ""}
                  {brief.trim() ? "Brief-aware" : ""}
                </p>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <input
                value={query}
                onChange={event => { setQuery(event.target.value); setPage(1); }}
                placeholder="Search this batch…"
                className="hidden w-48 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs outline-none placeholder:text-[var(--muted)] sm:block"
                aria-label="Search this batch"
              />
              <StyledSelect
                value={resultSort}
                onChange={value => {
                  setResultSort(value as ResultSort);
                  setPage(1);
                  track("sort_change", { sort: value });
                }}
                ariaLabel="Sort generated names"
                options={RESULT_SORTS.map(option => ({ value: option.value, label: option.label }))}
                compact
                className="w-44"
              />
              {pages > 1 && <span className="text-xs text-[var(--muted)]">{pages} pages</span>}
            </div>
          </div>

          <div className="mb-3 sm:hidden">
            <input
              value={query}
              onChange={event => { setQuery(event.target.value); setPage(1); }}
              placeholder="Search this batch…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]"
              aria-label="Search this batch"
            />
          </div>

          {items.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(blend => (
                <NameCard
                  key={blend.id}
                  blend={blend}
                  saved={savedIds.has(blend.name + blend.tld)}
                  onToggleSave={toggleSave}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
              {showSaved ? "Nothing saved yet." : "No matching names. Try a broader recipe, remove a constraint, or use More ways."}
            </div>
          )}

          {pages > 1 && (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Generated name pages">
              <button disabled={current === 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs disabled:opacity-35">Previous</button>
              {Array.from({ length: pages }, (_, index) => index + 1)
                .slice(Math.max(0, current - 3), Math.min(pages, current + 2))
                .map(number => (
                  <button key={number} onClick={() => setPage(number)} aria-current={number === current ? "page" : undefined} className={"h-9 min-w-9 rounded-xl px-3 text-xs font-semibold " + (number === current ? "bg-indigo-600 text-white" : "border border-[var(--border)] bg-[var(--chip)]")}>{number}</button>
                ))}
              <button disabled={current === pages} onClick={() => setPage(value => Math.min(pages, value + 1))} className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs disabled:opacity-35">Next</button>
            </nav>
          )}
        </section>

        <section className="mt-16 grid gap-4 lg:grid-cols-3">
          <article id="about" className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h3 className="font-semibold">About Brandmator</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">A browser-based naming tool that explores multiple naming philosophies, dictionary combinations and controlled brand transformations.</p>
          </article>
          <article id="how-it-works" className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h3 className="font-semibold">How it works</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">The interface presents a simple naming task while the registry underneath routes the request to model-specific generators and scorers. Model 0 blends the available naming approaches.</p>
          </article>
          <article id="data-sources" className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h3 className="font-semibold">Data sources</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{stats.total} starter words currently come from isolated core, top, trending, company and reported sales-signal pools. More data sources can be added without changing the model contract.</p>
          </article>
        </section>

        <footer className="mt-10 border-t border-[var(--border)] pt-6">
          <div className="flex flex-col gap-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Brandmator · Generated names require independent checks before use.</p>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Footer">
              <a href="#about">About</a>
              <a href="#how-it-works">How it works</a>
              <a href="#data-sources">Data sources</a>
              <a href="/brandmator-v2/tech.html">Tech docs</a>
              <a href="https://github.com/deebong/brandmator-v2" target="_blank" rel="noreferrer">GitHub</a>
              <a href="#top" aria-label="Go to top" title="Go to top" className="ml-1 grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--chip)] text-[var(--text-soft)] transition hover:bg-[var(--chip-hover)]">↑</a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
