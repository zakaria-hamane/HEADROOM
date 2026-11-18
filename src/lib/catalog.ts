import raw from "@/data/catalog.json";
import type { Catalog, Companion, Gpu, Model } from "@/lib/engine";

const data = raw as unknown as Catalog;

export const MODELS: Model[] = data.models;
export const GPUS: Gpu[] = data.gpus;
export const COMPANIONS: Companion[] = data.companions;

export const MODEL_INDEX: Record<string, Model> = Object.fromEntries(MODELS.map((m) => [m.id, m]));
export const GPU_INDEX: Record<string, Gpu> = Object.fromEntries(GPUS.map((g) => [g.id, g]));
export const COMPANION_INDEX: Record<string, Companion> = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));

export const CATALOG_STATS = {
  models: MODELS.length,
  gpus: GPUS.length,
  companions: COMPANIONS.length,
  orgs: new Set(MODELS.map((m) => m.org)).size,
} as const;

export const SEGMENT_LABEL: Record<string, string> = {
  datacenter: "Data center",
  workstation: "Workstation",
  consumer: "Consumer",
  apple: "Apple silicon",
  edge: "Edge / SoC",
  accelerator: "Accelerator",
  custom: "Custom",
};
