"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  Copy,
  Download,
  Ellipsis,
  FileInput,
  Files,
  LayoutTemplate,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Save,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import { toast } from "sonner";
import { createPlan, deletePlan, duplicatePlan, updatePlanDetails, updatePlanState } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/misc";
import { PlannerProvider, usePlanner } from "@/components/planner/context";
import { AdvancedCard } from "@/components/planner/cards/advanced-card";
import { HardwareCard } from "@/components/planner/cards/hardware-card";
import { ModelCard } from "@/components/planner/cards/model-card";
import { OffloadCard } from "@/components/planner/cards/offload-card";
import { PrecisionCard } from "@/components/planner/cards/precision-card";
import { StackCard } from "@/components/planner/cards/stack-card";
import { WorkloadCard } from "@/components/planner/cards/workload-card";
import { AuthPromptDialog, ConfirmDialog, ImportDialog, PlanDetailsDialog, ShareDialog } from "@/components/planner/dialogs";
import { clearDraft, copyText, downloadJson, saveDraft, slugify } from "@/components/planner/draft";
import { LowerTabs, type LowerTab } from "@/components/planner/lower/lower-tabs";
import { MobileSummary } from "@/components/planner/results/mobile-summary";
import { ResultsPanel } from "@/components/planner/results/results-panel";
import { useSession } from "@/lib/auth-client";
import { GPUS, MODELS } from "@/lib/catalog";
import { defaultPlanName } from "@/lib/planner/compute";
import { defaultState, type Mode, type PlannerState } from "@/lib/planner/defaults";
import { summaryText } from "@/lib/planner/report";
import { encodeSetup } from "@/lib/planner/state";
import { TEMPLATES, templateState } from "@/lib/planner/templates";
import { cn, formatDate, timeAgo } from "@/lib/utils";

export interface SavedPlanMeta {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  shareId: string | null;
  updatedAt: string;
}
export interface SharedPlanMeta {
  shareId: string;
  name: string;
  description: string | null;
  ownerName: string;
  updatedAt: string;
}
export type WorkspaceProps =
  | { kind: "draft"; initialState: PlannerState; openSave?: boolean; title?: string }
  | { kind: "owned"; initialState: PlannerState; plan: SavedPlanMeta }
  | { kind: "shared"; initialState: PlannerState; plan: SharedPlanMeta };

type DialogName = "save" | "rename" | "share" | "import" | "auth" | "delete";

export function Workspace(props: WorkspaceProps) {
  const [state, setState] = React.useState(props.initialState);
  return (
    <PlannerProvider state={state} onStateChange={setState}>
      <Shell {...props} />
    </PlannerProvider>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Debounced autosave of a saved plan; `dirty` is derived from the last state the server accepted. */
function useAutosave(planId: string | null, state: PlannerState, initial: PlannerState, initialSavedAt: string | null) {
  const [saved, setSaved] = React.useState({ state: initial, at: initialSavedAt });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const dirty = planId != null && state !== saved.state;
  const latest = React.useRef(state);
  const dirtyRef = React.useRef(dirty);
  React.useEffect(() => {
    latest.current = state;
    dirtyRef.current = dirty;
  }, [state, dirty]);

  const save = React.useCallback(
    async (s: PlannerState) => {
      if (!planId) return;
      setSaving(true);
      const res = await updatePlanState(planId, s);
      setSaving(false);
      if (res.ok) {
        setSaved({ state: s, at: res.data.updatedAt });
        setError(null);
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    },
    [planId],
  );

  React.useEffect(() => {
    if (!dirty || error) return;
    const t = setTimeout(() => void save(state), 1000);
    return () => clearTimeout(t);
  }, [dirty, error, state, save]);

  // Leaving the page (Next.js hides it rather than unmounting): save right away instead of dropping the debounce.
  React.useLayoutEffect(
    () => () => {
      if (dirtyRef.current) void save(latest.current);
    },
    [save],
  );

  React.useEffect(() => {
    if (!dirty && !saving) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saving]);

  return { dirty, saving, error, savedAt: saved.at, flush: () => void save(latest.current) };
}

function ModeSwitch() {
  const { state, set } = usePlanner();
  const opts: [Mode, string][] = [
    ["inf", "Inference"],
    ["ft", "Fine-tuning"],
  ];
  return (
    <div role="radiogroup" aria-label="Mode" className="inline-flex gap-1 rounded-[14px] border border-line bg-panel p-1">
      {opts.map(([v, label]) => {
        const on = state.mode === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => set("mode", v)}
            className={cn(
              "rounded-[10px] px-4 py-2 font-display text-base font-bold tracking-[0.06em] uppercase transition-colors sm:px-5",
              on ? "primary-gradient text-white shadow-[0_6px_18px_rgba(47,107,255,.28)]" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Shell(props: WorkspaceProps) {
  const { state, results, replace } = usePlanner();
  const router = useRouter();
  const { data: session } = useSession();
  const now = useNow(30_000);
  const [tab, setTab] = React.useState<LowerTab>(props.initialState.mode === "ft" ? "compare" : "sim");
  const [dialog, setDialog] = React.useState<DialogName | null>(null);
  const [autoSaveHandled, setAutoSaveHandled] = React.useState(false);
  const [meta, setMeta] = React.useState<SavedPlanMeta | null>(props.kind === "owned" ? props.plan : null);
  const autosave = useAutosave(props.kind === "owned" ? props.plan.id : null, state, props.initialState, props.kind === "owned" ? props.plan.updatedAt : null);

  // drafts live in this browser until they are saved
  const latestState = React.useRef(state);
  const draftDone = React.useRef(false); // set once the draft became a saved plan
  React.useEffect(() => {
    latestState.current = state;
    if (props.kind !== "draft" || draftDone.current) return;
    const t = setTimeout(() => saveDraft(state), 300);
    return () => clearTimeout(t);
  }, [props.kind, state]);
  React.useLayoutEffect(
    () => () => {
      // the page is being hidden or unmounted: keep the latest draft and close transient dialogs
      if (props.kind === "draft" && !draftDone.current) saveDraft(latestState.current);
      setDialog(null);
    },
    [props.kind],
  );

  // "/planner?save=1" after sign-up opens the save dialog once the session is known
  const wantsAutoSave = props.kind === "draft" && !!props.openSave && !!session && !autoSaveHandled;
  const saveOpen = dialog === "save" || wantsAutoSave;

  const title =
    props.kind === "owned" ? (meta?.name ?? props.plan.name) : props.kind === "shared" ? props.plan.name : (props.title ?? "New plan");

  const requestSave = React.useCallback(() => {
    if (props.kind === "owned") {
      autosave.flush();
      toast.success("Saved");
      return;
    }
    if (!session) {
      saveDraft(state);
      setDialog("auth");
      return;
    }
    setDialog("save");
  }, [props.kind, session, state, autosave]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        requestSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestSave]);

  const createFromState = async (name: string, description: string) => {
    const res = await createPlan({ name, description, state });
    if (!res.ok) {
      if (res.code === "UNAUTHORIZED") setDialog("auth");
      toast.error(res.error);
      return false;
    }
    if (props.kind === "draft") {
      draftDone.current = true;
      clearDraft();
    }
    toast.success("Plan saved to your account");
    router.push(`/plans/${res.data.id}`);
    return true;
  };

  const resetToDefaults = () => {
    const previous = state;
    replace(defaultState());
    toast("Reset to the default setup", { action: { label: "Undo", onClick: () => replace(previous) } });
  };

  const status = (() => {
    if (props.kind === "owned") {
      if (autosave.error)
        return (
          <span className="flex items-center gap-1.5 text-red">
            <CircleAlert className="size-3.5" /> Couldn&apos;t save.{" "}
            <button type="button" className="font-semibold underline" onClick={autosave.flush}>
              Retry
            </button>
          </span>
        );
      if (autosave.saving)
        return (
          <span className="flex items-center gap-1.5">
            <LoaderCircle className="size-3.5 animate-spin" /> Saving…
          </span>
        );
      if (autosave.dirty) return <span>Unsaved changes</span>;
      return <span>Saved {autosave.savedAt ? timeAgo(autosave.savedAt, now) : ""}</span>;
    }
    if (props.kind === "shared")
      return (
        <span>
          Shared by <b className="text-fg">{props.plan.ownerName}</b> · updated {formatDate(props.plan.updatedAt)}
        </span>
      );
    return <span>{session ? "Draft · not saved yet" : "Draft · kept in this browser"}</span>;
  })();

  const planName = meta?.name ?? (props.kind === "shared" ? props.plan.name : defaultPlanName(state));

  return (
    <div className="mx-auto max-w-[1480px] px-4 pb-28 sm:px-6 min-[1120px]:pb-12">
      {/* toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-5 pb-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="m-0 truncate font-display text-[26px] leading-tight font-bold tracking-[0.02em] uppercase sm:text-[30px]">{title}</h1>
            {props.kind === "owned" ? (
              <Button size="icon-sm" variant="ghost" aria-label="Rename plan" onClick={() => setDialog("rename")}>
                <Pencil />
              </Button>
            ) : null}
            {props.kind === "shared" ? <Badge tone="blue">Read-only</Badge> : null}
            {props.kind === "owned" && meta?.isPublic ? (
              <Badge tone="green">
                <Users className="size-3" /> Shared
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted" aria-live="polite">
            {status}
          </div>
          {props.kind === "owned" && meta?.description ? <p className="mt-1.5 max-w-[70ch] text-[13px] text-muted">{meta.description}</p> : null}
          {props.kind === "shared" && props.plan.description ? <p className="mt-1.5 max-w-[70ch] text-[13px] text-muted">{props.plan.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={async () => toast[(await copyText(summaryText(state, results.inf, results.ft))) ? "success" : "error"]("Summary copied")}
            aria-label="Copy summary"
          >
            <Copy /> <span className="hidden sm:inline">Copy summary</span>
          </Button>
          {props.kind === "owned" ? (
            <Button onClick={() => setDialog("share")}>
              <Share2 /> Share
            </Button>
          ) : (
            <Button variant="primary" onClick={requestSave}>
              <Save /> {props.kind === "shared" ? "Save a copy" : "Save plan"}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" aria-label="More actions">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuItem
                onSelect={async () => toast[(await copyText(encodeSetup(state))) ? "success" : "error"]("Setup code copied: paste it in “Load a setup”")}
              >
                <Copy /> Copy setup code
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("import")}>
                <FileInput /> Load a setup…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => downloadJson(`${slugify(planName)}.json`, { app: "Headroom", version: 1, name: planName, exportedAt: new Date().toISOString(), state })}
              >
                <Download /> Download as JSON
              </DropdownMenuItem>
              <M.Sub>
                <M.SubTrigger className="relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium outline-none select-none data-[highlighted]:bg-panel-3 data-[state=open]:bg-panel-3 [&_svg]:size-4 [&_svg]:text-muted">
                  <LayoutTemplate /> Start from a template
                </M.SubTrigger>
                <M.Portal>
                  <M.SubContent sideOffset={6} className="z-50 w-72 rounded-xl border border-line-2 bg-panel p-1.5 text-[13px] shadow-pop">
                    {TEMPLATES.map((t) => (
                      <M.Item
                        key={t.id}
                        onSelect={() => {
                          const s = templateState(t.id);
                          if (!s) return;
                          const previous = state;
                          replace(s);
                          toast(`Loaded “${t.title}”`, { action: { label: "Undo", onClick: () => replace(previous) } });
                        }}
                        className="grid cursor-pointer gap-0.5 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-panel-3"
                      >
                        <span className="font-semibold">{t.title}</span>
                        <span className="text-xs text-muted">{t.description}</span>
                      </M.Item>
                    ))}
                  </M.SubContent>
                </M.Portal>
              </M.Sub>
              {props.kind === "owned" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDialog("rename")}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      autosave.flush();
                      const res = await duplicatePlan(props.plan.id);
                      if (!res.ok) return void toast.error(res.error);
                      toast.success("Plan duplicated");
                      router.push(`/plans/${res.data.id}`);
                    }}
                  >
                    <Files /> Duplicate
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={resetToDefaults}>
                <RotateCcw /> Reset to defaults
              </DropdownMenuItem>
              {props.kind === "owned" ? (
                <DropdownMenuItem destructive onSelect={() => setDialog("delete")}>
                  <Trash2 /> Delete plan
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {props.kind === "shared" ? (
        <div className="mb-3 rounded-xl border border-blue/30 bg-blue/8 px-3.5 py-2.5 text-[13px]">
          You&apos;re viewing a shared plan. Change anything to explore: your edits stay in this browser until you <b>save a copy</b>.
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ModeSwitch />
        <span className="font-mono text-[11.5px] text-faint">
          {MODELS.length} models · {GPUS.length} GPUs and accelerators
        </span>
      </div>

      <div className="grid items-start gap-[18px] min-[1120px]:grid-cols-[minmax(0,1.12fr)_minmax(390px,1fr)]">
        <section aria-label="Inputs" className="grid min-w-0 gap-4">
          <ModelCard />
          {state.mode === "inf" ? <StackCard /> : null}
          <PrecisionCard />
          <HardwareCard />
          <WorkloadCard />
          <OffloadCard />
          <AdvancedCard />
        </section>
        <aside
          aria-label="Results"
          className="min-w-0 min-[1120px]:sticky min-[1120px]:top-[76px] min-[1120px]:max-h-[calc(100dvh-92px)] min-[1120px]:overflow-y-auto min-[1120px]:overscroll-contain min-[1120px]:rounded-2xl min-[1120px]:[scrollbar-width:thin]"
        >
          <ResultsPanel />
        </aside>
      </div>

      <div className="mt-[18px]">
        <LowerTabs tab={tab} onTabChange={setTab} />
      </div>

      <MobileSummary />

      {/* dialogs */}
      <PlanDetailsDialog
        open={saveOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            setAutoSaveHandled(true);
          }
        }}
        title={props.kind === "shared" ? "Save a copy" : "Save plan"}
        description="It goes to your account, with autosave from now on."
        submitLabel="Save plan"
        initialName={props.kind === "shared" ? props.plan.name : defaultPlanName(state)}
        initialDescription={props.kind === "shared" ? props.plan.description : ""}
        onSubmit={createFromState}
      />
      {props.kind === "owned" && meta ? (
        <>
          <PlanDetailsDialog
            open={dialog === "rename"}
            onOpenChange={(o) => !o && setDialog(null)}
            title="Rename plan"
            submitLabel="Save"
            initialName={meta.name}
            initialDescription={meta.description}
            onSubmit={async (name, description) => {
              const res = await updatePlanDetails(meta.id, { name, description });
              if (!res.ok) {
                toast.error(res.error);
                return false;
              }
              setMeta({ ...meta, name, description: description || null });
              toast.success("Plan updated");
              return true;
            }}
          />
          <ShareDialog
            open={dialog === "share"}
            onOpenChange={(o) => !o && setDialog(null)}
            planId={meta.id}
            isPublic={meta.isPublic}
            shareId={meta.shareId}
            onChange={(v) => setMeta({ ...meta, ...v })}
          />
          <ConfirmDialog
            open={dialog === "delete"}
            onOpenChange={(o) => !o && setDialog(null)}
            title="Delete this plan?"
            description={`“${meta.name}” will be removed from your account${meta.isPublic ? " and its share link will stop working" : ""}. This can't be undone.`}
            confirmLabel="Delete plan"
            destructive
            onConfirm={async () => {
              const res = await deletePlan(meta.id);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Plan deleted");
              router.push("/dashboard");
            }}
          />
        </>
      ) : null}
      <ImportDialog
        open={dialog === "import"}
        onOpenChange={(o) => !o && setDialog(null)}
        onImport={(s) => {
          const previous = state;
          replace(s);
          toast("Setup loaded", { action: { label: "Undo", onClick: () => replace(previous) } });
        }}
      />
      <AuthPromptDialog open={dialog === "auth"} onOpenChange={(o) => !o && setDialog(null)} next="/planner?save=1" />
    </div>
  );
}
