"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  /** Highlighted as the value "Auto" picked (shown with an accent ring). */
  picked?: boolean;
  disabled?: boolean;
}

/** Segmented control: a radio group rendered as buttons. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = "md",
  label,
  className,
}: {
  value: T | null;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  label: string;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    for (let k = 1; k <= options.length; k++) {
      const j = (i + dir * k + options.length) % options.length;
      if (!options[j].disabled) {
        refs.current[j]?.focus();
        onChange(options[j].value);
        break;
      }
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full flex-wrap gap-[3px] rounded-xl border border-line bg-panel-2 p-[3px]", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (value === null && i === 0) ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "rounded-[9px] font-semibold text-muted transition-[background-color,color,box-shadow] hover:text-fg disabled:opacity-40",
              size === "sm" ? "px-2.5 py-[5px] text-xs" : "px-3 py-1.5 text-[13px]",
              on && "bg-panel text-fg shadow-[inset_0_0_0_1px_var(--blue),0_4px_14px_rgba(0,0,0,.12)]",
              !on && o.picked && "text-blue shadow-[inset_0_0_0_1px_var(--line-2)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
