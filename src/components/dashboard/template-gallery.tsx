import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import { runFinetune, runInference } from "@/lib/planner/compute";
import { duration, gpuLabel, money, spd } from "@/lib/planner/format";
import { TEMPLATES, templateState } from "@/lib/planner/templates";

/** Template cards with headline numbers computed at build time. */
export function TemplateGallery({ limit }: { limit?: number }) {
  const items = TEMPLATES.slice(0, limit ?? TEMPLATES.length).map((t) => {
    const s = templateState(t.id)!;
    if (s.mode === "ft") {
      const f = runFinetune(s);
      return { t, line: `${f.G}× ${gpuLabel(f.gpu)}`, stat: `${duration(f.time)} · ${f.price ? money(f.cost) : "–"}` };
    }
    const r = runInference(s);
    return { t, line: `${r.T.G}× ${gpuLabel(r.gpu)}`, stat: `${spd(r.speed)} tok/s per user · ${r.price ? `${money(r.perMTok)}/1M` : "–"}` };
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ t, line, stat }) => (
        <Link
          key={t.id}
          href={`/planner?template=${t.id}`}
          className="group flex min-w-0 flex-col rounded-2xl border border-line bg-panel p-4 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-blue"
        >
          <Badge tone={t.mode === "inf" ? "blue" : "violet"} className="self-start">
            {t.mode === "inf" ? "Inference" : "Fine-tuning"}
          </Badge>
          <h3 className="mt-2.5 text-[15px] font-semibold group-hover:text-blue">{t.title}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] text-muted">{t.description}</p>
          <div className="mt-auto pt-3">
            <p className="truncate font-mono text-xs text-fg">{line}</p>
            <p className="truncate font-mono text-xs text-muted">{stat}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue">
              Use template <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
