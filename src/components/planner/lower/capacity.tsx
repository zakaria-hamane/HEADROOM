"use client";

import * as React from "react";
import { Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanner } from "@/components/planner/context";
import { capacityLimits, scalingSweep, type ScalingPoint } from "@/lib/planner/compute";
import { READ_TPS } from "@/lib/planner/defaults";
import { compact, gpuLabel, nf, spd, tm } from "@/lib/planner/format";

const H = 190; // plot height
const M = { top: 14, right: 14, bottom: 30, left: 46 }; // the bottom band holds the x-axis labels

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}

interface ChartProps {
  title: string;
  points: ScalingPoint[];
  y: (p: ScalingPoint) => number;
  yTick: (v: number) => string;
  reference: { value: number; label: string };
  /** Values above this are clipped at the top of the plot (the region beyond the limit is already marked). */
  yCap?: number;
  maxFit: number;
  currentUsers: number;
  hover: number | null;
  onHover: (i: number | null) => void;
  describe: (p: ScalingPoint) => string;
}

function CapacityChart({ title, points, y, yTick, reference, yCap, maxFit, currentUsers, hover, onHover, describe }: ChartProps) {
  const clipId = React.useId();
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(280, width);
  const innerW = W - M.left - M.right;
  const xMax = Math.max(points[points.length - 1]?.users ?? 2000, 2000);
  const lx = (u: number) => M.left + (Math.log10(u) / Math.log10(xMax)) * innerW;
  const peak = Math.max(reference.value * 1.25, ...points.map(y).filter(Number.isFinite));
  const maxY = niceMax(Math.min(yCap ?? Infinity, peak) * 1.05);
  const clipped = peak > maxY;
  const ly = (v: number) => M.top + H - (v / maxY) * H;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * maxY);
  const xTicks = [1, 10, 100, 1000, 10000, 100000].filter((t) => t <= xMax);
  const path = points.map((p, i) => `${i ? "L" : "M"}${lx(p.users).toFixed(1)},${ly(y(p)).toFixed(1)}`).join("");
  const oomX = maxFit > 0 && maxFit < xMax ? lx(maxFit + 0.5) : maxFit === 0 ? M.left : null;
  const cur = points.find((p) => p.users === currentUsers);
  const hp = hover != null ? points[hover] : null;

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0,
      bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(lx(p.users) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  return (
    <figure className="m-0 min-w-0 rounded-2xl border border-line bg-panel-2 p-3.5">
      <figcaption className="text-[13px] font-semibold">{title}</figcaption>
      <div ref={ref} className="relative mt-2" style={{ height: H + M.top + M.bottom }}>
        {width > 0 ? (
          <svg
            width={W}
            height={H + M.top + M.bottom}
            className="block touch-none select-none outline-none focus-visible:rounded-lg focus-visible:shadow-[var(--focus)]"
            role="img"
            tabIndex={0}
            aria-label={`${title} against concurrent users, from 1 to ${compact(xMax)}. Use the arrow keys to read values.`}
            onPointerMove={(e) => onHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => onHover(null)}
            onBlur={() => onHover(null)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const start = hover ?? Math.max(0, points.findIndex((p) => p.users === currentUsers));
              onHover(Math.min(points.length - 1, Math.max(0, start + (e.key === "ArrowRight" ? 1 : -1))));
            }}
          >
            {/* doesn't-fit region */}
            {oomX != null ? (
              <g>
                <rect x={oomX} y={M.top} width={Math.max(0, W - M.right - oomX)} height={H} fill="var(--status-critical)" opacity={0.08} />
                <text x={oomX + 6} y={M.top + 13} fontSize={11} fill="var(--muted)">
                  Doesn&apos;t fit in memory
                </text>
              </g>
            ) : null}
            {/* grid + y axis */}
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={ly(t)} y2={ly(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
                <text x={M.left - 8} y={ly(t) + 4} fontSize={11} textAnchor="end" fill="var(--muted)" className="tabular-nums">
                  {yTick(t)}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={lx(t)} y={M.top + H + 18} fontSize={11} textAnchor="middle" fill="var(--muted)" className="tabular-nums">
                {compact(t)}
              </text>
            ))}
            {/* reference line (a threshold, so it is dashed) */}
            <line x1={M.left} x2={W - M.right} y1={ly(reference.value)} y2={ly(reference.value)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={W - M.right} y={ly(reference.value) - 5} fontSize={11} textAnchor="end" fill="var(--muted)">
              {reference.label}
            </text>
            {/* the series, clipped to the plot */}
            <defs>
              <clipPath id={clipId}>
                <rect x={M.left} y={M.top - 6} width={innerW + 6} height={H + 6} />
              </clipPath>
            </defs>
            <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipId})`} />
            {clipped ? (
              <text x={W - M.right - 4} y={M.top + 28} fontSize={11} textAnchor="end" fill="var(--muted)">
                ↑ continues above {yTick(maxY)}
              </text>
            ) : null}
            {/* your load */}
            {cur ? (
              <g>
                <line x1={lx(cur.users)} x2={lx(cur.users)} y1={M.top} y2={M.top + H} stroke="var(--muted)" strokeWidth={1} opacity={0.6} />
                <circle cx={lx(cur.users)} cy={ly(y(cur))} r={4.5} fill="var(--series-1)" stroke="var(--panel-2)" strokeWidth={2} />
                <text x={lx(cur.users)} y={M.top + H + 18} dy={0} fontSize={11} textAnchor="middle" fill="var(--text)" fontWeight={600} opacity={hp ? 0 : 1}>
                  {xTicks.some((t) => Math.abs(lx(t) - lx(cur.users)) < 22) ? "" : compact(cur.users)}
                </text>
              </g>
            ) : null}
            {/* crosshair */}
            {hp ? (
              <g pointerEvents="none">
                <line x1={lx(hp.users)} x2={lx(hp.users)} y1={M.top} y2={M.top + H} stroke="var(--text)" strokeWidth={1} opacity={0.35} />
                <circle cx={lx(hp.users)} cy={ly(y(hp))} r={4.5} fill="var(--series-1)" stroke="var(--panel-2)" strokeWidth={2} />
              </g>
            ) : null}
          </svg>
        ) : null}
        {hp && width > 0 ? (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg border border-line-2 bg-panel px-2.5 py-1.5 text-xs shadow-pop"
            style={lx(hp.users) > W / 2 ? { right: W - lx(hp.users) + 10 } : { left: lx(hp.users) + 10 }}
          >
            <b className="block text-[13px]">{describe(hp)}</b>
            <span className="text-muted">
              {nf(hp.users, 0)} users{hp.fits ? "" : " · doesn't fit"}
            </span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

export function Capacity() {
  const { state, results, gpu } = usePlanner();
  const r = results.inf!;
  const deferred = React.useDeferredValue(state);
  const G = r.T.G;
  const points = React.useMemo(() => scalingSweep(deferred, G), [deferred, G]);
  const limits = React.useMemo(() => capacityLimits(deferred, G, READ_TPS), [deferred, G]);
  const [hover, setHover] = React.useState<number | null>(null);
  const [table, setTable] = React.useState(false);
  const fmtUsers = (u: number) => (u >= limits.max ? `${nf(limits.max, 0)}+` : nf(u, 0));

  return (
    <div className={deferred !== state ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <p className="m-0 max-w-[80ch] text-[13px] text-muted">
        The same hardware ({G}× {gpuLabel(gpu)}, {r.q.l} weights, {nf(r.S, 0)}-token context) as more people use it at once. Your load is marked at {nf(state.users, 0)} users.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-panel-2 px-3.5 py-3">
          <span className="text-xs font-semibold text-muted">Fits in memory up to</span>
          <b className="block text-[22px] leading-tight font-semibold">{limits.maxFit ? `${fmtUsers(limits.maxFit)} users` : "No users"}</b>
          <span className="text-xs text-faint">{limits.maxFit >= state.users ? `${nf(limits.maxFit / state.users, 1)}× your load` : "below your load: add GPUs"}</span>
        </div>
        <div className="rounded-xl border border-line bg-panel-2 px-3.5 py-3">
          <span className="text-xs font-semibold text-muted">Faster than people read up to</span>
          <b className="block text-[22px] leading-tight font-semibold">{limits.maxReadable ? `${fmtUsers(limits.maxReadable)} users` : "No users"}</b>
          <span className="text-xs text-faint">≥ {READ_TPS} tokens/s per user, while it still fits</span>
        </div>
        <div className="rounded-xl border border-line bg-panel-2 px-3.5 py-3">
          <span className="text-xs font-semibold text-muted">At your load</span>
          <b className="block text-[22px] leading-tight font-semibold">{spd(r.speed)} tok/s</b>
          <span className="text-xs text-faint">
            first word {tm(r.ttftK)} · {nf(r.ratio * 100, 0)}% of usable memory
          </span>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <CapacityChart
          title="Speed per user (tokens/s)"
          points={points}
          y={(p) => p.speed}
          yTick={(v) => nf(v, v < 10 && v > 0 ? 1 : 0)}
          reference={{ value: READ_TPS, label: "Reading speed" }}
          maxFit={limits.maxFit}
          currentUsers={state.users}
          hover={hover}
          onHover={setHover}
          describe={(p) => `${spd(p.speed)} tok/s`}
        />
        <CapacityChart
          title="GPU memory used (% of usable)"
          points={points}
          y={(p) => p.ratio * 100}
          yTick={(v) => `${nf(v, 0)}%`}
          reference={{ value: 100, label: "Usable limit" }}
          yCap={300}
          maxFit={limits.maxFit}
          currentUsers={state.users}
          hover={hover}
          onHover={setHover}
          describe={(p) => `${nf(p.ratio * 100, 0)}% of usable`}
        />
      </div>
      <p className="mt-2 text-xs text-faint">Horizontal axis: concurrent users on a log scale. Hover or use the arrow keys on a chart to read values.</p>
      <div className="mt-2">
        <Button size="sm" variant="ghost" onClick={() => setTable((t) => !t)} aria-expanded={table}>
          <Table2 /> {table ? "Hide the table" : "Show as a table"}
        </Button>
        {table ? (
          <div className="mt-2 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-panel-2 text-muted">
                  {["Users", "Speed / user", "First word", "Total output", "Memory", "Fits"].map((h, i) => (
                    <th key={h} scope="col" className={`border-b border-line px-2.5 py-2 font-display text-[13px] tracking-[0.06em] uppercase ${i ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.users} className={`border-b border-line last:border-0 ${p.users === state.users ? "bg-blue/12" : ""}`}>
                    <td className="px-2.5 py-1.5 font-mono tabular-nums">{nf(p.users, 0)}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{spd(p.speed)} tok/s</td>
                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{tm(p.ttft)}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{nf(p.thr, 0)} tok/s</td>
                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{nf(p.ratio * 100, 0)}%</td>
                    <td className={`px-2.5 py-1.5 text-right font-semibold ${p.fits ? "text-green" : "text-red"}`}>{p.fits ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
