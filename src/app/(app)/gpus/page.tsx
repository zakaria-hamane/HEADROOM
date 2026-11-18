import type { Metadata } from "next";
import { GpusTable } from "@/components/catalog/catalog-tables";
import { CATALOG_STATS } from "@/lib/catalog";
import { gpuRows } from "@/lib/catalog-insights";

export const metadata: Metadata = {
  title: "GPU catalog for LLMs and RAG stacks",
  description: `Memory, bandwidth, TFLOPS, power and cloud price for ${CATALOG_STATS.gpus} GPUs and accelerators, from H100 and B200 to RTX 5090 and Apple M4.`,
};

export default function GpusPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
      <h1 className="m-0 font-display text-[34px] leading-none font-bold tracking-[0.02em] uppercase">GPUs &amp; accelerators</h1>
      <p className="mt-2 mb-6 max-w-[70ch] text-[14px] text-muted">
        {CATALOG_STATS.gpus} data center, workstation, consumer and Apple devices with vendor datasheet figures. Memory bandwidth sets how fast tokens come out; memory size sets what fits.
      </p>
      <GpusTable rows={gpuRows()} />
    </div>
  );
}
