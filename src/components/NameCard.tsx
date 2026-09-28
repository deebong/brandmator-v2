import { useState } from "react";
import { Blend, title } from "../lib/generator";
import { CATEGORY_META } from "../data/words";

function ScoreRing({ score }: { score: number }) {
  const hue = Math.round((score / 100) * 130);
  return (
    <div
      className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(hsl(${hue} 85% 60%) ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
      }}
      title={`Brandability ${score}/100`}
    >
      <div className="grid h-8 w-8 place-items-center rounded-full bg-[#0c0f1d] text-[11px] font-semibold text-white/90">
        {score}
      </div>
    </div>
  );
}

export default function NameCard({
  blend,
  saved,
  onToggleSave,
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
    } catch {
      /* ignore */
    }
  };

  const split = (() => {
    // highlight which part came from word A
    let i = 0;
    while (i < blend.a.length && i < blend.name.length && blend.a[i] === blend.name[i]) i++;
    return [blend.name.slice(0, i), blend.name.slice(i)];
  })();

  const accent = blend.categories[0] ? CATEGORY_META[blend.categories[0]].accent : "from-indigo-400 to-violet-500";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]">
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl transition group-hover:opacity-40`}
      />
      <div className="flex items-start gap-3">
        <ScoreRing score={blend.score} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold tracking-tight text-white">
            <span>{title(split[0])}</span>
            <span className="text-white/55">{split[1]}</span>
            <span className="text-sm font-normal text-indigo-300">{blend.tld}</span>
          </h3>
          <p className="mt-1 truncate text-xs text-white/40">
            {blend.a} + {blend.b} · <span className="text-white/30">{blend.method}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={copy}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(`"${domain}"`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          Check
        </a>
        <button
          onClick={() => onToggleSave(blend)}
          className={`ml-auto rounded-lg px-2.5 py-1 text-xs transition ${
            saved
              ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/40"
              : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/15 hover:text-white"
          }`}
        >
          {saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>
    </div>
  );
}