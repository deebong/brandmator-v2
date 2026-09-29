import { useEffect, useRef, useState } from "react";

export type OptionItem = { value: string; label: string; description?: string };

export default function StyledSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  compact = false,
  triggerPrefix = "",
  minimal = false
}: {
  value: string;
  onChange: (value: string) => void;
  options: OptionItem[];
  ariaLabel: string;
  className?: string;
  compact?: boolean;
  triggerPrefix?: string;
  minimal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value) || options[0];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div ref={ref} className={"relative " + className}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(v => !v)}
        className={
          "flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--input)] text-left " +
          (compact ? "px-3 py-2" : "px-3.5 py-2.5") +
          " text-sm text-[var(--text)] shadow-sm outline-none transition hover:border-[var(--border-strong)] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15"
        }
      >
        <span className="min-w-0 flex-1 truncate">
          {triggerPrefix ? triggerPrefix + " " + (selected?.label || "") : selected?.label}
        </span>
        <span
          className={
            "ml-3 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[var(--muted)] transition " +
            (open ? "rotate-180 bg-indigo-500/10 text-indigo-500" : "")
          }
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
            <path d="M5.2 7.5 10 12.3l4.8-4.8 1.4 1.4-6.2 6.2-6.2-6.2z" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="styled-select-menu absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--dropdown)] p-1.5 shadow-2xl shadow-black/15 backdrop-blur-xl"
        >
          {options.map(option => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={
                  "flex w-full items-center rounded-xl px-3 py-2.5 text-left transition " +
                  (minimal ? "" : "gap-3 ") +
                  (active
                    ? "bg-indigo-500/12 text-indigo-700 dark:text-indigo-200"
                    : "text-[var(--text-soft)] hover:bg-[var(--chip-hover)]")
                }
              >
                {!minimal && (
                  <span
                    className={
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border " +
                      (active
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-[var(--border)]")
                    }
                  >
                    {active && (
                      <svg viewBox="0 0 20 20" className="h-3 w-3 fill-none stroke-current" strokeWidth="2.4">
                        <path d="m5 10 3 3 7-7" />
                      </svg>
                    )}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{option.label}</span>
                  {!minimal && option.description && (
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                      {option.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
