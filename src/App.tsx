import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORY_META, CATEGORY_NAMES, SOURCE_META, SOURCE_NAMES, TLDS, getLibraryStats } from "./data/word-pools";
import { TLD_INFO } from "./data/tlds";
import { NAMING_MODELS, type ModelId } from "./models/registry";
import { RESULT_SORTS, sortResults, type ResultSort } from "./lib/result-sort";
import type { Category, WordSource } from "./data/types";
import { generate, type Blend, type CandidateMode } from "./lib/generator";
import NameCard from "./components/NameCard";
import StyledSelect from "./components/StyledSelect";
import { track } from "./analytics";

const STORE_KEY = "brandmator.saved.v2";
const THEME_KEY = "brandmator.theme.v1";
const PAGE_SIZE = 24;

const CANDIDATE_MODES = [
  {
    value: "models",
    label: "Model candidates",
    description: "Use the selected naming model(s)."
  },
  {
    value: "dictionary-one",
    label: "Pure dictionary · One word",
    description: "Untouched library words; no fusion or respelling."
  },
  {
    value: "dictionary-two",
    label: "Pure dictionary · Two words",
    description: "Two untouched library words joined for a domain; no fusion."
  }
] satisfies { value: CandidateMode; label: string; description: string }[];

const Logo = () => (
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

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

export default function App() {
  const [modelId, setModelId] = useState<ModelId>("m0");
  const [candidateMode, setCandidateMode] = useState<CandidateMode>("models");
  const [categories, setCategories] = useState<Category[]>(["tech", "ai", "business", "creative"]);
  const [sources, setSources] = useState<WordSource[]>(["core", "popular", "trending", "company", "sales"]);
  const [tlds, setTlds] = useState<string[]>([".com", ".ai", ".io", ".co"]);
  const [tldInput, setTldInput] = useState("");
  const [minLen, setMinLen] = useState(5);
  const [maxLen, setMaxLen] = useState(10);
  const [count, setCount] = useState(120);
  const [seedA, setSeedA] = useState("");
  const [seedB, setSeedB] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [brief, setBrief] = useState("");
  const [results, setResults] = useState<Blend[]>([]);
  const [saved, setSaved] = useState<Blend[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showSaved, setShowSaved] = useState(false);
  const [light, setLight] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [resultSort, setResultSort] = useState<ResultSort>("score-desc");

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

  const run = useCallback(() => {
    setSpinning(true);
    setPage(1);
    setShowSaved(false);

    const nextResults = generate({
      modelId,
      candidateMode,
      categories,
      sources,
      minLen: Math.min(minLen, maxLen),
      maxLen: Math.max(minLen, maxLen),
      count,
      seedA: seedA.trim() || undefined,
      seedB: seedB.trim() || undefined,
      prefix: prefix.trim() || undefined,
      suffix: suffix.trim() || undefined,
      brief,
      tlds
    });

    setResults(nextResults);
    track("generate", {
      model: modelId,
      candidateMode,
      categories: categories,
      sources: sources,
      tldCount: tlds.length,
      requestedResults: count,
      minLength: minLen,
      maxLength: maxLen,
      briefLength: brief.trim().length
    });
    window.setTimeout(() => setSpinning(false), 280);
  }, [modelId, candidateMode, categories, sources, minLen, maxLen, count, seedA, seedB, prefix, suffix, brief, tlds]);

  useEffect(() => {
    run();
    // Initial generation only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        run();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [run]);

  const toggle = <T,>(arr: T[], value: T, setter: (next: T[]) => void) =>
    setter(arr.includes(value) ? arr.filter(item => item !== value) : [...arr, value]);

  const savedIds = useMemo(() => new Set(saved.map(item => item.name + item.tld)), [saved]);

  const toggleSave = (blend: Blend) => {
    const willSave = !saved.some(item => item.name + item.tld === blend.name + blend.tld);
    setSaved(previous =>
      willSave
        ? [blend, ...previous]
        : previous.filter(item => item.name + item.tld !== blend.name + blend.tld)
    );
    track("result_save", { domain: blend.name + blend.tld, saved: willSave, model: blend.modelName });
  };

  const shown = useMemo(
    () =>
      (showSaved ? saved : results).filter(
        item => !query || (item.name + item.tld).toLowerCase().includes(query.toLowerCase())
      ),
    [showSaved, saved, results, query]
  );

  const sortedShown = useMemo(() => sortResults(shown, resultSort), [shown, resultSort]);
  const pages = Math.max(1, Math.ceil(sortedShown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const items = sortedShown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const stats = getLibraryStats();

  const downloadTxt = () => {
    const blob = new Blob([results.map(item => item.name + item.tld).join("\n")], {
      type: "text/plain;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `brandmator-${results.length}-names.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const head = [
      "domain",
      "score",
      "model",
      "family",
      "word_a",
      "word_b",
      "method",
      "sources",
      "categories",
      "registration_usd",
      "renewal_usd",
      "score_dimensions",
      "rationale"
    ];
    const rows = results.map(item => [
      item.name + item.tld,
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
      Object.entries(item.scoreDimensions).map(([key, value]) => key + "=" + value).join("|"),
      item.rationale.join(" | ")
    ]);
    const esc = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [head, ...rows].map(row => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "brandmator-results.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const addTld = () => {
    const tld = tldValid(tldInput);
    if (tld && !tlds.includes(tld)) {
      setTlds(previous => [...previous, tld]);
      track("tld_change", { action: "add", tld });
    }
    setTldInput("");
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -right-32 top-20 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-500/8 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6 sm:pt-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="#top" id="top" className="flex items-center gap-3" aria-label="Brandmator home">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <Logo />
            </span>
            <span className="brand-wordmark">
              Brand<span className="brand-wordmark-accent">mator</span>
            </span>
          </a>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setLight(value => !value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs font-medium"
            >
              {light ? "☾ Dark" : "☀ Light"}
            </button>
            <button
              onClick={() => setShowSaved(value => !value)}
              className={
                "rounded-xl px-3 py-2 text-xs font-medium " +
                (showSaved
                  ? "bg-amber-300/25 text-amber-800 dark:text-amber-200"
                  : "border border-[var(--border)] bg-[var(--chip)] text-[var(--text-soft)]")
              }
            >
              ★ Shortlist ({saved.length})
            </button>
            <button
              onClick={downloadCsv}
              disabled={!results.length}
              className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs font-medium disabled:opacity-40"
            >
              Export CSV
            </button>
            <button
              onClick={downloadTxt}
              disabled={!results.length}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Download all
            </button>
          </div>
        </header>

        <section className="mt-9 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-indigo-500">Startup naming tool</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Fuse words. Discover names.
            <br />
            <span className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
              Build a shortlist worth checking.
            </span>
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Explore multiple naming philosophies, pure dictionary candidates and controlled brand transformations.
            Describe the brand, choose your sources and keep manual seed/prefix/suffix controls when you need them.
          </p>
        </section>

        <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
          <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Naming model</p>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <StyledSelect
                    value={modelId}
                    onChange={value => {
                      setModelId(value as ModelId);
                      track("model_change", { model: value });
                    }}
                    ariaLabel="Naming model"
                    options={NAMING_MODELS.map(model => ({
                      value: model.id,
                      label: model.name,
                      description: model.description
                    }))}
                    className="w-full lg:max-w-sm"
                  />
                  <p className="min-w-0 flex-1 text-xs leading-5 text-[var(--muted)]">
                    {NAMING_MODELS.find(model => model.id === modelId)?.description}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Candidate type</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <StyledSelect
                    value={candidateMode}
                    onChange={value => {
                      setCandidateMode(value as CandidateMode);
                      track("candidate_mode_change", { candidateMode: value });
                    }}
                    ariaLabel="Candidate type"
                    options={CANDIDATE_MODES.map(mode => ({
                      value: mode.value,
                      label: mode.label,
                      description: mode.description
                    }))}
                    className="w-full sm:max-w-sm"
                  />
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    {CANDIDATE_MODES.find(mode => mode.value === candidateMode)?.description}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Brand brief</p>
                  <span className="text-[10px] text-[var(--muted)]">Local keyword matching · no remote AI yet</span>
                </div>
                <textarea
                  value={brief}
                  onChange={event => setBrief(event.target.value)}
                  onBlur={() =>
                    brief.trim() &&
                    track("brief_submit", {
                      characters: brief.trim().length,
                      words: brief.trim().split(/\s+/).length
                    })
                  }
                  rows={3}
                  placeholder="e.g. AI platform that helps small businesses automate finance workflows; trustworthy, modern, friendly."
                  className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-[var(--muted)] focus:border-indigo-400"
                />
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                  Matching library terms receive extra generation weight. This is the first layer toward a future AI-assisted naming brief.
                </p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Vibes / categories</p>
                <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                  {CATEGORY_NAMES.map(category => (
                    <Chip
                      key={category}
                      active={categories.includes(category)}
                      onClick={() => toggle(categories, category, setCategories)}
                    >
                      {CATEGORY_META[category].emoji} {CATEGORY_META[category].label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Word intelligence sources</p>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_NAMES.map(source => (
                    <Chip
                      key={source}
                      active={sources.includes(source)}
                      onClick={() => toggle(sources, source, setSources)}
                    >
                      {SOURCE_META[source].short}
                    </Chip>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  {stats.total} unique starter words · {stats.bySource.trending} trending · {stats.bySource.sales} sale-derived
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Seed word A</span>
                  <input
                    value={seedA}
                    onChange={event => setSeedA(event.target.value)}
                    placeholder="e.g. nova"
                    className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-indigo-400"
                  />
                </label>
                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Seed word B</span>
                  <input
                    value={seedB}
                    onChange={event => setSeedB(event.target.value)}
                    placeholder="e.g. harbor"
                    className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-indigo-400"
                  />
                </label>
                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Prefix</span>
                  <input
                    value={prefix}
                    onChange={event => setPrefix(event.target.value)}
                    disabled={candidateMode !== "models"}
                    placeholder="e.g. f"
                    className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-45"
                  />
                </label>
                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Suffix</span>
                  <input
                    value={suffix}
                    onChange={event => setSuffix(event.target.value)}
                    disabled={candidateMode !== "models"}
                    placeholder="e.g. ly"
                    className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-45"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: `Min length: ${minLen}`, value: minLen, set: setMinLen, min: 3, max: 12 },
                  { label: `Max length: ${maxLen}`, value: maxLen, set: setMaxLen, min: 4, max: 16 },
                  { label: `Results: ${count}`, value: count, set: setCount, min: 6, max: 120 }
                ].map(control => (
                  <label key={control.label}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{control.label}</span>
                    <input
                      type="range"
                      min={control.min}
                      max={control.max}
                      value={control.value}
                      onChange={event => control.set(Number(event.target.value))}
                      className="mt-2 w-full accent-indigo-500"
                    />
                  </label>
                ))}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Domain extensions</p>
                <div className="flex flex-wrap gap-2">
                  {[...new Set([...TLDS, ...tlds])].map(tld => (
                    <button
                      key={tld}
                      type="button"
                      onClick={() => toggle(tlds, tld, setTlds)}
                      className={
                        "rounded-full border px-3 py-1.5 text-xs font-medium " +
                        (tlds.includes(tld)
                          ? "border-indigo-300/60 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
                          : "border-[var(--border)] bg-[var(--chip)] text-[var(--muted)]")
                      }
                    >
                      {tld}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  Cost sorting uses the average of regular registration and renewal estimates; custom or unpriced TLDs appear last.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={tldInput}
                    onChange={event => setTldInput(event.target.value)}
                    onKeyDown={event => event.key === "Enter" && addTld()}
                    placeholder="Add custom TLD, e.g. .design"
                    className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]"
                  />
                  <button onClick={addTld} className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-4 py-2 text-xs font-semibold">
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
              <button
                onClick={run}
                disabled={spinning}
                className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-5 text-base font-semibold text-white shadow-xl shadow-indigo-900/20 disabled:opacity-70"
              >
                <span className={spinning ? "mr-2 inline-block animate-spin" : "mr-2 inline-block"}>✦</span>
                {spinning ? "Generating…" : "Generate names"}
                <span className="mt-1 block text-[11px] font-normal text-white/70">Press Space to generate</span>
              </button>

              <input
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Filter generated names…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]"
              />

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-xs leading-5 text-[var(--muted)]">
                <strong className="text-[var(--text-soft)]">Note:</strong> Model scores are ranking heuristics. They do not verify trademarks or domain availability.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="results-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="results-heading" className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                {showSaved ? "Your shortlist" : "Fresh blends"}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {sortedShown.length} names · {sortedShown.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{Math.min(current * PAGE_SIZE, sortedShown.length)}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
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
                className="w-48"
              />
              {pages > 1 && <span className="text-xs text-[var(--muted)]">{pages} pages</span>}
            </div>
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
              {showSaved ? "Nothing saved yet." : "No matches. Broaden your source or category selection."}
            </div>
          )}

          {pages > 1 && (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Generated name pages">
              <button
                disabled={current === 1}
                onClick={() => setPage(value => Math.max(1, value - 1))}
                className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs disabled:opacity-35"
              >
                Previous
              </button>

              {Array.from({ length: pages }, (_, index) => index + 1)
                .slice(Math.max(0, current - 3), Math.min(pages, current + 2))
                .map(number => (
                  <button
                    key={number}
                    onClick={() => setPage(number)}
                    aria-current={number === current ? "page" : undefined}
                    className={
                      "h-9 min-w-9 rounded-xl px-3 text-xs font-semibold " +
                      (number === current ? "bg-indigo-600 text-white" : "border border-[var(--border)] bg-[var(--chip)]")
                    }
                  >
                    {number}
                  </button>
                ))}

              <button
                disabled={current === pages}
                onClick={() => setPage(value => Math.min(pages, value + 1))}
                className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs disabled:opacity-35"
              >
                Next
              </button>
            </nav>
          )}
        </section>

        <section className="mt-16 grid gap-4 lg:grid-cols-3">
          <article id="about" className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h3 className="font-semibold">About Brandmator</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Brandmator is a browser-based naming tool that explores multiple naming philosophies, dictionary combinations and coined-name transformations.
            </p>
          </article>
          <article id="how-it-works" className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h3 className="font-semibold">How it works</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Each model owns its own generation and scoring logic. Model 0 acts as a portfolio orchestrator and mixes candidates from the available models while shared word intelligence, category filters and user controls remain reusable.
            </p>
          </article>
          <article id="data-sources" className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h3 className="font-semibold">Data sources</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Starter pools cover core words, popular vocabulary, current trend signals, company vocabulary and reported domain-sale signals. The data layer is designed for future scheduled imports and APIs.
            </p>
          </article>
        </section>

        <footer className="mt-10 border-t border-[var(--border)] pt-6">
          <div className="flex flex-col gap-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Brandmator · Generated names require independent checks before use.</p>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Footer">
              <a href="#about">About</a>
              <a href="#how-it-works">How it works</a>
              <a href="#data-sources">Data sources</a>
              <a href="https://github.com/deebong/brandmator-v2" target="_blank" rel="noreferrer">GitHub</a>
              <a
                href="#top"
                aria-label="Go to top"
                title="Go to top"
                className="ml-1 grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--chip)] text-[var(--text-soft)] transition hover:bg-[var(--chip-hover)]"
              >
                ↑
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
