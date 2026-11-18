"use client";

import * as React from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A number that eases to its new value (450 ms), as in the original tool. */
export function Tweened({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const [shown, setShown] = React.useState(value);
  const fromRef = React.useRef(value);
  const shownRef = React.useRef(value);

  React.useEffect(() => {
    const from = shownRef.current;
    if (!Number.isFinite(from) || !Number.isFinite(value) || from === value || prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    fromRef.current = from;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      let k = Math.min(1, (now - t0) / 450);
      k = 1 - Math.pow(1 - k, 3);
      const v = fromRef.current + (value - fromRef.current) * k;
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{format(shown)}</span>;
}
