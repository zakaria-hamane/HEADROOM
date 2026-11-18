import { memoryStatus } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/status";
import { TASKS } from "@/lib/engine";
import { runInference } from "@/lib/planner/compute";
import { defaultState } from "@/lib/planner/defaults";
import { gb, gpuLabel, money, nf, spd, tm } from "@/lib/planner/format";

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

/** A static snapshot of the results panel for the default plan, computed at build time by the real engine. */
export function HeroPreview() {
  const r = runInference(defaultState());
  const st = memoryStatus(r.ratio);
  const parts = [
    { name: "Model weights", value: r.W_gpu },
    { name: "KV cache", value: r.KV_gpu },
    { name: "Runtime & buffers", value: r.fw + r.graphs + r.comm },
    { name: "Activations", value: r.act },
    { name: "RAG & agent models", value: r.st.gpuMem },
  ].filter((p) => p.value > 0.005);
  const cap = Math.max(r.totalRep, r.used);
  const stackRows = r.st.rows;
  const tiles: [string, string, string][] = [
    ["Speed per user", `${spd(r.speed)} tok/s`, `${nf(1000 / r.speed, 0)} ms per token`],
    r.st.retrieval
      ? ["Question → first word", tm(r.ttftK + r.st.retrieval), `retrieval included · ${r.k} at once`]
      : ["First word", tm(r.ttftK), `${r.k} prompts at once`],
    ["Total output", `${nf(r.thr, 0)} tok/s`, `${nf(r.seqs, 0)} answers at once`],
    ["Per 1M output tokens", money(r.perMTok), `${money(r.costHr)} per hour`],
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_70%_20%,rgba(47,107,255,.22),transparent),radial-gradient(50%_50%_at_20%_90%,rgba(255,126,81,.18),transparent)] blur-2xl" />
      <div className="rounded-3xl border border-line-2 bg-panel/90 p-5 shadow-pop backdrop-blur sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">
              {r.model.name} · INT8{stackRows.length ? ` + ${stackRows.length} RAG models` : ""}
            </p>
            <p className="truncate text-xs text-muted">
              {nf(r.users, 0)} users · {nf(r.S, 0)}-token context · {r.T.G}× {gpuLabel(r.gpu)}
            </p>
          </div>
          <span className="hidden rounded-full border border-line-2 px-2 py-0.5 font-mono text-[11px] text-muted sm:inline">auto: {r.T.G} GPUs</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <StatusPill ratio={r.ratio} />
          <span className="text-xs text-muted">of usable VRAM</span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-[52px] leading-none font-semibold tracking-[-0.03em]">{nf(r.ratio * 100, 0)}%</span>
          <span className="pb-1 text-right text-[13px] text-muted">
            <b className="text-xl font-semibold text-fg">{nf(r.used, 1)}</b> GB
            <span className="block">of {nf(r.usableRep, 1)} GB usable</span>
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${st.color} 18%, var(--track))` }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.ratio * 100)}%`, background: st.color }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {tiles.map(([label, value, sub]) => (
            <div key={label} className="rounded-xl border border-line bg-panel-2 px-3.5 py-3">
              <span className="block text-xs font-semibold text-muted">{label}</span>
              <b className="block text-[21px] leading-tight font-semibold tracking-[-0.02em]">{value}</b>
              <span className="text-xs text-faint">{sub}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 mb-2 font-display text-[12px] font-bold tracking-[0.14em] text-muted uppercase">Where the GPU memory goes</p>
        <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden>
          {parts.map((p, i) => (
            <i key={p.name} className="block h-full" style={{ width: `${(p.value / cap) * 100}%`, background: SERIES[i] }} />
          ))}
          <i className="block h-full flex-1 bg-track" />
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {parts.map((p, i) => (
            <li key={p.name} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-muted">
                <i className="size-2.5 flex-none rounded-[3px]" style={{ background: SERIES[i] }} />
                <span className="truncate">{p.name}</span>
              </span>
              <b className="font-semibold tabular-nums">{gb(p.value)}</b>
            </li>
          ))}
        </ul>
        {stackRows.length ? (
          <>
            <p className="mt-4 mb-2 font-display text-[12px] font-bold tracking-[0.14em] text-muted uppercase">Same GPUs, whole stack</p>
            <ul className="grid gap-1.5 text-xs">
              {stackRows.map((x) => (
                <li key={x.c.id} className="flex items-center gap-2">
                  <span className="rounded-full bg-blue/14 px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] whitespace-nowrap text-blue uppercase">
                    {(TASKS[x.c.task] || { l: x.c.task }).l}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{x.c.name}</span>
                  <b className="font-semibold tabular-nums">{gb(x.gpuMem)}</b>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
