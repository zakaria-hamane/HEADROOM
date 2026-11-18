import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { CATALOG_STATS } from "@/lib/catalog";
import { siteConfig } from "@/lib/site";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/planner", label: "Planner" },
      { href: "/dashboard", label: "My plans" },
      { href: "/planner?template=llama-70b-h100", label: "Example: 70B on H100" },
    ],
  },
  {
    title: "Catalog",
    links: [
      { href: "/models", label: `${CATALOG_STATS.models} models` },
      { href: "/gpus", label: `${CATALOG_STATS.gpus} GPUs & accelerators` },
      { href: "/#methodology", label: "Methodology" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-up", label: "Create account" },
      { href: "/sign-in", label: "Sign in" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <Wordmark className="text-lg" />
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Planning estimates, not measurements. Memory is in GB = GiB (2³⁰ bytes), as nvidia-smi reports it. Check with a load test on the target hardware before you buy.
          </p>
          <p className="mt-2 text-xs text-faint">Model architectures from each model&apos;s published config; GPU figures from vendor datasheets (dense, no sparsity).</p>
          <p className="mt-3 text-xs text-faint">
            Open source under AGPL-3.0 ·{" "}
            <a href={siteConfig.repo} className="text-muted underline-offset-2 hover:text-fg hover:underline" target="_blank" rel="noreferrer">
              Source code
            </a>
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-display text-[13px] font-bold tracking-[0.12em] text-faint uppercase">{col.title}</h3>
            <ul className="mt-3 grid gap-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[13.5px] text-muted hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
