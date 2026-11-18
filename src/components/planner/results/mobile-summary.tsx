"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { StatusPill } from "@/components/ui/status";
import { usePlanner } from "@/components/planner/context";
import { duration, gpuLabel, nf, spd } from "@/lib/planner/format";

/** On narrow screens the results sit below the inputs: this bar keeps the headline in view. */
export function MobileSummary() {
  const { results, resultsRef } = usePlanner();
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const el = resultsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [resultsRef]);

  const r = results.inf,
    f = results.ft;
  const ratio = r ? r.ratio : f!.ratio;
  const gpus = r ? `${r.T.G}× ${gpuLabel(r.gpu)}` : `${f!.G}× ${gpuLabel(f!.gpu)}`;
  const metric = r ? `${spd(r.speed)} tok/s per user` : `${duration(f!.time)} to train`;

  return (
    <div
      className={`fixed inset-x-3 bottom-3 z-30 transition-[transform,opacity] duration-300 min-[1120px]:hidden ${hidden ? "pointer-events-none translate-y-4 opacity-0" : ""}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        type="button"
        onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="flex w-full items-center gap-3 rounded-2xl border border-line-2 bg-panel/95 px-3.5 py-2.5 text-left shadow-pop backdrop-blur"
      >
        <StatusPill ratio={ratio} size="sm" />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          <b className="font-semibold">{nf(ratio * 100, 0)}%</b> <span className="text-muted">of usable VRAM · {gpus} · {metric}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-blue">
          Results <ChevronDown className="size-4" />
        </span>
      </button>
    </div>
  );
}
