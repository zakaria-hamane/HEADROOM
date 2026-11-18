const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const siteConfig = {
  name: "Headroom",
  tagline: "LLM GPU planner",
  description:
    "Plan GPU memory, tokens per second, time to first token, GPU count and cost for LLM inference and fine-tuning, " +
    "across 138 open models, 93 GPUs and 175 RAG & agent models.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.BETTER_AUTH_URL ||
    (productionHost ? `https://${productionHost}` : "http://localhost:3000"),
  /** Source code of this deployment (AGPL-3.0 §13). Forks that host a modified version should point this at their own repository. */
  repo: process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/zakaria-hamane/HEADROOM",
} as const;
