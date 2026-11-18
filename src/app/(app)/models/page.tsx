import type { Metadata } from "next";
import { ModelsTable } from "@/components/catalog/catalog-tables";
import { CATALOG_STATS } from "@/lib/catalog";
import { modelRows } from "@/lib/catalog-insights";

export const metadata: Metadata = {
  title: "LLM catalog: VRAM by model",
  description: `GPU memory for the weights of ${CATALOG_STATS.models} open LLMs at BF16, FP8 and 4-bit, with context length, attention type and MoE details.`,
};

export default function ModelsPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
      <h1 className="m-0 font-display text-[34px] leading-none font-bold tracking-[0.02em] uppercase">Models</h1>
      <p className="mt-2 mb-6 max-w-[70ch] text-[14px] text-muted">
        {CATALOG_STATS.models} open models from {CATALOG_STATS.orgs} makers, with their published architecture. Pick one to see memory per format, KV cache per user and which GPUs it fits on.
      </p>
      <ModelsTable rows={modelRows()} />
    </div>
  );
}
