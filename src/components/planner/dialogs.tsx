"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, FileUp, Globe, Lock, Save, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { setPlanSharing } from "@/app/actions/plans";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { copyText } from "@/components/planner/draft";
import type { PlannerState } from "@/lib/planner/defaults";
import { decodeSetup, sanitizeState } from "@/lib/planner/state";

/** Name + description form used to save a new plan and to rename one. */
export function PlanDetailsDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialName,
  initialDescription = "",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  initialName: string;
  initialDescription?: string | null;
  onSubmit: (name: string, description: string) => Promise<boolean>;
}) {
  const [name, setName] = React.useState(initialName);
  const [desc, setDesc] = React.useState(initialDescription ?? "");
  const [pending, setPending] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    // reset the form each time it opens
    setPrevOpen(open);
    if (open) {
      setName(initialName);
      setDesc(initialDescription ?? "");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <form
          className="grid gap-3.5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setPending(true);
            const ok = await onSubmit(name.trim(), desc.trim());
            setPending(false);
            if (ok) onOpenChange(false);
          }}
        >
          <Field label="Name" htmlFor="plan-name">
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus />
          </Field>
          <Field label="Notes (optional)" htmlFor="plan-desc" hint="What this plan is for, assumptions, links…">
            <Textarea id="plan-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} rows={3} />
          </Field>
          <DialogFooter className="mt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>
              <Save /> {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ShareDialog({
  open,
  onOpenChange,
  planId,
  isPublic,
  shareId,
  onChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  planId: string;
  isPublic: boolean;
  shareId: string | null;
  onChange: (v: { isPublic: boolean; shareId: string | null }) => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const url = shareId && typeof window !== "undefined" ? `${window.location.origin}/share/${shareId}` : "";

  const toggle = async (next: boolean) => {
    setPending(true);
    const res = await setPlanSharing(planId, next);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onChange(res.data);
    toast.success(next ? "Anyone with the link can now view this plan" : "Link sharing turned off");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Share this plan" description="Send a read-only link. Viewers can explore the numbers and save their own copy.">
        <div className="rounded-xl border border-line bg-panel-2 p-3.5">
          <Switch checked={isPublic} disabled={pending} onCheckedChange={(v) => void toggle(v)}>
            <span className="flex items-center gap-2">
              {isPublic ? <Globe className="size-4 text-green" /> : <Lock className="size-4 text-muted" />}
              {isPublic ? "Anyone with the link can view" : "Only you can see this plan"}
            </span>
          </Switch>
        </div>
        {isPublic && url ? (
          <div className="mt-3.5 grid gap-2">
            <div className="flex gap-2">
              <Input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-[12.5px]" />
              <Button
                onClick={async () => {
                  if (await copyText(url)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  } else toast.error("Could not copy the link");
                }}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-blue">
              Open the shared view <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : null}
        <p className="mt-3.5 text-xs text-muted">Turning the link off makes it stop working immediately. Turning it back on reuses the same link.</p>
      </DialogContent>
    </Dialog>
  );
}

/** Paste a setup code (also from the original single-file tool) or open an exported JSON file. */
export function ImportDialog({ open, onOpenChange, onImport }: { open: boolean; onOpenChange: (o: boolean) => void; onImport: (s: PlannerState) => void }) {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const apply = (s: PlannerState) => {
    onImport(s);
    setCode("");
    setError(null);
    onOpenChange(false);
  };
  const fromText = (text: string) => {
    const t = text.trim();
    if (!t) return;
    try {
      if (t.startsWith("{")) {
        const json = JSON.parse(t);
        apply(sanitizeState(json && typeof json === "object" && "state" in json ? json.state : json));
      } else apply(decodeSetup(t));
    } catch {
      setError("That is not a valid setup code or plan file.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Load a setup" description="Paste a setup code (from this app or the original LLM GPU Planner), or open a plan exported as JSON.">
        <Textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          rows={5}
          placeholder="Paste a setup code…"
          aria-label="Setup code"
          aria-invalid={!!error}
          className="font-mono text-xs"
        />
        {error ? <p className="mt-2 text-xs font-semibold text-red">{error}</p> : null}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 200_000) {
              setError("That file is too large to be a plan.");
              return;
            }
            fromText(await f.text());
          }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <FileUp /> Open a JSON file
          </Button>
          <Button variant="primary" onClick={() => fromText(code)} disabled={!code.trim()}>
            Load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AuthPromptDialog({ open, onOpenChange, next }: { open: boolean; onOpenChange: (o: boolean) => void; next: string }) {
  const q = `?next=${encodeURIComponent(next)}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Save it to your account" description="Your plan is kept in this browser. Create a free account to save it, come back to it anywhere and share it.">
        <ul className="grid gap-2 text-[13px]">
          {[
            [Save, "Unlimited saved plans with autosave"],
            [Share2, "Read-only share links for your team"],
            [Sparkles, "Templates and side-by-side GPU comparisons"],
          ].map(([Icon, text]) => {
            const I = Icon as typeof Save;
            return (
              <li key={text as string} className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-blue/12 text-blue">
                  <I className="size-4" />
                </span>
                {text as string}
              </li>
            );
          })}
        </ul>
        <DialogFooter className="mt-6">
          <Link href={`/sign-in${q}`} className={buttonVariants({ variant: "ghost" })}>
            I have an account
          </Link>
          <Link href={`/sign-up${q}`} className={buttonVariants({ variant: "primary" })}>
            Create free account
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={pending}
            onClick={async () => {
              setPending(true);
              await onConfirm();
              setPending(false);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
