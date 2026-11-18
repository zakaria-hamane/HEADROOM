const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const siteConfig = {
  name: "Headroom",
  tagline: "GPU planner for agentic RAG",
  description:
    "Size the GPUs for your whole agentic RAG stack, not just the LLM: embedders, rerankers, document parsers, " +
    "speech-to-text, text-to-speech and guardrails on the same cards. Memory, tokens per second, question-to-first-word time, " +
    "GPU count and cost across 138 LLMs, 175 RAG & agent models and 93 GPUs.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.BETTER_AUTH_URL ||
    (productionHost ? `https://${productionHost}` : "http://localhost:3000"),
  /** Source code of this deployment (AGPL-3.0 §13). Forks that host a modified version should point this at their own repository. */
  repo: process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/zakaria-hamane/HEADROOM",
} as const;
