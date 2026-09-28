import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORY_META, Category, TLDS } from "./data/words";
import { Blend, generate } from "./lib/generator";
import NameCard from "./components/NameCard";

const ALL_CATS = Object.keys(CATEGORY_META) as Category[];
const STORE_KEY = "fusebrand.saved.v1";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-white text-slate-900 shadow-[0_0_20px_-4px_rgba(255,255,255,0.6)]"
          : "border border-white/12 bg-white/5 text-white/60 hover:bg-white/12 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [cats, setCats] = useState<Category[]>(["tech", "abstract", "nature"]);
  const [tlds, setTlds] = useState<string[]>([".com", ".io", ".ai"]);
  const [minLen, setMinLen] = useState(5);
  const [maxLen, setMaxLen] = useState(10);
  const [count, setCount] = useState(24);
  const [seedA, setSeedA] = useState("");
  const [seedB, setSeedB] = useState("");
  const [results, setResults] = useState<Blend[]>([]);
  const [saved, setSaved] = useState<Blend[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(saved));
  }, [saved]);

  const run = useCallback(() => {
    setSpinning(true);
    const res = generate({
      categories: cats,
      minLen: Math.min(minLen, maxLen),
      maxLen: Math.max(minLen, maxLen),
      count,
      seedA: seedA.trim() || undefined,
      seedB: seedB.trim() || undefined,
      tlds,
    });
    setResults(res);
    setTimeout(() => setSpinning(false), 320);
  }, [cats, minLen, maxLen, count, seedA, seedB, tlds]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ["INPUT", "TEXTAREA"].includes(t.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.name + s.tld)), [saved]);
  const toggleSave = (b: Blend) =>
    setSaved((prev) =>
      prev.some((s) => s.name + s.tld === b.name + b.tld)
        ? prev.filter((s) => s.name + s.tld !== b.name + b.tld)
        : [b, ...prev],
    );

  const visible = useMemo(
    () => results.filter((r) => !query || r.name.includes(query.toLowerCase())),
    [results, query],
  );

  const exportList = () => {
    const list = (showSaved ? saved : visible).map((b) => `${b.name}${b.tld}\t${b.score}\t${b.a}+${b.b}`);
    const blob = new Blob([`name\tscore\tparts\n${list.join("\n")}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fusebrand-names.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const shown = showSaved ? saved : visible;

  return (
    <div className="min-h-screen bg-[#070912] text-white">
      {/* backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-indigo-600/25 blur-[120px]" />
        <div className="absolute -right-32 top-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-500/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-10 sm:pt-14">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 text-lg shadow-lg shadow-indigo-900/40">
              ⚗
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Fuse<span className="text-indigo-300">brand</span>
              </h1>
              <p className="text-xs text-white/45">Portmanteau engine for future brands</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaved((s) => !s)}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                showSaved
                  ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/40"
                  : "border border-white/12 bg-white/5 text-white/70 hover:bg-white/12"
              }`}
            >
              ★ Shortlist ({saved.length})
            </button>
            <button
              onClick={exportList}
              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/12"
            >
              Export .txt
            </button>
          </div>
        </header>

        <section className="mt-9 max-w-2xl">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Smash two words together.
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
              Walk away with a brand.
            </span>
          </h2>
          <p className="mt-3 text-sm text-white/50">
            Blends short English words using syllable clipping, overlap merging and suffix morphing — then
            scores every result for pronounceability and brandability.
          </p>
        </section>

        {/* Controls */}
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  Word pools
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_CATS.map((c) => (
                    <Chip key={c} active={cats.includes(c)} onClick={() => toggle(cats, c, setCats)}>
                      {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  Extensions
                </p>
                <div className="flex flex-wrap gap-2">
                  {TLDS.map((t) => (
                    <Chip key={t} active={tlds.includes(t)} onClick={() => toggle(tlds, t, setTlds)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Lock word A (optional)
                  </span>
                  <input
                    value={seedA}
                    onChange={(e) => setSeedA(e.target.value)}
                    placeholder="e.g. nova"
                    className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-indigo-400/60"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Lock word B (optional)
                  </span>
                  <input
                    value={seedB}
                    onChange={(e) => setSeedB(e.target.value)}
                    placeholder="e.g. harbor"
                    className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-fuchsia-400/60"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: `Min length: ${minLen}`, v: minLen, set: setMinLen, min: 3, max: 12 },
                  { label: `Max length: ${maxLen}`, v: maxLen, set: setMaxLen, min: 4, max: 16 },
                  { label: `Results: ${count}`, v: count, set: setCount, min: 6, max: 60 },
                ].map((s) => (
                  <label key={s.label} className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                      {s.label}
                    </span>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      value={s.v}
                      onChange={(e) => s.set(Number(e.target.value))}
                      className="mt-2 w-full accent-indigo-400"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3 lg:w-56">
              <button
                onClick={run}
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-5 text-base font-semibold shadow-xl shadow-indigo-900/40 transition hover:brightness-110 active:scale-[0.98]"
              >
                <span className={`inline-block transition ${spinning ? "animate-spin" : ""}`}>⚗</span>{" "}
                Fuse names
                <span className="mt-1 block text-[11px] font-normal text-white/70">
                  or press Space
                </span>
              </button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter results…"
                className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-white/40"
              />
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/45">
              {showSaved ? "Your shortlist" : "Fresh blends"}
            </h3>
            <span className="text-xs text-white/35">{shown.length} names</span>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-white/40">
              {showSaved
                ? "Nothing saved yet — hit ☆ on a name you like."
                : "No matches. Loosen the length range or pick more pools."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((b, i) => (
                <div
                  key={b.id + i}
                  style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                  className="animate-[fadeUp_.45s_ease-out_both]"
                >
                  <NameCard blend={b} saved={savedIds.has(b.name + b.tld)} onToggleSave={toggleSave} />
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-16 text-center text-xs text-white/25">
          Names are algorithmically generated — always verify availability & trademarks before you buy.
        </footer>
      </div>
    </div>
  );
}