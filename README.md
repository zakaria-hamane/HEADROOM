<div align="center">

<img src="docs/banner.svg" alt="Headroom: know your GPU headroom before you buy, for the whole agentic RAG stack" width="100%">

### Size the GPUs for your whole agentic RAG stack, not just the LLM: embedders, rerankers, document parsers, speech-to-text, text-to-speech and guardrails, all sharing the same cards.

<p>
  <a href="https://nextjs.org"><img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white"></a>
  <a href="https://react.dev"><img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white"></a>
  <a href="https://www.typescriptlang.org"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white"></a>
  <a href="https://tailwindcss.com"><img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white"></a>
  <br>
  <a href="https://www.better-auth.com"><img alt="Better Auth" src="https://img.shields.io/badge/Better_Auth-1.7-111111?style=for-the-badge"></a>
  <a href="https://orm.drizzle.team"><img alt="Drizzle ORM" src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black"></a>
  <a href="https://neon.tech"><img alt="Postgres on Neon" src="https://img.shields.io/badge/Postgres-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"></a>
  <a href="https://vitest.dev"><img alt="Parity tested with Vitest" src="https://img.shields.io/badge/engine-parity_tested-6E9F18?style=for-the-badge&logo=vitest&logoColor=white"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-7B61FF?style=for-the-badge"></a>
  <a href="https://github.com/zakaria-hamane/HEADROOM/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/zakaria-hamane/HEADROOM/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI"></a>
</p>

<p>
  <img alt="138 LLMs" src="https://img.shields.io/badge/LLMs-138-2F6BFF?style=flat-square">
  <img alt="40 embedders" src="https://img.shields.io/badge/embedders-40-4C6BFF?style=flat-square">
  <img alt="22 rerankers" src="https://img.shields.io/badge/rerankers-22-6366F1?style=flat-square">
  <img alt="25 speech-to-text models" src="https://img.shields.io/badge/speech--to--text-25-7B61FF?style=flat-square">
  <img alt="16 text-to-speech models" src="https://img.shields.io/badge/text--to--speech-16-9B5CF0?style=flat-square">
  <br>
  <img alt="30 document parsers and OCR models" src="https://img.shields.io/badge/parsers_%26_OCR-30-C060C0?style=flat-square">
  <img alt="19 guardrail models" src="https://img.shields.io/badge/guardrails-19-E0668F?style=flat-square">
  <img alt="23 vision, PII and router models" src="https://img.shields.io/badge/vision%2C_PII_%26_routers-23-F27265?style=flat-square">
  <img alt="93 GPUs and accelerators" src="https://img.shields.io/badge/GPUs_%26_accelerators-93-FF7E51?style=flat-square">
</p>

<a href="https://headroom-lemon.vercel.app"><img alt="Try it live: no signup" src="https://img.shields.io/badge/Try_it_live-no_signup-2F6BFF?style=for-the-badge&logo=vercel&logoColor=white" height="32"></a>
<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fzakaria-hamane%2FHEADROOM&project-name=headroom&repository-name=headroom&env=BETTER_AUTH_SECRET&envDescription=A%20random%20string%20of%2032%2B%20characters%20that%20signs%20sessions&envLink=https%3A%2F%2Fgithub.com%2Fzakaria-hamane%2FHEADROOM%23environment-variables&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D"><img src="https://vercel.com/button" alt="Deploy with Vercel"></a>

<p>
  <a href="#the-whole-stack-on-one-gpu-budget">The whole stack</a> ·
  <a href="#see-it">See it</a> ·
  <a href="#features">Features</a> ·
  <a href="#a-real-answer">A real answer</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#deploy-to-vercel">Deploy</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#license">License</a>
</p>

<img src="docs/demo.gif" alt="Raising the users on Llama 3.3 70B: Headroom adds H100s automatically until 256 users no longer fit, then streams an answer at the computed speed next to 100 live users" width="100%">

<sub>Raise the users and Headroom adds GPUs until the model stops fitting, then streams an answer at the speed it computed.</sub>

</div>

---

**An LLM never ships alone.** A real assistant transcribes speech, checks the request, embeds the question, searches and reranks, parses the documents it answers from, generates, and reads the answer back. Every one of those models takes memory and compute from the same GPUs, yet most sizing tools only count the LLM.

**Headroom sizes the whole stack.** Pick an LLM, add the models around it from a catalog of 175 (or start from a preset like *Voice agent* or *Full RAG + voice*), choose a GPU and a workload, and it answers three questions as you type:

- **Does it fit?** Every gigabyte of VRAM: LLM weights, KV cache, runtime, and each embedder, reranker, parser, speech and guardrail model, on the GPU or moved to CPU + RAM.
- **Is it fast enough?** Tokens per second per user against reading speed, real-time factors for speech, and the time from question to first word, with embedding, vector search, reranking and guardrail checks included.
- **What does it cost?** How many GPUs, $ per hour and per million tokens, energy, and API costs for hosted parsers and rerankers.

It works for **inference and fine-tuning**, single servers and **TP × PP × DP clusters**, and offloading to RAM or NVMe. Make an account to save plans, share them with a link and compare them side by side.

> [!TIP]
> No account is needed to plan. Drafts stay in your browser, and signing up saves them to your account.

If Headroom saves you from buying the wrong GPUs, **a ⭐ on this repo helps other people find it.**

## The whole stack, on one GPU budget

<img src="docs/stack-diagram.svg" alt="One question through an agentic RAG stack on 4× H100: Whisper speech-to-text, BGE-M3 embedder, vector search, BGE reranker, Llama 3.3 70B and SILMA text-to-speech, with Granite-Docling parsing and indexing behind them. Question to first word 1.56 s; everything fits in 170.5 of 272.0 GB usable." width="100%">

Each model in the stack runs on the GPU with the LLM, on CPU + RAM, or as a hosted API, and Headroom sizes it there:

| In the stack | In the catalog | What Headroom computes |
| --- | --- | --- |
| **LLM** | 138 models: Llama, Qwen, DeepSeek, gpt-oss, Gemma and more | Weights and KV cache per user, tokens/s per user, first word under a burst, GPU count, $ per 1M tokens |
| **Embedders** | 40, e.g. BGE-M3 | Memory, query latency, indexing speed in chunks/s |
| **Rerankers** | 22, e.g. BGE Reranker v2 M3, hosted APIs | Memory, time to rerank the top passages, pairs/s, or API cost per 1,000 questions |
| **Speech-to-text** | 25, e.g. Whisper large-v3 and turbo, Distil-Whisper | Memory, × real time, share of a GPU for your live streams, time to transcribe an hour |
| **Text-to-speech** | 16, e.g. Kokoro-82M, XTTS-v2, F5-TTS | Memory, × real time, share of a GPU for your live voices |
| **Parsers & OCR** | 30, e.g. Docling, Granite-Docling, Marker | Pages per hour and time for your document count, or API cost per 1,000 pages |
| **Guardrails** | 19, e.g. Llama Guard 3 and 4, Prompt Guard 2 | Memory, time per check, checks per question |
| **Vision, PII, routers** | 23, e.g. Qwen2.5-VL, GLiNER, Presidio, Arch-Router | Memory, time per call |

Then it adds everything up: total GPU memory (and RAM for models you move to the CPU), the stack's share of GPU compute at your question rate, and **question → first word = embedding + vector search + reranking + guardrail + the LLM's first token**.

<p align="center">
  <img src="docs/stack.jpg" alt="A voice agent stack in Headroom: Whisper large-v3-turbo, Kokoro-82M and BGE-M3 next to Qwen3 8B on 2× L4, 85% of usable VRAM" width="100%">
  <br>
  <sub><b>A voice agent, sized as a whole.</b> Whisper, Kokoro and BGE-M3 share two L4s with Qwen3 8B. Each model shows its memory and throughput, and the result adds them to the LLM's budget.</sub>
</p>

## See it

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/planner.jpg">
    <source media="(prefers-color-scheme: light)" srcset="docs/planner-light.jpg">
    <img src="docs/planner.jpg" alt="The Headroom planner: Llama 3.3 70B on 4× H100 at 88% of usable VRAM, 24.6 tokens/s per user" width="100%">
  </picture>
  <br>
  <sub><b>The planner.</b> Every input updates the result instantly: memory meter, speed against reading speed, and a breakdown of where the GPU memory goes. It follows your light or dark theme, and so does this image.</sub>
</p>

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/simulation.jpg" alt="Inference simulation streaming an answer next to 64 concurrent users">
      <p><b>Inference simulation.</b> Watch an answer stream at the computed speed, with what a person has read so far highlighted, next to a live view of every concurrent user.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/capacity.jpg" alt="Capacity charts: speed per user and memory used as users grow">
      <p><b>Capacity.</b> How the same hardware behaves as users grow: where it stops fitting and where answers fall below reading speed.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/compare-gpus.jpg" alt="The same workload on all 93 GPUs, sorted by cost per million tokens">
      <p><b>Compare all GPUs.</b> Your workload on all 93 GPUs at the smallest count that fits, sortable by speed, latency, $/hour or $ per 1M tokens.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/dashboard.jpg" alt="My plans dashboard with saved plans and templates">
      <p><b>My plans.</b> Saved plans with their headline numbers, filters, stars and sharing, plus templates for common setups.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/landing.jpg" alt="The Headroom landing page">
      <p><b>Landing page.</b> A real result from the engine, the catalog at a glance and the methodology.</p>
    </td>
    <td width="50%" valign="top" align="center">
      <img src="docs/mobile.jpg" alt="The planner results on a phone" width="44%">
      <p><b>On a phone.</b> The full planner, with a sticky result bar that jumps to the numbers.</p>
    </td>
  </tr>
</table>

## Features

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>Size it</h4>
      <ul>
        <li><b>The whole stack</b>: the LLM plus 175 models in 9 types (embedders, rerankers, parsers and OCR, speech-to-text, text-to-speech, guardrails, vision, PII, routers), each on the GPU, on CPU + RAM, or as an API</li>
        <li><b>Presets</b> to start from: Starter RAG, Full RAG + voice, Document-heavy, Voice agent, Arabic voice, With guardrails, Cloud parsing + rerank</li>
        <li><b>Auto GPU count</b> on a single server, or clusters with tensor, pipeline and data parallelism</li>
        <li><b>Offloading</b> of layers or KV cache to RAM or NVMe, run on the CPU or copied over PCIe</li>
        <li><b>Fine-tuning</b>: full, LoRA and QLoRA, optimizers, ZeRO-1/2/3, checkpointing, training time and cost</li>
      </ul>
    </td>
    <td width="33%" valign="top">
      <h4>Understand it</h4>
      <ul>
        <li><b>Memory breakdown</b>: weights, KV cache, runtime and CUDA graphs, activations, every RAG and agent model, free and kept headroom</li>
        <li><b>Speed per user</b> against human reading speed, <b>question → first word</b> with retrieval included, first word under a burst, total throughput</li>
        <li><b>Throughput per model</b>: × real time and GPU share for live speech, pages/hour for parsers, chunks/s for indexing, and the stack's share of GPU compute</li>
        <li><b>Cost and energy</b>, server CPU and RAM, and plain-language warnings</li>
        <li><b>How it is calculated</b>: every formula with your numbers plugged in</li>
      </ul>
    </td>
    <td width="33%" valign="top">
      <h4>Keep it</h4>
      <ul>
        <li><b>Accounts</b>: email and password, password reset, optional GitHub and Google sign-in, sessions you can sign out remotely</li>
        <li><b>Saved plans</b>: autosave, rename, star, duplicate, export JSON, import setup codes</li>
        <li><b>Share links</b> you can turn on and off; viewers can save their own copy</li>
        <li><b>Compare plans</b>: up to four side by side, best value per row marked</li>
      </ul>
    </td>
  </tr>
</table>

Plus a searchable **catalog** with a page per model (weights per format, KV cache per user, smallest setup on popular GPUs), **templates** for common setups, light and dark themes, keyboard support and a mobile layout.

## A real answer

### A voice agent on two L4s

The *Voice agent* template: **Qwen3 8B** in FP8 for the answers, **Whisper large-v3-turbo** for speech-to-text, **Kokoro-82M** for text-to-speech and **BGE-M3** for retrieval, with **25 users** and an 8K-token context. Headroom picks **2× L4 24GB**.

| Question | Headroom's answer |
| --- | --- |
| Does it fit? | **Yes, at 85%** of usable VRAM: 34.6 of 40.8 GB, on the 2 GPUs it picked |
| Where does the memory go? | LLM weights 9.95 GB, KV cache 14.1 GB, runtime 4.30 GB, activations 0.34 GB, and **5.98 GB for the speech and retrieval models**: Whisper 3.01 GB, Kokoro 1.21 GB, BGE-M3 1.77 GB |
| Can speech keep up? | Whisper runs at **× 78 real time**: 4 live streams use about 5% of a GPU, and an hour of audio takes about 46 s. Kokoro runs at about × 60 real time: 4 live voices use about 7%. |
| Question → first word | embedding 8.88 ms + vector search 15.0 ms + LLM 1.46 s = **1.49 s** |
| Is it fast enough? | **12.2 tokens/s per user**, about twice as fast as people read |
| How busy is the stack? | At 1 question per user per minute, the speech and retrieval models use about **5.9% of the GPUs' compute** |
| What does it cost? | **$1.46 per hour**, **$2.21 per 1M output tokens** at typical cloud rates |

The speech and retrieval models take 6 GB, about 15% of the usable memory. Leave them out of the plan and this setup looks roomier than it is.

### The KV cache surprise: Llama 3.3 70B on 4× H100

One of the saved plans in the screenshots: a support assistant on **Llama 3.3 70B** in FP8, **64 people chatting at once** with a 16K-token context, on **4× H100 SXM 80GB**.

| Question | Headroom's answer |
| --- | --- |
| Does it fit? | **Yes, at 88%** of usable VRAM: 239.3 of 272.0 GB. Room for about 77 conversations. |
| Where does the memory go? | 69.6 GB of weights, **160.0 GB of KV cache** (2.50 GB per user), 8.6 GB runtime, 1.1 GB activations |
| Is it fast enough? | **24.6 tokens/s per user**, about 4× faster than people read. 40.6 ms per token, 5.36 ms of it NVLink traffic. |
| How long until the first word? | **1.51 s** for one prompt, **4.47 s** when 3 arrive at once |
| How far does it scale? | Fits and stays faster than reading up to **77 users** (1.2× this load) |
| What does it cost? | **$4.77 per 1M output tokens** at typical cloud rates |
| Is there something cheaper? | *Compare all GPUs* ranks a single **AMD MI350X 288GB** first at **$1.77 per 1M tokens** for the same workload |

The KV cache is the part people underestimate. Per user it is

```math
\underbrace{2}_{K,\,V} \times \underbrace{80}_{\text{layers}} \times \underbrace{8}_{\text{KV heads}} \times \underbrace{128}_{\text{head dim}} \times \underbrace{16{,}384}_{\text{tokens}} \times \underbrace{1\ \text{byte}}_{\text{FP8}} = 2.50\ \text{GiB}
```

so 64 users need 160 GB of KV cache, more than twice the weights. Generation is bound by memory bandwidth: every new token reads all the weights plus every user's KV cache, which is why speed per user falls as users grow.

## Quick start

Nothing to install: **[try it live at headroom-lemon.vercel.app](https://headroom-lemon.vercel.app)**, no signup needed.

To run it yourself, you need Node.js 22.9 or newer.

```bash
git clone https://github.com/zakaria-hamane/HEADROOM.git
cd HEADROOM
npm install
npm run dev
```

Open http://localhost:3000. That's all: without `DATABASE_URL`, accounts and plans live in an embedded Postgres ([PGlite](https://pglite.dev)) in `./.data`, created and migrated on first use. Password-reset links are printed in the terminal.

To use a real Postgres locally, copy `.env.example` to `.env.local`, set `DATABASE_URL`, then run `npm run db:migrate`.

## Deploy to Vercel

**One click:** the **Deploy with Vercel** button above clones the repository, asks for `BETTER_AUTH_SECRET` and offers to add a Neon Postgres database.

**Or by hand:**

1. **Import the repository** in Vercel (Add New → Project). `vercel.json` sets the build command to `npm run vercel-build`, which applies database migrations and then builds.
2. **Add a database**: Storage → Create Database → **Neon (Postgres)**, connected to the project. This sets `DATABASE_URL`.
3. **Add the auth secret**: Settings → Environment Variables → `BETTER_AUTH_SECRET`, 32+ random characters, for Production and Preview. `npm run auth:secret` prints one.
4. **Deploy** (or redeploy after adding the variables). The build log shows `[migrate] Postgres database is up to date.`

The production, branch and preview URLs can sign in automatically. For a custom domain that isn't the project's primary domain, set `BETTER_AUTH_URL` (or list extra hosts in `AUTH_ALLOWED_HOSTS`).

> [!NOTE]
> Without a database the site still deploys: the planner and catalog work, and sign-up explains that accounts aren't set up yet.

<details>
<summary><b>Optional: GitHub and Google sign-in, password-reset emails</b></summary>

<br>

- **GitHub sign-in**: create an OAuth app with callback `https://<your-domain>/api/auth/callback/github`, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- **Google sign-in**: create OAuth credentials with redirect URI `https://<your-domain>/api/auth/callback/google`, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Password-reset emails**: set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain verified in Resend). Without them, "Forgot password" is hidden in production.

</details>

## How it works

```mermaid
flowchart LR
  subgraph browser["Your browser"]
    direction TB
    ui["Planner UI<br/>React 19"]
    engine["Sizing engine<br/>pure TypeScript"]
    draft[("Draft<br/>localStorage")]
    ui <-->|"every change"| engine
    ui -.->|"signed out"| draft
  end
  subgraph vercel["Vercel · Next.js 16"]
    direction TB
    auth["Better Auth<br/>/api/auth/*"]
    actions["Server Actions<br/>session + ownership checks"]
    rsc["Server Components<br/>dashboard, share links, catalog"]
    auth ~~~ actions ~~~ rsc
  end
  db[("Postgres<br/>Neon · PGlite locally")]
  browser ==>|"sign in · save · share · compare"| vercel
  vercel ==> db
```

- **The math runs in your browser.** The sizing engine is a set of pure functions, so results update on every keystroke with no server round trip.
- **The server keeps what you save.** Server Actions re-check the session and scope every read and write to the plan's owner, and validate and size-limit plan state before storing it.
- **One codebase, two databases.** Production uses Postgres on Neon through a pooled `pg` client; local development falls back to an embedded PGlite database with the same migrations.

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Server Actions, Turbopack) |
| UI | React 19, Tailwind CSS 4, Radix UI, lucide icons, sonner toasts |
| Auth | Better Auth: database sessions, rate limiting stored in Postgres, origin checks |
| Data | Drizzle ORM, PostgreSQL (Neon), PGlite for local development |
| Validation | Zod |
| Tests | Vitest |

### A parity-tested engine

The engine in `src/lib/engine` is a line-by-line TypeScript port of the original single-file *LLM GPU Planner*. `tests/engine.parity.test.ts` runs randomized settings for every model through both engines and requires **identical results** for inference, the GPU-count search, the all-GPU comparison, fine-tuning and every companion model. `tests/planner.test.ts` checks the planner wrapper, state validation, setup-code compatibility and that every template fits.

> [!IMPORTANT]
> These are planning estimates, not measurements. Memory is in GB = GiB (2³⁰ bytes), as nvidia-smi reports it; bandwidth is decimal GB/s and compute is dense TFLOPS. Check with a load test on the target hardware before you buy.

## Reference

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | Postgres connection string (`POSTGRES_URL` is also accepted). Unset locally = embedded database. |
| `BETTER_AUTH_SECRET` | Production | Signs sessions. 32+ random characters. |
| `BETTER_AUTH_URL` | No | Public URL, when it isn't one of the project's Vercel URLs. |
| `AUTH_ALLOWED_HOSTS` | No | Extra hostnames allowed to sign in, comma separated. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | No | GitHub sign-in. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google sign-in. |
| `RESEND_API_KEY` / `EMAIL_FROM` | No | Password-reset emails. |
| `DATABASE_POOL_MAX` | No | Postgres pool size per function instance (default 5). |

<details>
<summary><b>Scripts</b></summary>

<br>

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` / `npm start` | Production build and server. |
| `npm run vercel-build` | Migrations, then build (used by Vercel). |
| `npm run check` | Type-check, lint and tests. |
| `npm test` | Engine parity and planner tests. |
| `npm run db:generate` | New SQL migration after changing `src/db/schema.ts`. |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL`, or to the embedded database. |
| `npm run db:studio` | Browse the database with Drizzle Studio. |
| `npm run auth:secret` | Print a random `BETTER_AUTH_SECRET`. |

</details>

<details>
<summary><b>Project layout</b></summary>

<br>

```
src/
  app/
    (marketing)/          landing page
    (auth)/               sign-in, sign-up, forgot/reset password
    (app)/                planner, plans/[id], share/[shareId], dashboard, compare, settings, models, gpus
    actions/plans.ts      Server Actions for saved plans (every action checks the session and ownership)
    api/auth/[...all]     Better Auth endpoints
  components/
    brand/                the Headroom logo, mark and wordmark
    planner/              the planner workspace: cards, results, simulation, capacity, compare, dialogs
    dashboard/ settings/ auth/ catalog/ marketing/ layout/ ui/
  data/catalog.json       models, GPUs and companion models
  db/                     Drizzle schema and connection (Postgres or embedded PGlite)
  lib/
    engine/               the sizing engine (pure functions)
    planner/              state, defaults, templates, run logic, formulas, formatting
    auth.ts, session.ts   Better Auth configuration and server-side session helpers
  proxy.ts                redirects signed-out visitors away from private pages
drizzle/                  SQL migrations
scripts/migrate.mjs       migration runner used locally and on Vercel
tests/                    Vitest suites; fixtures/original-engine.cjs is the original engine, kept for parity tests
docs/                     README banner, logo, demo GIF, social preview and screenshots
.github/                  CI workflow, issue and pull request templates
```

</details>

<details>
<summary><b>Security notes</b></summary>

<br>

- Sessions are database-backed cookies (30 days, refreshed daily). Signing out elsewhere and password resets take effect immediately.
- Sign-in, sign-up and password-reset endpoints are rate limited in production, with limits stored in Postgres so they hold across serverless instances. Requests from other origins are rejected.
- Every Server Action re-checks the session and scopes reads and writes to the plan's owner. Plan state from clients is validated and size-limited before it is stored.
- Share links use random 12-character IDs and work only while sharing is on.

</details>

<details>
<summary><b>Customizing</b></summary>

<br>

- Name, tagline and URL: `src/lib/site.ts`.
- Logo: `src/components/brand/logo.tsx`, `src/app/icon.svg`, `public/logo.svg`.
- Colors and fonts: tokens at the top of `src/app/globals.css`.
- Templates: `src/lib/planner/templates.ts`. RAG presets and defaults: `src/lib/planner/defaults.ts`.
- Catalog: `src/data/catalog.json` (same format as the original tool's embedded data).

</details>

## Contributing

Contributions are welcome, and the most valuable ones don't need code:

- **Measured a real setup?** [Open an issue](https://github.com/zakaria-hamane/HEADROOM/issues/new?template=bug-report.yml) with the setup code and what you measured. Real numbers are how the estimates get better.
- **Missing a model or GPU?** [Request it](https://github.com/zakaria-hamane/HEADROOM/issues/new?template=model-or-gpu.yml), or add it to `src/data/catalog.json` yourself.
- **Want to code?** Start with [CONTRIBUTING.md](CONTRIBUTING.md): setup takes two commands and no database.

<a href="https://star-history.com/#zakaria-hamane/HEADROOM&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=zakaria-hamane/HEADROOM&type=Date&theme=dark">
    <img alt="Star history" src="https://api.star-history.com/svg?repos=zakaria-hamane/HEADROOM&type=Date" width="100%">
  </picture>
</a>

## License

Headroom is open source under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`).

- **Use it freely**: run it, study it, modify it and self-host it, at home or at work.
- **Share what you serve**: if you run a modified version that other people use over a network, you must offer them its complete source code under the same license. Every page footer links to the source, so keep that link pointing at your version.
- **Need other terms?** Commercial licenses without the AGPL obligations are available from [the maintainer](https://github.com/zakaria-hamane).

The license covers the code, not the Headroom name or logo: please give forks their own name.

---

<div align="center">
  <img src="docs/logo.svg" alt="" width="44">
  <br>
  <sub><b>Headroom</b> · know your GPU headroom before you buy · <a href="#top">back to top</a></sub>
</div>
