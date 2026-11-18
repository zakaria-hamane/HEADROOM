"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Labelled on/off switch built on a real checkbox. */
export function Switch({
  checked,
  onCheckedChange,
  children,
  className,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label className={cn("relative flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold select-none", disabled && "cursor-not-allowed opacity-60", className)}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="peer absolute size-px opacity-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="relative h-[22px] w-[38px] flex-none rounded-full border border-line-2 bg-track transition-colors peer-checked:border-blue peer-checked:bg-blue peer-focus-visible:shadow-[var(--focus)] after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgba(0,0,0,.3)] after:transition-transform peer-checked:after:translate-x-4"
      />
      {children ? <span className="min-w-0">{children}</span> : null}
    </label>
  );
}
