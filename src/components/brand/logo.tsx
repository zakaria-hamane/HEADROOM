import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

/** The Headroom glyph: a GPU chip, memory filled from the bottom, and room to grow on top. */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      <g stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="16" y="13" width="32" height="38" rx="7" />
        <path d="M10 24h6M10 32h6M10 40h6M48 24h6M48 32h6M48 40h6" />
        <path d="M26.5 25.5 32 20l5.5 5.5" />
      </g>
      <rect x="21.5" y="38" width="21" height="7.5" rx="2.5" fill="currentColor" />
      <rect x="21.5" y="30.5" width="21" height="5" rx="2" fill="currentColor" fillOpacity={0.55} />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("brand-gradient grid size-9 flex-none place-items-center rounded-[11px] text-white shadow-[0_8px_22px_rgba(91,97,255,.34)]", className)}
    >
      <LogoGlyph className="size-[88%]" />
    </span>
  );
}

/** "Head" + gradient "room". */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-bold tracking-[0.03em] uppercase", className)}>
      Head<span className="text-gradient">room</span>
    </span>
  );
}

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl", className)} aria-label={`${siteConfig.name} home`}>
      <LogoMark />
      {compact ? null : (
        <span className="grid leading-none">
          <Wordmark className="text-[22px]" />
          <span className="mt-0.5 hidden text-[11px] font-medium text-muted sm:block">{siteConfig.tagline}</span>
        </span>
      )}
    </Link>
  );
}
