"use client";

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useTheme } from "@/components/theme";
import { usePlanner } from "@/components/planner/context";
import type { InfRun } from "@/lib/planner/compute";
import { READ_TPS } from "@/lib/planner/defaults";
import { gpuLabel, nf, spd, tm } from "@/lib/planner/format";

const MAX_CELLS = 400;
const SAMPLE_Q = "Summarize our incident-response procedure for a production outage, and list who must be notified in the first hour.";
const SAMPLE_A =
  "Here is a summary of the incident-response procedure for a production outage, based on the runbook (v3.2) and the escalation matrix.\n\n" +
  "1. Detect and declare (0–5 min). The on-call engineer confirms the alert, opens an incident ticket and sets the severity: SEV-1 if a customer-facing service is down, SEV-2 if it is degraded.\n\n" +
  "2. Assemble the team (5–15 min). The incident commander opens the bridge call and assigns three roles: technical lead, communications lead and scribe. Every action and decision is logged in the ticket with a timestamp.\n\n" +
  "3. Contain and restore (15–60 min). The technical lead applies the documented mitigation first (failover, rollback or scale-out) before any root-cause analysis. If the service is not restored within 30 minutes, the incident is escalated to the platform architect on duty.\n\n" +
  "4. Communicate. Status updates go out every 30 minutes, even when nothing has changed.\n\n" +
  "Who must be notified in the first hour:\n• the service owner and the on-call manager, as soon as a SEV-1 is declared;\n• the customer success manager of each affected client, within 30 minutes;\n• the security officer, if there is any sign of data exposure or unauthorized access;\n• the head of operations, if the outage lasts longer than one hour.\n\n" +
  "After recovery, the incident commander schedules a blameless post-mortem within five working days. The report covers the timeline, the root cause, the customer impact and the corrective actions, each with an owner and a due date.";

function tokenize(t: string): string[] {
  const out: string[] = [];
  (t.match(/\s*\S+/g) || []).forEach((p) => {
    const lead = (p.match(/^\s*/) || [""])[0],
      w = p.slice(lead.length);
    if (w.length <= 6) {
      out.push(lead + w);
      return;
    }
    for (let i = 0; i < w.length; i += 4) out.push((i === 0 ? lead : "") + w.slice(i, i + 4));
  });
  return out;
}
const TOK = tokenize(SAMPLE_A);
const PLACEHOLDER = "Press Play: the answer will appear at the computed speed, after the first-word delay.";

type Phase = "ready" | "prefill" | "stream" | "done";
type Cell = { ph: 0 | 1 | 2 | 3; until: number; prog: number; len: number; jit: number };
interface Stats {
  elapsed: string;
  first: string;
  tokens: string;
  rate: string;
  reader: string;
  readerTone: "red" | "green" | "amber" | "muted";
  prefill: string | null;
  prefillPct: number;
}
const READY_STATS: Stats = { elapsed: "0.0 s", first: "–", tokens: `0 / ${TOK.length}`, rate: "–", reader: "", readerTone: "muted", prefill: null, prefillPct: 0 };
const TONE_CLASS = { red: "text-red", green: "text-green", amber: "text-amber", muted: "text-muted" } as const;

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export function Simulation() {
  const { results } = usePlanner();
  const R = results.inf as InfRun;
  const { resolved } = useTheme();
  const rRef = React.useRef(R);
  React.useLayoutEffect(() => {
    rRef.current = R;
  }, [R]);

  const outRef = React.useRef<HTMLDivElement>(null);
  const botRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const sim = React.useRef({
    running: false,
    t: 0,
    phase: "ready" as Phase,
    mode: "burst" as "one" | "burst",
    wait: true,
    tStart: 0,
    tFirst: null as number | null,
    tDone: 0,
    tokF: 0,
    emitted: 0,
    readIdx: 0,
    target: 0,
    last: 0,
    spans: [] as HTMLSpanElement[],
    cursor: null as HTMLSpanElement | null,
    crowd: [] as Cell[],
    layout: null as null | { N: number; w: number; h: number; cell: number; cols: number; ox: number; oy: number; gap: number },
    colors: null as null | Record<string, string>,
    statT: 0,
    raf: 0,
    initialized: false,
    /** what the Play button shows (mirrors React state, readable from effects) */
    wantRunning: false,
  });

  const [running, setRunning] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("ready");
  const [mode, setMode] = React.useState<"one" | "burst">("burst");
  const [wait, setWait] = React.useState(true);
  const [stats, setStats] = React.useState<Stats>(READY_STATS);
  const [crowdStats, setCrowdStats] = React.useState({ think: 0, wait: 0, write: 0, thr: 0 });

  const colors = React.useCallback(() => {
    const s = sim.current;
    if (!s.colors) {
      const cs = getComputedStyle(document.documentElement);
      const g = (k: string) => cs.getPropertyValue(k).trim();
      s.colors = { cell: g("--cell"), on: g("--panel-3"), blue: g("--series-1"), amber: g("--status-warning"), green: g("--status-good") };
    }
    return s.colors;
  }, []);

  const syncCrowd = React.useCallback((force: boolean) => {
    const s = sim.current;
    const N = Math.min(rRef.current ? rRef.current.users : 0, MAX_CELLS);
    if (!force && s.crowd.length === N) return;
    s.crowd = [];
    for (let i = 0; i < N; i++) s.crowd.push({ ph: 0, until: s.t + Math.random() * 2.5, prog: 0, len: 1, jit: 1 });
    s.layout = null;
  }, []);

  const drawCrowd = React.useCallback(() => {
    const cv = canvasRef.current;
    const s = sim.current,
      r = rRef.current;
    if (!cv || !r) return;
    const dpr = window.devicePixelRatio || 1,
      w = cv.clientWidth,
      h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      s.layout = null;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const N = s.crowd.length;
    if (!N) return;
    let L = s.layout;
    if (!L || L.N !== N || L.w !== w || L.h !== h) {
      let cell = Math.floor(Math.sqrt((w * h) / N));
      while (cell > 3 && Math.floor(w / cell) * Math.floor(h / cell) < N) cell--;
      const cols = Math.max(1, Math.floor(w / cell)),
        rows = Math.ceil(N / cols);
      L = s.layout = { N, w, h, cell, cols, ox: (w - cols * cell) / 2, oy: (h - rows * cell) / 2, gap: Math.max(1, Math.round(cell * 0.16)) };
    }
    const c = colors(),
      t = s.t,
      cnt = [0, 0, 0, 0],
      sz = L.cell - L.gap,
      rad = Math.min(4, sz / 4);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let live = 0;
    for (let i = 0; i < N; i++) {
      const u = s.crowd[i],
        x = L.ox + (i % L.cols) * L.cell + L.gap / 2,
        y = L.oy + Math.floor(i / L.cols) * L.cell + L.gap / 2;
      cnt[u.ph]++;
      if (u.ph === 2) {
        live += r.speed * u.jit;
        ctx.fillStyle = c.on;
        rrect(ctx, x, y, sz, sz, rad);
        ctx.fill();
        ctx.save();
        rrect(ctx, x, y, sz, sz, rad);
        ctx.clip();
        const fh = sz * Math.min(1, u.prog / u.len);
        ctx.fillStyle = c.blue;
        ctx.fillRect(x, y + sz - fh, sz, fh);
        ctx.restore();
      } else if (u.ph === 1) {
        ctx.globalAlpha = reduced ? 0.8 : 0.5 + 0.45 * (0.5 + 0.5 * Math.sin(t * 5 + i));
        ctx.fillStyle = c.amber;
        rrect(ctx, x, y, sz, sz, rad);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (u.ph === 3) {
        ctx.fillStyle = c.green;
        rrect(ctx, x, y, sz, sz, rad);
        ctx.fill();
      } else {
        ctx.fillStyle = c.cell;
        rrect(ctx, x, y, sz, sz, rad);
        ctx.fill();
      }
    }
    const now = performance.now();
    if (!s.running || now - s.statT > 200) {
      s.statT = now;
      const scale = r.users / N;
      setCrowdStats({ think: (cnt[0] + cnt[3]) * scale, wait: cnt[1] * scale, write: cnt[2] * scale, thr: live * scale });
    }
  }, [colors]);

  const placeholder = React.useCallback(() => {
    const out = outRef.current;
    if (!out) return;
    out.textContent = "";
    const ph = document.createElement("span");
    ph.className = "text-faint";
    ph.textContent = PLACEHOLDER;
    out.appendChild(ph);
  }, []);

  const startAnswer = React.useCallback(() => {
    const s = sim.current,
      r = rRef.current,
      out = outRef.current;
    if (!out) return;
    out.textContent = "";
    const cur = document.createElement("span");
    cur.className = "inline-block h-[15px] w-2 animate-blink rounded-[2px] bg-blue align-[-2px] ml-px";
    out.appendChild(cur);
    s.cursor = cur;
    s.spans = [];
    s.emitted = 0;
    s.tokF = 0;
    s.readIdx = 0;
    s.tStart = s.t;
    s.tFirst = null;
    s.target = s.mode === "burst" ? r.ttftK : r.ttft1;
    s.phase = s.wait ? "prefill" : "stream";
    if (s.phase === "stream") s.tFirst = s.t;
    setPhase(s.phase);
    setStats({ ...READY_STATS, first: s.phase === "stream" ? "0 ms" : "…" });
    if (botRef.current) botRef.current.scrollTop = 0;
  }, []);

  const stepAnswer = React.useCallback((dtIn: number) => {
    const s = sim.current,
      r = rRef.current,
      bot = botRef.current,
      out = outRef.current;
    let dt = dtIn;
    const el = s.t - s.tStart;
    let prefill: string | null = null,
      prefillPct = 0,
      first: string | null = null;
    if (s.phase === "prefill") {
      prefill = `Reading the ${nf(r.P, 0)}-token prompt${s.mode === "burst" && r.k > 1 ? ` along with ${r.k - 1} other prompts` : ""}… ${tm(el)}`;
      prefillPct = Math.min(100, (el / Math.max(1e-6, s.target)) * 100);
      if (el >= s.target) {
        s.phase = "stream";
        s.tFirst = s.t;
        prefill = null;
        first = tm(el);
        setPhase("stream");
      } else dt = 0;
    }
    if (s.phase === "stream" && out && bot) {
      s.tokF += dt * r.speed;
      const n = Math.min(TOK.length, Math.floor(s.tokF));
      if (n > s.emitted) {
        const nearBottom = bot.scrollHeight - bot.scrollTop - bot.clientHeight < 40,
          frag = document.createDocumentFragment();
        for (let i = s.emitted; i < n; i++) {
          const sp = document.createElement("span");
          sp.textContent = TOK[i];
          frag.appendChild(sp);
          s.spans.push(sp);
        }
        out.insertBefore(frag, s.cursor);
        s.emitted = n;
        if (nearBottom) bot.scrollTop = bot.scrollHeight;
      }
      if (s.emitted >= TOK.length) {
        s.phase = "done";
        s.tDone = s.t;
        if (s.cursor) s.cursor.style.display = "none";
        setPhase("done");
      }
    }
    let reader = "",
      readerTone: Stats["readerTone"] = "muted";
    if (s.tFirst !== null) {
      const rd = Math.floor((s.t - s.tFirst) * READ_TPS),
        lim = Math.min(rd, s.emitted);
      for (; s.readIdx < lim; s.readIdx++) s.spans[s.readIdx].className = "read";
      if (s.phase === "stream" && rd > s.emitted) {
        reader = "The reader is waiting for text";
        readerTone = "red";
      } else if (s.phase === "stream") {
        reader = `Text is ${nf(s.emitted - rd, 0)} tokens ahead of the reader`;
        readerTone = "green";
      } else if (s.readIdx < TOK.length) {
        reader = "Answer complete · the reader is still reading";
        readerTone = "green";
      } else reader = "Read to the end";
    } else if (s.phase === "prefill") {
      reader = "The user is waiting for the first word";
      readerTone = "amber";
    }
    const tEnd = s.phase === "done" ? s.tDone : s.t;
    setStats((prev) => ({
      elapsed: `${nf(Math.max(0, tEnd - s.tStart), 1)} s`,
      first: first ?? prev.first,
      tokens: `${nf(s.emitted, 0)} / ${TOK.length}`,
      rate: s.tFirst !== null && tEnd > s.tFirst ? `${spd(s.emitted / (tEnd - s.tFirst))} tok/s` : "–",
      reader,
      readerTone,
      prefill,
      prefillPct,
    }));
  }, []);

  const stepCrowd = React.useCallback(
    (dt: number) => {
      const s = sim.current,
        r = rRef.current,
        t = s.t;
      syncCrowd(false);
      for (const u of s.crowd) {
        if (u.ph === 0) {
          if (t >= u.until) {
            u.ph = 1;
            u.until = t + (s.wait ? r.ttft1 + Math.random() * Math.max(0, r.ttftK - r.ttft1) : 0);
          }
        } else if (u.ph === 1) {
          if (t >= u.until) {
            u.ph = 2;
            u.prog = 0;
            u.len = 150 + Math.random() * 450;
            u.jit = 0.92 + Math.random() * 0.16;
          }
        } else if (u.ph === 2) {
          u.prog += dt * r.speed * u.jit;
          if (u.prog >= u.len) {
            u.ph = 3;
            u.until = t + 0.6;
          }
        } else if (t >= u.until) {
          u.ph = 0;
          u.until = t + 4 + Math.random() * 10;
        }
      }
    },
    [syncCrowd],
  );

  const loop = React.useCallback(
    (now: number) => {
      const s = sim.current;
      if (!s.running) return;
      const dt = Math.min(0.1, Math.max(0, (now - s.last) / 1000));
      s.last = now;
      s.t += dt;
      stepAnswer(dt);
      stepCrowd(dt);
      drawCrowd();
      if (s.phase === "done" && s.readIdx >= TOK.length && !s.crowd.length) {
        s.running = false;
        s.wantRunning = false;
        setRunning(false);
        return;
      }
      s.raf = requestAnimationFrame(loop);
    },
    [stepAnswer, stepCrowd, drawCrowd],
  );

  const playPause = () => {
    const s = sim.current;
    if (s.running) {
      s.running = false;
      s.wantRunning = false;
      cancelAnimationFrame(s.raf);
      setRunning(false);
      return;
    }
    if (s.phase === "ready" || s.phase === "done") startAnswer();
    if (!s.crowd.length) syncCrowd(true);
    s.running = true;
    s.wantRunning = true;
    s.last = performance.now();
    setRunning(true);
    s.raf = requestAnimationFrame(loop);
  };

  const reset = React.useCallback(() => {
    const s = sim.current;
    s.running = false;
    s.wantRunning = false;
    cancelAnimationFrame(s.raf);
    s.t = 0;
    s.phase = "ready";
    s.tFirst = null;
    setRunning(false);
    setPhase("ready");
    setStats(READY_STATS);
    placeholder();
    syncCrowd(true);
    drawCrowd();
  }, [placeholder, syncCrowd, drawCrowd]);

  // First mount: placeholder text and an idle crowd. When Next.js hides this page the loop pauses, and it resumes
  // when the page is shown again (the DOM, and so the streamed text, is preserved in between).
  React.useEffect(() => {
    const s = sim.current;
    if (!s.initialized) {
      s.initialized = true;
      placeholder();
      syncCrowd(true);
    }
    const first = requestAnimationFrame(() => drawCrowd());
    if (s.wantRunning && !s.running) {
      s.running = true;
      s.last = performance.now();
      s.raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(first);
      s.running = false;
      cancelAnimationFrame(s.raf);
    };
  }, [placeholder, syncCrowd, drawCrowd, loop]);

  // results changed while paused: resize the crowd and redraw
  React.useEffect(() => {
    if (!sim.current.running) {
      syncCrowd(false);
      drawCrowd();
    }
  }, [R, syncCrowd, drawCrowd]);

  // theme changed: re-read colors
  React.useEffect(() => {
    sim.current.colors = null;
    drawCrowd();
  }, [resolved, drawCrowd]);

  React.useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      sim.current.layout = null;
      drawCrowd();
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, [drawCrowd]);

  const playLabel = running ? "Pause" : phase === "done" ? "Replay" : phase === "ready" ? "Play" : "Resume";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <p className="m-0 text-xs text-muted">
          {R.model.name} ({R.q.l} / {R.kq.l} KV) on {R.T.G}× {gpuLabel(R.gpu)} · {spd(R.speed)} tokens/s per user
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={playPause}>
            {running ? <Pause /> : <Play />}
            {playLabel}
          </Button>
          <Button onClick={reset}>
            <RotateCcw /> Reset
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            <input
              type="checkbox"
              className="size-[15px] accent-blue"
              checked={wait}
              onChange={(e) => {
                setWait(e.target.checked);
                sim.current.wait = e.target.checked;
                if (sim.current.phase === "prefill" && !e.target.checked) sim.current.target = 0;
              }}
            />
            Wait for the first word
          </label>
          <Segmented<"one" | "burst">
            label="First word scenario"
            size="sm"
            value={mode}
            onChange={(v) => {
              setMode(v);
              sim.current.mode = v;
            }}
            options={[
              { value: "one", label: `One prompt · ${tm(R.ttft1)}` },
              { value: "burst", label: `${R.k > 1 ? `${R.k} prompts at once · ` : "Burst · "}${tm(R.ttftK)}` },
            ]}
          />
        </div>
      </div>
      <p className="mt-2.5 text-xs text-muted">
        A simulation, not a real model: text appears at the speed computed above. Green highlight = what a person has read so far at ≈ {READ_TPS} tokens/s.
      </p>
      <div className="mt-3.5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-line bg-panel-2 p-3.5">
          <div className="max-w-[94%] self-end rounded-xl bg-panel-3 px-3 py-2.5 text-[13.5px]">
            <span className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">User</span>
            <p className="mt-1">{SAMPLE_Q}</p>
            <span className="mt-1.5 inline-block text-[11.5px] text-faint">+ {nf(R.P, 0)} tokens of prompt: system prompt, retrieved passages, history</span>
          </div>
          <div ref={botRef} className="h-[300px] overflow-auto rounded-xl border border-line bg-panel px-3 py-2.5 text-[13.5px]">
            <span className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Assistant</span>
            {stats.prefill ? (
              <div className="mt-2.5 text-[12.5px] font-semibold text-amber">
                {stats.prefill}
                <div className="mt-1.5 h-1 max-w-[360px] overflow-hidden rounded bg-track">
                  <i className="block h-full bg-status-warning" style={{ width: `${stats.prefillPct}%` }} />
                </div>
              </div>
            ) : null}
            <div ref={outRef} className="sim-out mt-1.5 leading-relaxed whitespace-pre-wrap" />
          </div>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted">
            <span>
              Elapsed <b className="text-fg tabular-nums">{stats.elapsed}</b>
            </span>
            <span>
              First word <b className="text-fg tabular-nums">{stats.first}</b>
            </span>
            <span>
              Tokens <b className="text-fg tabular-nums">{stats.tokens}</b>
            </span>
            <span>
              Speed <b className="text-fg tabular-nums">{stats.rate}</b>
            </span>
            <span className={`font-semibold sm:ml-auto ${TONE_CLASS[stats.readerTone]}`}>{stats.reader}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-line bg-panel-2 p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2.5">
            <b>{nf(R.users, 0)} concurrent users</b>
            <span className="text-xs text-muted">{R.users > MAX_CELLS ? `showing ${MAX_CELLS} of ${nf(R.users, 0)}` : "one square per user"}</span>
          </div>
          <canvas ref={canvasRef} className="block h-[210px] w-full sm:h-[268px]" aria-label="Concurrent users simulation" role="img" />
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-[3px] bg-cell ring-1 ring-line-2" /> Reading or typing <b className="text-fg tabular-nums">{nf(crowdStats.think, 0)}</b>
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-[3px] bg-status-warning" /> Waiting for the first word <b className="text-fg tabular-nums">{nf(crowdStats.wait, 0)}</b>
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-[3px] bg-series-1" /> Answer being written <b className="text-fg tabular-nums">{nf(crowdStats.write, 0)}</b>
            </span>
            <span>
              Live output <b className="text-fg tabular-nums">{nf(crowdStats.thr, 0)}</b> tok/s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
