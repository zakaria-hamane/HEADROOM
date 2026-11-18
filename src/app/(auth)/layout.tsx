import { Cpu, Gauge, Share2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";
import { CATALOG_STATS } from "@/lib/catalog";

const POINTS = [
  { icon: Gauge, title: "The whole stack, not just the LLM", text: "LLM, embedders, rerankers, OCR, speech and guardrails: memory, speed and question-to-first-word time." },
  { icon: Cpu, title: "The right number of GPUs", text: `Smallest count that fits across ${CATALOG_STATS.gpus} GPUs, clusters with TP × PP, offloading.` },
  { icon: Share2, title: "Saved, shared, compared", text: "Autosaved plans, read-only links for your team, setup codes." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-w-0 flex-col px-5 py-5 sm:px-10">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <p className="text-center text-xs text-faint lg:text-left">Planning estimates, not measurements. Validate with a load test before you buy hardware.</p>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-panel lg:block" aria-hidden>
        <div className="grid-dots absolute inset-0 opacity-60" />
        <div className="absolute -top-32 -right-24 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(47,107,255,.28),transparent)]" />
        <div className="absolute -bottom-40 -left-24 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(255,126,81,.22),transparent)]" />
        <div className="relative flex h-full flex-col justify-center px-14 py-16 xl:px-20">
          <p className="font-display text-sm font-bold tracking-[0.16em] text-orange uppercase">GPU planning for RAG &amp; agents</p>
          <h2 className="mt-3 max-w-[16ch] font-display text-5xl leading-[0.95] font-bold tracking-[0.01em] uppercase">Size it before you buy it.</h2>
          <ul className="mt-10 grid max-w-md gap-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="primary-gradient grid size-10 flex-none place-items-center rounded-xl text-white shadow-[0_8px_22px_rgba(47,107,255,.3)]">
                  <Icon className="size-5" />
                </span>
                <span>
                  <b className="block text-[15px]">{title}</b>
                  <span className="text-[13.5px] text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-12 font-mono text-xs text-faint">
            {CATALOG_STATS.models} LLMs · {CATALOG_STATS.companions} RAG &amp; agent models · {CATALOG_STATS.gpus} GPUs
          </p>
        </div>
      </aside>
    </div>
  );
}
