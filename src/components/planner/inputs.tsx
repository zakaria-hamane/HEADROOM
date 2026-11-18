"use client";

import * as React from "react";
import { controlClass, Hint } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function fmtValue(v: number | null | undefined, pct: boolean): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(pct ? +(v * 100).toFixed(2) : v);
}

/**
 * Number field that keeps what you type and commits only valid values.
 * `pct` shows fractions as percentages; `nullable` lets an empty field mean "use the default".
 */
export function NumberInput({
  value,
  onCommit,
  pct = false,
  nullable = false,
  min = 0,
  max,
  integer = false,
  positive = false,
  className,
  ...rest
}: {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  pct?: boolean;
  nullable?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  const [text, setText] = React.useState(() => fmtValue(value, pct));
  const [focused, setFocused] = React.useState(false);
  const shown = focused ? text : fmtValue(value, pct);

  const commit = (raw: string) => {
    if (raw.trim() === "") {
      if (nullable) onCommit(null);
      return;
    }
    let v = Number(raw);
    if (!Number.isFinite(v)) return;
    if (pct) v /= 100;
    if (integer) v = Math.round(v);
    if (v < min || (positive && !(v > 0))) return;
    if (max != null && v > max) v = max;
    onCommit(v);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      className={cn(controlClass, "tabular-nums", className)}
      value={shown}
      onFocus={() => {
        setText(fmtValue(value, pct));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        commit(e.target.value);
      }}
      {...rest}
    />
  );
}

/** Labelled numeric field used across the planner cards. */
export function NumberField({
  label,
  hint,
  id,
  className,
  ...props
}: { label: React.ReactNode; hint?: React.ReactNode; id: string; className?: string } & React.ComponentProps<typeof NumberInput>) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <NumberInput id={id} {...props} />
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

/** Stepped slider over a list of values (e.g. users 1…2000), with the filled-track look. */
export function StepSlider({
  steps,
  value,
  onChange,
  label,
}: {
  steps: number[];
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const idx = nearestIndex(steps, value);
  const pctFill = steps.length > 1 ? (idx / (steps.length - 1)) * 100 : 0;
  return (
    <input
      type="range"
      className="range"
      min={0}
      max={steps.length - 1}
      step={1}
      value={idx}
      aria-label={label}
      aria-valuetext={String(value)}
      style={{ "--p": `${pctFill}%` } as React.CSSProperties}
      onChange={(e) => onChange(steps[+e.target.value])}
    />
  );
}

export function RangeInput({
  min,
  max,
  value,
  onChange,
  label,
  disabled,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const pctFill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className="range"
      min={min}
      max={max}
      step={1}
      value={value}
      disabled={disabled}
      aria-label={label}
      style={{ "--p": `${pctFill}%` } as React.CSSProperties}
      onChange={(e) => onChange(+e.target.value)}
    />
  );
}

export function nearestIndex(arr: number[], v: number): number {
  let bi = 0;
  for (let i = 1; i < arr.length; i++) if (Math.abs(Math.log(arr[i] / v)) < Math.abs(Math.log(arr[bi] / v))) bi = i;
  return bi;
}

/** Compact two-column spec list (model / GPU facts). */
export function SpecGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 rounded-[10px] border border-line bg-panel-2 px-2.5 py-1.5">
          <dt className="text-[10.5px] font-bold tracking-[0.08em] text-faint uppercase">{k}</dt>
          <dd className="m-0 font-mono text-[12.5px] font-semibold [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small disclosure used for "Customize the architecture" etc. */
export function Disclosure({ summary, children, defaultOpen = false }: { summary: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group mt-3" open={defaultOpen}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-[12.5px] font-semibold text-blue [&::-webkit-details-marker]:hidden">
        {summary}
        <svg viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current transition-transform group-open:rotate-180" strokeWidth={2.2}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
