"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Columns3, Copy, Ellipsis, ExternalLink, Files, Globe, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePlan, duplicatePlan, setPlanStarred } from "@/app/actions/plans";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status";
import { ConfirmDialog } from "@/components/planner/dialogs";
import { copyText } from "@/components/planner/draft";
import type { PlanSummary } from "@/db/schema";
import { duration, money, nf, spd, tm } from "@/lib/planner/format";
import { cn, timeAgo } from "@/lib/utils";

export interface PlanCardData {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  summary: PlanSummary | null;
  starred: boolean;
  isPublic: boolean;
  shareId: string | null;
  createdAt: string;
  updatedAt: string;
}

type Filter = "all" | "inf" | "ft" | "starred" | "shared";
type Sort = "updated" | "name" | "created";

function shortGpu(name: string) {
  return name.replace(/^(NVIDIA|AMD|Intel|Apple|Google) /, "").replace(/\s*\(.*\)$/, "");
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] font-semibold text-muted">{label}</span>
      <b className="block truncate text-[15px] font-semibold">{value}</b>
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
  onStar,
  onDelete,
}: {
  plan: PlanCardData;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const s = plan.summary;
  const inf = plan.mode !== "ft";
  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col rounded-2xl border bg-panel p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-2 hover:shadow-pop",
        selected ? "border-blue ring-1 ring-blue" : "border-line",
      )}
    >
      <div className="relative z-10 flex items-center gap-2">
        <label className="grid size-6 cursor-pointer place-items-center rounded-md" title="Select to compare">
          <input type="checkbox" className="size-4 accent-blue" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${plan.name} to compare`} />
        </label>
        <Badge tone={inf ? "blue" : "violet"}>{inf ? "Inference" : "Fine-tuning"}</Badge>
        {plan.isPublic ? (
          <Badge tone="green">
            <Globe className="size-3" /> Shared
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={onStar}
            aria-pressed={plan.starred}
            aria-label={plan.starred ? "Unstar" : "Star"}
            className={cn("grid size-8 place-items-center rounded-lg hover:bg-panel-3", plan.starred ? "text-amber" : "text-faint")}
          >
            <Star className={cn("size-4", plan.starred && "fill-current")} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${plan.name}`}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link href={`/plans/${plan.id}`}>
                  <ExternalLink /> Open
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  const res = await duplicatePlan(plan.id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Plan duplicated", { action: { label: "Open", onClick: () => router.push(`/plans/${res.data.id}`) } });
                }}
              >
                <Files /> Duplicate
              </DropdownMenuItem>
              {plan.isPublic && plan.shareId ? (
                <DropdownMenuItem
                  onSelect={async () => {
                    const ok = await copyText(`${window.location.origin}/share/${plan.shareId}`);
                    toast[ok ? "success" : "error"](ok ? "Share link copied" : "Could not copy the link");
                  }}
                >
                  <Copy /> Copy share link
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDelete}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Link href={`/plans/${plan.id}`} className="mt-3 block min-w-0 rounded-lg after:absolute after:inset-0 after:content-['']" prefetch={false}>
        <h3 className="truncate text-[16px] font-semibold group-hover:text-blue">{plan.name}</h3>
      </Link>
      {s ? (
        <p className="mt-0.5 truncate text-[13px] text-muted">
          {s.model} · {s.gpus}× {shortGpu(s.gpu)}
          {inf && s.users ? ` · ${nf(s.users, 0)} users` : ""}
        </p>
      ) : null}
      {plan.description ? <p className="mt-2 line-clamp-2 text-[13px] text-muted">{plan.description}</p> : null}

      {s ? (
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
          {inf ? (
            <>
              <Metric label="Speed / user" value={s.speed != null ? `${spd(s.speed)} tok/s` : "–"} />
              <Metric label="First word" value={s.ttft != null ? tm(s.ttft) : "–"} />
              <Metric label="$ / 1M tokens" value={s.perMTok != null ? money(s.perMTok) : "–"} />
            </>
          ) : (
            <>
              <Metric label="Speed" value={s.tokS != null ? `${nf(s.tokS, 0)} tok/s` : "–"} />
              <Metric label="Time" value={s.hours != null ? duration(s.hours * 3600) : "–"} />
              <Metric label="Cost" value={s.cost != null ? money(s.cost) : "–"} />
            </>
          )}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted">
        {s ? <StatusPill ratio={s.ratio} size="sm" /> : <span />}
        <span suppressHydrationWarning title={new Date(plan.updatedAt).toLocaleString("en-US")}>
          Updated {timeAgo(plan.updatedAt)}
        </span>
      </div>
    </article>
  );
}

export function PlansBrowser({ plans: initial }: { plans: PlanCardData[] }) {
  const router = useRouter();
  const [plans, setPlans] = React.useState(initial);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (initial !== prevInitial) {
    // fresh data from the server after an action
    setPrevInitial(initial);
    setPlans(initial);
  }
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [sort, setSort] = React.useState<Sort>("updated");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [toDelete, setToDelete] = React.useState<PlanCardData | null>(null);

  const term = query.trim().toLowerCase();
  const shown = plans
    .filter((p) => {
      if (filter === "inf" && p.mode === "ft") return false;
      if (filter === "ft" && p.mode !== "ft") return false;
      if (filter === "starred" && !p.starred) return false;
      if (filter === "shared" && !p.isPublic) return false;
      if (!term) return true;
      return [p.name, p.description, p.summary?.model, p.summary?.gpu].filter(Boolean).join(" ").toLowerCase().includes(term);
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const counts = {
    all: plans.length,
    inf: plans.filter((p) => p.mode !== "ft").length,
    ft: plans.filter((p) => p.mode === "ft").length,
    starred: plans.filter((p) => p.starred).length,
    shared: plans.filter((p) => p.isPublic).length,
  };

  const toggleStar = async (p: PlanCardData) => {
    setPlans((list) => list.map((x) => (x.id === p.id ? { ...x, starred: !p.starred } : x)));
    const res = await setPlanStarred(p.id, !p.starred);
    if (!res.ok) {
      setPlans((list) => list.map((x) => (x.id === p.id ? { ...x, starred: p.starred } : x)));
      toast.error(res.error);
    }
  };

  if (!plans.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line-2 bg-panel/60 px-6 py-16 text-center">
        <div className="brand-gradient grid size-14 place-items-center rounded-2xl text-white shadow-[0_10px_30px_rgba(47,107,255,.35)]">
          <Plus className="size-7" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold tracking-[0.03em] uppercase">No plans yet</h2>
        <p className="mt-2 max-w-md text-[14px] text-muted">
          Size a deployment in the planner and save it here. Start from scratch or pick one of the templates below.
        </p>
        <Link href="/planner?new=1" className={buttonVariants({ variant: "primary", size: "lg", className: "mt-6" })}>
          <Plus /> Create your first plan
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plans, models, GPUs…" aria-label="Search plans" className="h-10 pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter plans">
          {(
            [
              ["all", "All"],
              ["inf", "Inference"],
              ["ft", "Fine-tuning"],
              ["starred", "Starred"],
              ["shared", "Shared"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-full border border-line-2 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-fg",
                filter === k && "border-blue bg-blue/14 text-fg",
              )}
            >
              {label} <span className="text-faint tabular-nums">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto w-44">
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort plans">
            <option value="updated">Last updated</option>
            <option value="created">Newest first</option>
            <option value="name">Name A–Z</option>
          </Select>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-muted">No plans match. Try another search or filter.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              selected={selected.includes(p.id)}
              onSelect={(v) => {
                if (v && selected.length >= 4) return void toast("You can compare up to 4 plans at once");
                setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)));
              }}
              onStar={() => void toggleStar(p)}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </div>
      )}

      {selected.length ? (
        <div className="fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-line-2 bg-panel/95 px-4 py-3 shadow-pop backdrop-blur">
          <span className="text-[13px]">
            <b>{selected.length}</b> selected {selected.length < 2 ? "· pick at least 2" : ""}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected([])}>
            Clear
          </Button>
          <Button variant="primary" size="sm" disabled={selected.length < 2} onClick={() => router.push(`/compare?ids=${selected.join(",")}`)}>
            <Columns3 /> Compare
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this plan?"
        description={toDelete ? `“${toDelete.name}” will be removed${toDelete.isPublic ? " and its share link will stop working" : ""}. This can't be undone.` : ""}
        confirmLabel="Delete plan"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          const id = toDelete.id;
          setPlans((list) => list.filter((x) => x.id !== id));
          setSelected((s) => s.filter((x) => x !== id));
          const res = await deletePlan(id);
          if (!res.ok) toast.error(res.error);
          else toast.success("Plan deleted");
        }}
      />
    </div>
  );
}
