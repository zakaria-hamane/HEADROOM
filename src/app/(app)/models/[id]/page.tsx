import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/misc";
import { SpecGrid } from "@/components/planner/inputs";
import { MODEL_INDEX, MODELS } from "@/lib/catalog";
import { fitTable, kvTable, weightsAt } from "@/lib/catalog-insights";
import { WQ } from "@/lib/engine";
import { fmtP, gb, gpuLabel, nf, spd } from "@/lib/planner/format";
import { modelSpecs } from "@/lib/planner/specs";

export function generateStaticParams() {
  return MODELS.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: PageProps<"/models/[id]">): Promise<Metadata> {
  const { id } = await params;
  const m = MODEL_INDEX[id];
  if (!m) return { title: "Model not found" };
  return {
    title: `${m.name} GPU requirements`,
    description: `${m.name} (${fmtP(m.params)} parameters) needs ${gb(weightsAt(m, "bf16"))} at BF16, ${gb(weightsAt(m, "fp8"))} at FP8 and ${gb(weightsAt(m, "awq"))} at 4-bit, plus KV cache. See which GPUs it fits on.`,
  };
}

const FORMATS = ["bf16", "fp8", "int8", "nvfp4", "awq", "q8_0", "q6_k", "q5_k_m", "q4_k_m", "q3_k_m", "q2_k"];

export default function ModelPage({ params }: PageProps<"/models/[id]">) {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
      <Link href="/models" className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2" })}>
        <ArrowLeft /> All models
      </Link>
      <Suspense fallback={<Skeleton className="mt-4 h-96 rounded-2xl" />}>
        <ModelDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ModelDetail({ params }: { params: PageProps<"/models/[id]">["params"] }) {
  const { id } = await params;
  const m = MODEL_INDEX[id];
  if (!m) notFound();
  const kv = kvTable(m);
  const fits = fitTable(m);
  return (
    <>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {m.org ? <Badge tone="neutral">{m.org}</Badge> : null}
            {m.moe ? <Badge tone="violet">Mixture of experts</Badge> : null}
            {m.multimodal ? <Badge tone="cyan">Multimodal</Badge> : null}
            {m.license ? <Badge tone="neutral">{m.license}</Badge> : null}
          </div>
          <h1 className="mt-2 font-display text-[40px] leading-none font-bold tracking-[0.02em] uppercase">{m.name}</h1>
          <p className="mt-2 text-[14px] text-muted">
            {m.family} · released {m.released} · {fmtP(m.params)} parameters{m.moe ? ` (${fmtP(m.activeParams || m.params)} active per token)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.hf ? (
            <a href={`https://huggingface.co/${m.hf}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary" })}>
              Hugging Face <ExternalLink />
            </a>
          ) : null}
          <Link href={`/planner?model=${m.id}`} className={buttonVariants({ variant: "primary" })}>
            Plan a deployment <ArrowRight />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle>Architecture</CardTitle>
          <SpecGrid items={modelSpecs(m)} />
          {m.notes ? <p className="mt-3 text-[13px] text-muted">{m.notes}</p> : null}
          {m.source ? (
            <a href={m.source} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue">
              Source config <ExternalLink className="size-3" />
            </a>
          ) : null}
        </Card>
        <Card>
          <CardTitle>KV cache per user</CardTitle>
          <p className="mt-2 text-[13px] text-muted">Memory for one conversation&apos;s context, on top of the weights.</p>
          <table className="mt-3 w-full text-[13px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 font-semibold">Context</th>
                <th className="py-1.5 text-right font-semibold">FP16</th>
                <th className="py-1.5 text-right font-semibold">FP8</th>
              </tr>
            </thead>
            <tbody>
              {kv.map((r) => (
                <tr key={r.ctx} className="border-t border-line">
                  <td className="py-1.5 font-mono tabular-nums">{nf(r.ctx, 0)} tokens</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{gb(r.fp16)}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{gb(r.fp8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardTitle>Weights by format</CardTitle>
          <table className="mt-3 w-full text-[13px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 font-semibold">Format</th>
                <th className="py-1.5 text-right font-semibold">Bits</th>
                <th className="py-1.5 text-right font-semibold">Weights</th>
              </tr>
            </thead>
            <tbody>
              {FORMATS.map((k) => (
                <tr key={k} className="border-t border-line">
                  <td className="py-1.5">{WQ[k].l}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{WQ[k].b}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{gb(weightsAt(m, k))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardTitle>Smallest setup on popular GPUs</CardTitle>
          <p className="mt-2 text-[13px] text-muted">One server, 8K context, FP8 on data center GPUs and GGUF Q4_K_M on consumer and Apple hardware.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1.5 font-semibold">GPU</th>
                  <th className="py-1.5 text-right font-semibold">1 user</th>
                  <th className="py-1.5 text-right font-semibold">32 users</th>
                </tr>
              </thead>
              <tbody>
                {fits.map((r) => (
                  <tr key={r.gpu.id} className="border-t border-line">
                    <td className="py-1.5">
                      <Link href={`/planner?model=${m.id}&gpu=${r.gpu.id}`} className="font-semibold hover:text-blue">
                        {gpuLabel(r.gpu)}
                      </Link>
                      <small className="block text-[11px] text-faint">{WQ[r.wq].l}</small>
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {r.n1 ? (
                        <>
                          <span className="text-green">{r.n1}×</span> · {spd(r.speed1)} tok/s
                        </>
                      ) : (
                        <span className="text-red">&gt; 16</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {r.n32 ? (
                        <>
                          <span className="text-green">{r.n32}×</span> · {spd(r.speed32)} tok/s
                        </>
                      ) : (
                        <span className="text-red">&gt; 16</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
