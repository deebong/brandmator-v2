import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORY_META, CATEGORY_NAMES, SOURCE_META, SOURCE_NAMES, TLDS, WORD_LIBRARY, getLibraryStats } from "./data/word-pools";
import { TLD_INFO } from "./data/tlds";
import { NAMING_MODELS, type ModelId } from "./models/registry";
import { NAMING_STYLES, type NamingStyleId } from "./lib/style";
import { RESULT_SORTS, sortResults, type ResultSort } from "./lib/result-sort";
import { analyzeBrief } from "./lib/brief";
import type { Category, WordSource } from "./data/types";
import { generate, type Blend, type CandidateMode } from "./lib/generator";
import NameCard from "./components/NameCard";
import StyledSelect from "./components/StyledSelect";
import RangeSlider from "./components/RangeSlider";
import { track } from "./analytics";

const STORE_KEY = "brandmator.saved.v2";
const THEME_KEY = "brandmator.theme.v1";
const PAGE_SIZE = 24;

const CANDIDATE_MODES = [
  {
    value: "models",
    label: "Model-generated names",
    description: "Use the selected naming model and its model-specific generator + scorer."
  },
  {
    value: "dictionary-one",
    label: "Pure dictionary · One word",
    description: "Untouched library words. No fusion or spelling transformation."
  },
  {
    value: "dictionary-two",
    label: "Pure dictionary · Two words",
    description: "Two untouched words shown in CamelCase; the actual domain stays lowercase."
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
  const [modelId, setModelId] = useState<ModelId>("m0");
  const [candidateMode, setCandidateMode] = useState<CandidateMode>("models");
  const [style, setStyle] = useState<NamingStyleId>("balanced");
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

  const stats = getLibraryStats();
  const briefAnalysis = useMemo(() => analyzeBrief(brief, WORD_LIBRARY), [brief]);
  const selectedBriefCategories = briefAnalysis.categories.filter(category => !categories.includes(category));

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
      style,
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
      style,
      categories,
      sources,
      tldCount: tlds.length,
      requestedResults: count,
      minLength: minLen,
      maxLength: maxLen,
      briefLength: brief.trim().length,
      briefMatches: briefAnalysis.matches.length
    });

    window.setTimeout(() => setSpinning(false), 280);
  }, [modelId, candidateMode, style, categories, sources, minLen, maxLen, count, seedA, seedB, prefix, suffix, brief, tlds, briefAnalysis.matches.length]);

  useEffect(() => {
    run();
    // Initial generation only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
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

  const downloadTxt = () => {
    const blob = new Blob([results.map(item => item.name + item.tld).join("\n")], { type: "text/plain;charset=utf-8" });
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
      "brand_display_name",
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

  const candidateModeDescription =
    CANDIDATE_MODES.find(mode => mode.value === candidateMode)?.description || "";

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
            <span className="brand-wordmark">Brand<span className="brand-wordmark-accent">mator</span></span>
          </a>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setLight(value => !value)} className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs font-medium">
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
            <button onClick={downloadTxt} disabled={!results.length} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
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
              Explore different ways to make it.
            </span>
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Explore coined names, semantic forms, brand spelling, prefix structures and pure dictionary ideas from the same word intelligence layer.
          </p>
        </section>

        <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
          <div className="grid gap-7 xl:grid-cols-[1fr_260px]">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Generation mode</p>
                  <StyledSelect
                    value={candidateMode}
                    onChange={value => {
                      setCandidateMode(value as CandidateMode);
                      track("candidate_mode_change", { candidateMode: value });
                    }}
                    ariaLabel="Generation mode"
                    options={CANDIDATE_MODES.map(mode => ({ value: mode.value, label: mode.label, description: mode.description }))}
                  />
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{candidateModeDescription}</p>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Naming model</p>
                  <StyledSelect
                    value={modelId}
                    onChange={value => {
                      setModelId(value as ModelId);
                      track("model_change", { model: value });
                    }}
                    ariaLabel="Naming model"
                    options={NAMING_MODELS.map(model => ({ value: model.id, label: model.name, description: model.description }))}
                    className={candidateMode === "models" ? "" : "opacity-50 pointer-events-none"}
                  />
                  {candidateMode !== "models" && (
                    <p className="mt-2 text-[11px] text-[var(--muted)]">Model selection is inactive in dictionary modes.</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Brand brief</p>
                    <span className="text-[10px] text-[var(--muted)]">Local intelligence</span>
                  </div>
                  <textarea
                    value={brief}
                    onChange={event => setBrief(event.target.value)}
                    onBlur={() =>
                      brief.trim() &&
                      track("brief_submit", {
                        characters: brief.trim().length,
                        words: brief.trim().split(/\s+/).length,
                        matches: briefAnalysis.matches.length
                      })
                    }
                    rows={4}
                    placeholder="Describe what the brand does, who it serves, the feeling you want, and what it should avoid."
                    className="w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--input)] px-3 py-3 text-sm leading-6 outline-none placeholder:text-[var(--muted)] focus:border-indigo-400"
                  />

                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    {brief.trim() && briefAnalysis.matches.length ? (
                      <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-200">
                        {briefAnalysis.matches.length} related vocabulary matches
                      </span>
                    ) : brief.trim() ? (
                      <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-200">
                        No direct library matches yet - add concrete concept words
                      </span>
                    ) : null}
                    {selectedBriefCategories.length > 0 && (
                      <span className="rounded-full border border-indigo-300/40 bg-indigo-500/10 px-2.5 py-1 text-indigo-700 dark:text-indigo-200">
                        Also exploring {selectedBriefCategories.map(category => CATEGORY_META[category].label).join(", ")}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                    Concrete concepts receive the strongest boost. Generic business wording is deliberately not used as a primary naming signal.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Naming style</p>
                  <StyledSelect
                    value={style}
                    onChange={value => {
                      setStyle(value as NamingStyleId);
                      track("style_change", { style: value });
                    }}
                    ariaLabel="Naming style"
                    options={NAMING_STYLES.map(item => ({ value: item.id, label: item.name, description: item.description }))}
                  />
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Style adjusts preference scoring without changing the underlying model.</p>
                </div>
              </div>

              <details className="group rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm font-medium text-[var(--text-soft)] [&::-webkit-details-marker]:hidden">
                  <span>Advanced controls</span>
                  <span className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
                    <span>{categories.length} vibes</span>
                    <span>·</span>
                    <span>{sources.length} sources</span>
                    <span>·</span>
                    <span>{tlds.length} TLDs</span>
                    <span className="ml-1 text-indigo-500 transition group-open:rotate-180">⌄</span>
                  </span>
                </summary>

                <div className="border-t border-[var(--border)] p-4 sm:p-5">
                  <div className="space-y-6">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Vibes / categories</p>
                      <div className="flex flex-wrap gap-2">
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
                        <input value={seedA} onChange={event => setSeedA(event.target.value)} placeholder="e.g. nova" className={inputClass()} />
                      </label>
                      <label>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Seed word B</span>
                        <input value={seedB} onChange={event => setSeedB(event.target.value)} placeholder="e.g. harbor" className={inputClass()} />
                      </label>
                      <label>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Prefix</span>
                        <input value={prefix} onChange={event => setPrefix(event.target.value)} disabled={candidateMode !== "models"} placeholder="e.g. f" className={inputClass() + " disabled:cursor-not-allowed disabled:opacity-45"} />
                      </label>
                      <label>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Suffix</span>
                        <input value={suffix} onChange={event => setSuffix(event.target.value)} disabled={candidateMode !== "models"} placeholder="e.g. ly" className={inputClass() + " disabled:cursor-not-allowed disabled:opacity-45"} />
                      </label>
                    </div>

                    <div className="grid gap-5 md:grid-cols-3">
                      <RangeSlider label="Minimum length" value={minLen} min={3} max={12} onChange={setMinLen} />
                      <RangeSlider label="Maximum length" value={maxLen} min={4} max={16} onChange={setMaxLen} />
                      <RangeSlider label="Result count" value={count} min={6} max={120} onChange={setCount} />
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
                        <button onClick={addTld} className="rounded-xl border border-[var(--border)] bg-[var(--chip)] px-4 py-2 text-xs font-semibold">Add</button>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
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
                <strong className="text-[var(--text-soft)]">Tip:</strong> Start with a brief, choose a generation mode,
                then use Advanced controls when you want tighter experiments.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="results-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="results-heading" className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                {showSaved ? "Your shortlist" : "Generated names"}
              </h2>
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
                      (number === current
                        ? "bg-indigo-600 text-white"
                        : "border border-[var(--border)] bg-[var(--chip)]")
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
              A browser-based naming tool that explores multiple naming philosophies, dictionary combinations and controlled brand transformations.
            </p>
          </article>
          <article id="how-it-works" className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h3 className="font-semibold">How it works</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Each model owns its generator and scorer. Model 0 acts as the portfolio orchestrator. Dictionary modes remain independent while brief relevance, style, source intelligence, categories and user constraints remain reusable.
            </p>
          </article>
          <article id="data-sources" className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <h3 className="font-semibold">Data sources</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Starter pools cover core words, popular vocabulary, current trend signals, company vocabulary and reported domain-sale signals. The architecture is designed for future scheduled imports and APIs.
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
