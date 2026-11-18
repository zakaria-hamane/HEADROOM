import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  ChartColumn,
  Coins,
  FlaskConical,
  Gauge,
  HardDrive,
  Layers,
  Link2,
  Save,
  Server,
  Columns3,
  FileCode2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { TemplateGallery } from "@/components/dashboard/template-gallery";
import { StatusPill } from "@/components/ui/status";
import { CATALOG_STATS, GPU_INDEX } from "@/lib/catalog";
import { ENGINES, TASKS, WQ } from "@/lib/engine";
import { runInference } from "@/lib/planner/compute";
import { defaultState } from "@/lib/planner/defaults";
import { gb, gpuLabel, money, ms, nf, pc, spd, tm } from "@/lib/planner/format";
import { templateState } from "@/lib/planner/templates";
import { siteConfig } from "@/lib/site";

const FEATURES = [
  { icon: Boxes, title: "The whole RAG & agent stack", text: `The LLM plus ${CATALOG_STATS.companions} embedding, reranking, OCR, speech-to-text, text-to-speech and guardrail models, on the same GPUs, on the CPU or as an API.` },
  { icon: Layers, title: "Memory, line by line", text: "Weights, KV cache per user, runtime, CUDA graphs, activations and every model in the stack, against what each GPU can really hold." },
  { icon: Gauge, title: "Speed and first word", text: "Tokens per second per user, and the time from question to first word: embedding, vector search, reranking, guardrails and the LLM's first token, under a burst." },
  { icon: Server, title: "How many GPUs", text: "The smallest server that fits, or a cluster with tensor and pipeline parallelism over NVLink, InfiniBand or Ethernet." },
  { icon: ChartColumn, title: "Every GPU, side by side", text: `The same workload on all ${CATALOG_STATS.gpus} GPUs: count needed, speed, first word, cost per hour and per million tokens.` },
  { icon: FlaskConical, title: "Fine-tuning", text: "Full, LoRA and QLoRA with optimizer states, ZeRO / FSDP sharding, checkpointing, training time and cost." },
  { icon: HardDrive, title: "Offloading", text: "Move layers or the KV cache to RAM or NVMe, run them on the CPU or stream over PCIe, and see what it costs in speed." },
  { icon: Coins, title: "Cost and energy", text: "Cloud price or your own, electricity, power draw, cost per million tokens, and the CPU and RAM the server needs." },
];

const FAQ = [
  {
    q: "How accurate are the numbers?",
    a: "They are planning estimates built from each model's published architecture and vendor datasheets: memory is computed exactly from the layer layout, speed from bytes read per token over memory bandwidth (with an efficiency factor per runtime), compute and interconnect. Real systems vary with kernels, batching and drivers, so validate with a load test before you buy.",
  },
  {
    q: "Which units do you use?",
    a: "Memory is in GB = GiB (2³⁰ bytes), the way nvidia-smi reports it. Bandwidth is in decimal GB/s and compute in dense TFLOPS, without sparsity.",
  },
  {
    q: "Does it handle MoE, MLA, sliding windows and hybrid models?",
    a: "Yes. Mixture-of-experts counts the experts each step actually touches, MLA models store their latent KV, sliding-window layers keep only their window, linear-attention and Mamba layers keep a fixed state, and quantized KV caches are supported per runtime.",
  },
  {
    q: "Which models besides the LLM can it size?",
    a: `${CATALOG_STATS.companions} RAG and agent models in 9 types: embedders, rerankers, document parsers and OCR, speech-to-text, text-to-speech, guardrails, vision, PII detection and routers. Each one gets its memory and its speed (query time, pages per hour, × real time for live audio), on the GPU next to the LLM, on the CPU, or as a hosted API with its price.`,
  },
  {
    q: "Do I need an account?",
    a: "No. The planner works without one and keeps your draft in the browser. An account lets you save plans with autosave, share read-only links and compare plans side by side.",
  },
  {
    q: "Can I bring setups from the original single-file planner?",
    a: "Yes. Setup codes from the original LLM GPU Planner load as they are: open the planner, choose More → Load a setup, and paste the code.",
  },
  {
    q: "Is my data private?",
    a: "Plans are private to your account unless you turn on a share link, which you can turn off at any time. Calculations run in your browser.",
  },
];

function seventyB() {
  return ["h100-sxm", "h200-sxm", "b200", "mi300x", "l40s", "rtx-pro-6000-server"]
    .filter((id) => GPU_INDEX[id])
    .map((id) => {
      const r = runInference({ ...defaultState(), modelId: "llama-3.3-70b", gpuId: id, wq: "fp8", kvq: "fp8", users: 32, seq: 8192, stack: [] });
      return { id, name: gpuLabel(r.gpu), n: r.fitN, speed: r.speed, ttft: r.ttftK, perMTok: r.price ? r.perMTok : null, costHr: r.price ? r.costHr : null };
    });
}

/** The "Voice agent" template, computed by the same engine as the planner. */
function voiceAgent() {
  const s = templateState("voice-agent");
  return s ? runInference(s) : null;
}

const PIPELINE = ["Speech-to-text", "Guardrail", "Embedder", "Vector search", "Reranker", "LLM", "Text-to-speech"];

function StackSection() {
  const r = voiceAgent();
  if (!r) return null;
  const st = r.st;
  const parts: string[] = [];
  if (st.emb) parts.push(`embed ${ms(st.emb)}`);
  if (st.search) parts.push(`search ${ms(st.search)}`);
  if (st.rr) parts.push(`rerank ${ms(st.rr)}`);
  if (st.guard) parts.push(`guard ${ms(st.guard)}`);
  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <p className="font-display text-sm font-bold tracking-[0.16em] text-orange uppercase">The whole stack</p>
          <h2 className="mt-2 font-display text-[36px] leading-none font-bold uppercase sm:text-[44px]">One GPU budget for every model</h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            An assistant is never just an LLM. It transcribes, checks, embeds, searches, reranks, answers and speaks, and every one of those models takes memory and
            compute from the same GPUs. Headroom sizes them together.
          </p>
          <ol className="mt-6 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
            {PIPELINE.map((step, i) => (
              <li key={step} className="flex items-center gap-1.5">
                <span className={i === 5 ? "primary-gradient rounded-full px-3 py-1 text-white" : "rounded-full border border-line-2 bg-panel px-3 py-1"}>{step}</span>
                {i < PIPELINE.length - 1 ? <ArrowRight className="size-3.5 text-faint" aria-hidden /> : null}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[13px] text-faint">Behind it: document parsing, OCR and indexing for your knowledge base.</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold">Example: a voice agent for {nf(r.users, 0)} users</h3>
              <p className="mt-0.5 text-[13px] text-muted">
                {r.model.name} with {st.rows.map((x) => x.c.name).join(", ")} on {r.T.G}× {gpuLabel(r.gpu)}
              </p>
            </div>
            <StatusPill ratio={r.ratio} size="sm" />
          </div>
          <p className="mt-3 text-[13px] text-muted">
            <b className="text-[22px] font-semibold text-fg">{nf(r.ratio * 100, 0)}%</b> of usable VRAM: {nf(r.used, 1)} of {nf(r.usableRep, 1)} GB, of which{" "}
            <b className="text-fg">{gb(st.gpuMem)}</b> for the RAG and voice models
          </p>
          <ul className="mt-4 grid gap-2">
            {st.rows.map((x) => (
              <li key={x.c.id} className="rounded-xl border border-line bg-panel-2 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="rounded-full bg-blue/14 px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] whitespace-nowrap text-blue uppercase">
                    {(TASKS[x.c.task] || { l: x.c.task }).l}
                  </span>
                  <b className="min-w-0 flex-1 truncate">{x.c.name}</b>
                  <span className="font-mono tabular-nums">{gb(x.gpuMem)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{x.metrics.join(" · ")}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted">
            Question → first word: {[...parts, `LLM ${tm(r.ttft1)}`].join(" + ")} = <b className="text-fg">{tm(r.ttft1 + st.retrieval)}</b>
            <br />
            {spd(r.speed)} tok/s per user · {money(r.perMTok)} per 1M tokens · the stack uses {pc(st.load, st.load < 0.1 ? 1 : 0)} of the GPUs&apos; compute
          </p>
          <Link href="/planner?template=voice-agent" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-blue">
            Open this in the planner <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const rows = seventyB();
  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="grid-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)] opacity-70" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-panel/70 px-3 py-1 text-xs font-semibold text-muted">
              <span className="size-1.5 rounded-full bg-orange" /> For teams shipping RAG, voice and agent apps
            </p>
            <h1 className="mt-5 font-display text-[44px] leading-[0.95] font-bold tracking-[0.005em] uppercase sm:text-[60px] lg:text-[68px]">
              Know your GPU <span className="text-gradient">headroom</span> before you buy.
            </h1>
            <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-muted">
              Size the GPUs for your whole agentic RAG stack, not just the LLM: embedders, rerankers, document parsers, speech-to-text, text-to-speech and guardrails
              share the same cards. Memory, tokens per second, question-to-first-word time, GPU count and cost per million tokens, from real architecture math.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/planner" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Open the planner <ArrowRight />
              </Link>
              <Link href="/sign-up" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Create free account
              </Link>
            </div>
            <p className="mt-4 text-xs text-faint">No account needed to plan. Sign up to save, share and compare.</p>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* stats */}
      <section className="border-y border-line bg-panel/60">
        <dl className="mx-auto grid max-w-[1240px] grid-cols-2 gap-y-6 px-4 py-8 sm:grid-cols-5 sm:px-6">
          {[
            [CATALOG_STATS.models, "LLMs"],
            [CATALOG_STATS.companions, "RAG & agent models"],
            [CATALOG_STATS.gpus, "GPUs & accelerators"],
            [Object.keys(WQ).length, "weight formats"],
            [Object.keys(ENGINES).length, "inference runtimes"],
          ].map(([n, label]) => (
            <div key={label as string} className="flex flex-col items-center text-center">
              <dt className="order-2 text-xs font-semibold text-muted">{label}</dt>
              <dd className="m-0 text-[32px] leading-tight font-semibold tracking-[-0.02em]">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* features */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <p className="font-display text-sm font-bold tracking-[0.16em] text-orange uppercase">What it answers</p>
        <h2 className="mt-2 max-w-[22ch] font-display text-[36px] leading-none font-bold uppercase sm:text-[44px]">Everything that decides the hardware bill</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-line bg-panel p-5 shadow-card">
              <span className="grid size-10 place-items-center rounded-xl bg-blue/12 text-blue">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <StackSection />

      {/* how it works + example */}
      <section className="border-y border-line bg-panel/50">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="font-display text-sm font-bold tracking-[0.16em] text-orange uppercase">How it works</p>
            <h2 className="mt-2 font-display text-[36px] leading-none font-bold uppercase sm:text-[44px]">Three choices, one answer</h2>
            <ol className="mt-8 grid gap-6">
              {[
                ["Pick the models", "An LLM from the catalog or your own architecture, plus the embedders, rerankers, parsers, speech and guardrail models around it."],
                ["Pick the hardware", "A GPU, a server or a cluster. Auto mode finds the smallest GPU count that fits the whole stack."],
                ["Describe the load", "Concurrent users, context length, questions per minute, live audio streams, pages to parse. Every number updates as you type."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="primary-gradient grid size-9 flex-none place-items-center rounded-xl font-semibold text-white">{i + 1}</span>
                  <span>
                    <b className="block text-[15px]">{t}</b>
                    <span className="text-[14px] text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5 shadow-card">
            <h3 className="text-[15px] font-semibold">Example: Llama 3.3 70B, FP8, 32 users, 8K context</h3>
            <p className="mt-1 text-[13px] text-muted">Smallest single server on each GPU, computed by the same engine as the planner.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-2 font-semibold">GPU</th>
                    <th className="py-2 text-right font-semibold">GPUs</th>
                    <th className="py-2 text-right font-semibold">Speed / user</th>
                    <th className="py-2 text-right font-semibold">First word</th>
                    <th className="py-2 text-right font-semibold">$ / 1M tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="py-2">
                        <Link href={`/planner?model=llama-3.3-70b&gpu=${r.id}`} className="font-semibold hover:text-blue">
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">{r.n ? `${r.n}×` : "> 16"}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{spd(r.speed)} tok/s</td>
                      <td className="py-2 text-right font-mono tabular-nums">{tm(r.ttft)}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{money(r.perMTok)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href="/planner?template=llama-70b-h100" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-blue">
              Open this in the planner <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* accounts */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
          <div>
            <p className="font-display text-sm font-bold tracking-[0.16em] text-orange uppercase">With a free account</p>
            <h2 className="mt-2 font-display text-[36px] leading-none font-bold uppercase sm:text-[44px]">Plans your team can trust</h2>
            <ul className="mt-8 grid gap-4 text-[14px]">
              {[
                [Save, "Saved plans with autosave", "Every change is kept. Rename, star, duplicate, export to JSON."],
                [Link2, "Read-only share links", "Send the exact setup to a colleague or a vendor. Turn the link off any time."],
                [Columns3, "Compare plans side by side", "Up to four plans with the best value per row marked."],
                [FileCode2, "Setup codes", "Paste a code to load a setup, including codes from the original planner."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Save;
                return (
                  <li key={t as string} className="flex gap-3.5">
                    <span className="grid size-9 flex-none place-items-center rounded-xl bg-orange/12 text-orange">
                      <I className="size-[18px]" />
                    </span>
                    <span>
                      <b className="block">{t as string}</b>
                      <span className="text-muted">{d as string}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link href="/sign-up" className={buttonVariants({ variant: "primary", size: "lg", className: "mt-8" })}>
              Create free account <ArrowRight />
            </Link>
          </div>
          <div>
            <p className="mb-3 text-[13px] font-semibold text-muted">Start from a template</p>
            <TemplateGallery limit={4} />
          </div>
        </div>
      </section>

      {/* methodology */}
      <section id="methodology" className="border-t border-line bg-panel/50">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="font-display text-sm font-bold tracking-[0.16em] text-orange uppercase">Methodology</p>
            <h2 className="mt-2 font-display text-[36px] leading-none font-bold uppercase sm:text-[44px]">Open math, no black box</h2>
            <p className="mt-4 text-[14px] text-muted">
              Every result in the planner has a “How it is calculated” tab that shows each formula with your numbers plugged in.
            </p>
          </div>
          <div className="grid gap-2.5">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-line bg-panel px-5 py-4 shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid size-6 flex-none place-items-center rounded-full border border-line-2 text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="mx-auto max-w-[1240px] px-4 pt-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-line-2 bg-panel p-10 text-center shadow-pop sm:p-14">
          <div className="absolute inset-0 -z-0 bg-[radial-gradient(50%_80%_at_20%_0%,rgba(47,107,255,.18),transparent),radial-gradient(50%_80%_at_90%_100%,rgba(255,126,81,.16),transparent)]" />
          <div className="relative">
            <h2 className="font-display text-[36px] leading-none font-bold uppercase sm:text-[48px]">Plan your next deployment</h2>
            <p className="mx-auto mt-3 max-w-[52ch] text-[15px] text-muted">Answer the GPU question in minutes, then share the plan with the people who sign the purchase order.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/planner" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Open the planner <ArrowRight />
              </Link>
              <Link href="/models" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Browse {CATALOG_STATS.models} models
              </Link>
            </div>
            <p className="mt-5 text-xs text-faint">{siteConfig.name} · planning estimates, not measurements</p>
          </div>
        </div>
      </section>
    </>
  );
}
