"use client";

import * as React from "react";
import { usePlanner } from "@/components/planner/context";
import { formulas } from "@/lib/planner/report";

export function Formulas() {
  const { state, results } = usePlanner();
  const items = formulas(state, results.inf, results.ft);
  return (
    <div>
      {results.inf ? (
        <p className="m-0 max-w-[80ch] text-[13px] text-muted">
          <b className="text-fg">Memory</b> = weights + runtime + KV cache for every user. <b className="text-fg">Speed</b> comes from the bytes each new token has to read
          divided by memory bandwidth, unless compute, GPU-to-GPU traffic or offloading is slower. <b className="text-fg">First word</b> comes from the prompt&apos;s FLOPs
          divided by compute. Every number below uses your current settings.
        </p>
      ) : (
        <p className="m-0 max-w-[80ch] text-[13px] text-muted">
          <b className="text-fg">Memory per GPU</b> = weights + gradients + optimizer states + activations (+ adapters). <b className="text-fg">Speed</b> = GPUs × TFLOPS ×
          MFU ÷ FLOPs per token. Every number below uses your current settings.
        </p>
      )}
      <ol className="mt-3.5 grid list-decimal gap-3 pl-5 text-[13px] marker:font-bold marker:text-faint">
        {items.map((it) => (
          <li key={it.title}>
            <b>{it.title}</b> = {it.formula}
            <span className="mt-1 block font-mono text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
              {it.lines.map((line, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <br /> : null}
                  {line.map((p, j) =>
                    p.strong ? (
                      <b key={j} className="text-fg">
                        {p.text}
                      </b>
                    ) : (
                      <React.Fragment key={j}>{p.text}</React.Fragment>
                    ),
                  )}
                </React.Fragment>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
