import type { Gpu, Model } from "@/lib/engine";
import { fmtP, nf } from "./format";

/** Fact list shown under the model picker and on model pages. */
export function modelSpecs(m: Model): [string, string][] {
  const a: [string, string][] = [];
  a.push(["Parameters", m.moe ? `${fmtP(m.params)} (${fmtP(m.activeParams || m.params)} active)` : fmtP(m.params || 0)]);
  a.push(["Layers · hidden", `${m.layers || "?"} · ${nf(m.hidden || 0, 0)}`]);
  a.push([
    "Attention",
    m.mla ? `MLA · latent ${m.mla.kvLoraRank}` : `${m.attention || (m.kvHeads === m.heads ? "MHA" : "GQA")} · ${m.heads}/${m.kvHeads} heads × ${m.headDim}`,
  ]);
  a.push(["Sliding window", m.swa && m.swa.layers ? `${nf(m.swa.window || 0, 0)} tokens · ${m.swa.layers}/${m.layers} layers` : "none"]);
  if (m.moe) a.push(["Experts", `${m.moe.experts} · ${m.moe.active} per token${m.moe.shared ? ` + ${m.moe.shared} shared` : ""}`]);
  const ll = m.linearLayers;
  if (ll && (typeof ll === "object" ? ll.layers : +ll)) a.push(["Layers without KV cache", typeof ll === "object" ? `${ll.layers}${ll.kind ? ` · ${ll.kind}` : ""}` : String(ll)]);
  if (m.kvCompression) a.push(["KV cache", `compressed (${m.kvCompression.type || "custom"})`]);
  a.push(["Max context", `${nf(m.maxCtx || 0, 0)} tokens`]);
  if (m.nativeQuant) a.push(["Released in", m.nativeQuant]);
  return a;
}

/** Fact list shown under the GPU picker. */
export function gpuSpecs(g: Gpu): [string, string][] {
  return [
    ["Memory", `${nf(g.memGB || 0, 0)} GB ${g.memType || ""}`.trim()],
    ["Bandwidth", `${nf(g.bwGBs || 0, 0)} GB/s`],
    ["16-bit / 8-bit / 4-bit", [g.fp16, g.fp8 || g.int8, g.fp4].map((x) => (x ? nf(x, 0) : "–")).join(" / ") + " TFLOPS"],
    ["Links", (g.nvlinkGBs ? `${nf(g.nvlinkGBs, 0)} GB/s ×${g.linkDomain || 1}` : "no GPU link") + (g.pcieGen ? ` · PCIe ${g.pcieGen}` : "")],
    ["Power · price", `${nf(g.tdpW || 0, 0)} W${g.priceHr ? ` · $${nf(g.priceHr, 2)}/h` : ""}`],
  ];
}

export function gpuSub(g: Gpu): string {
  return [`${nf(g.bwGBs || 0, 0)} GB/s`, g.fp16 ? `${nf(g.fp16, 0)} TFLOPS 16-bit` : "", g.arch, g.priceHr ? `$${nf(g.priceHr, 2)}/h` : ""].filter(Boolean).join(" · ");
}
