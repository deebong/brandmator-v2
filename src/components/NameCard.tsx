import { useState } from "react";
import type { Blend } from "../lib/generator";
import { CATEGORY_META, SOURCE_META } from "../data/word-pools";

function ScoreRing({ score }: { score: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(99, score)) / 99;
  const offset = circumference * (1 - progress);
  const hue = Math.round((Math.max(0, Math.min(99, score)) / 99) * 130);
  const scoreColor = `hsl(${hue} 82% 58%)`;

  return (
    <div
      className="relative h-11 w-11 shrink-0"
      title={`Brandability score ${score}/99`}
      aria-label={`Brandability score ${score} out of 99`}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-11 w-11 -rotate-90" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={scoreColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-[7px] grid place-items-center rounded-full bg-[var(--score-center)] text-[11px] font-semibold text-[var(--text)]">
        {score}
      </div>
    </div>
  );
}

export default function NameCard({
  blend,
  saved,
  onToggleSave
}: {
  blend: Blend;
  saved: boolean;
  onToggleSave: (b: Blend) => void;
}) {
  const [copied, setCopied] = useState(false);
  const domain = blend.name + blend.tld;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const accent = blend.categories[0]
    ? CATEGORY_META[blend.categories[0]].accent
    : "from-indigo-400 to-violet-500";
  const sourceSignals = [...new Set([...blend.sourcesA, ...blend.sourcesB])].slice(0, 3);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-lg">
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-15 blur-2xl transition group-hover:opacity-30`}
      />
      <div className="flex items-start gap-3">
        <ScoreRing score={blend.score} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold tracking-tight text-[var(--text)]">
            {blend.name}
            <span className="ml-1 text-sm font-normal text-indigo-500">{blend.tld}</span>
          </h3>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {blend.a} + {blend.b} · {blend.method}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-indigo-300/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-200">
          {blend.modelName}
        </span>
        {sourceSignals.map(source => (
          <span
            key={source}
            className="rounded-full border border-[var(--border)] bg-[var(--chip)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
          >
            {SOURCE_META[source].short}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={copy}
          className="rounded-lg border border-[var(--border)] bg-[var(--chip)] px-2.5 py-1.5 text-xs text-[var(--text-soft)] transition hover:bg-[var(--chip-hover)]"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(`"${domain}"`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-[var(--border)] bg-[var(--chip)] px-2.5 py-1.5 text-xs text-[var(--text-soft)] transition hover:bg-[var(--chip-hover)]"
        >
          Search web
        </a>
        <button
          onClick={() => onToggleSave(blend)}
          className={`ml-auto rounded-lg px-2.5 py-1.5 text-xs transition ${
            saved
              ? "bg-amber-300/20 text-amber-800 ring-1 ring-amber-300/50 dark:text-amber-200"
              : "border border-[var(--border)] bg-[var(--chip)] text-[var(--text-soft)] hover:bg-[var(--chip-hover)]"
          }`}
          aria-pressed={saved}
        >
          {saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>
    </article>
  );
}
