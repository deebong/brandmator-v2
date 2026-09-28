import { useEffect, useRef, useState } from "react";

export default function RangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const range = Math.max(1, max - min);

  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const snap = (next: number) => {
    const snapped = Math.round((next - min) / step) * step + min;
    return clamp(snapped);
  };

  const updateFromClientX = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(snap(min + ratio * range));
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => updateFromClientX(event.clientX);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  const percent = ((value - min) / range) * 100;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-[var(--text-soft)]">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>

      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="relative mt-3 h-6 touch-none select-none outline-none"
        onPointerDown={event => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setDragging(true);
          updateFromClientX(event.clientX);
        }}
        onKeyDown={event => {
          let next: number | null = null;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = value - step;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") next = value + step;
          if (event.key === "PageDown") next = value - step * 5;
          if (event.key === "PageUp") next = value + step * 5;
          if (event.key === "Home") next = min;
          if (event.key === "End") next = max;
          if (next !== null) {
            event.preventDefault();
            onChange(snap(next));
          }
        }}
      >
        <div className="absolute left-0 right-0 top-2.5 h-2 rounded-full bg-[var(--slider-track)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-75"
            style={{ width: percent + "%" }}
          />
        </div>
        <div
          className="absolute top-0.5 -ml-3 h-6 w-6 rounded-full border-2 border-white bg-indigo-500 shadow-md shadow-indigo-500/25 transition-transform duration-75"
          style={{ left: percent + "%" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
