import type { MetadataRoute } from "next";
import { MODELS } from "@/lib/catalog";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/planner`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/models`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/gpus`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/sign-up`, changeFrequency: "yearly", priority: 0.4 },
    ...MODELS.map((m) => ({ url: `${base}/models/${m.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
