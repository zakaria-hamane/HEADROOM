"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickerProps<T> {
  items: T[];
  value: string | null;
  getKey: (it: T) => string;
  label: (it: T) => string;
  right: (it: T) => string;
  sub: (it: T) => string;
  group: (it: T) => string;
  text: (it: T) => string;
  filters: [string, string][];
  filter: (it: T, f: string) => boolean;
  onPick: (it: T) => void;
  placeholder: string;
  buttonLabel: string;
  buttonSub: string;
  ariaLabel: string;
  disabled?: boolean;
}

/** Searchable, grouped picker with quick filters and full keyboard support. */
export function Picker<T>(p: PickerProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [active, setActive] = React.useState(-1);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const term = query.trim().toLowerCase();
  const shown = open ? p.items.filter((it) => p.filter(it, filter) && (!term || p.text(it).toLowerCase().includes(term))) : [];

  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>("[data-selected=true]")?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(id);
  }, [open]);

  React.useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (i: number) => {
    const it = shown[i];
    if (!it) return;
    setOpen(false);
    p.onPick(it);
  };

  const groupStarts = shown.map((it, i) => (i === 0 || p.group(it) !== p.group(shown[i - 1]) ? p.group(it) : null));
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQuery("");
          setActive(-1);
        }
      }}
    >
      <Popover.Trigger
        disabled={p.disabled}
        aria-label={`${p.ariaLabel}: ${p.buttonLabel}`}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-0.5 rounded-xl border border-line-2 bg-panel-2 px-3 py-2 text-left transition-colors hover:border-blue disabled:opacity-60 data-[state=open]:border-blue"
      >
        <span className="truncate text-[15px] font-bold">{p.buttonLabel}</span>
        <ChevronDown className="row-span-2 size-[18px] text-muted" aria-hidden />
        <span className="truncate text-xs text-muted">{p.buttonSub}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 grid w-[max(var(--radix-popover-trigger-width),18rem)] max-w-[calc(100vw-24px)] gap-2 rounded-2xl border border-line-2 bg-panel p-2.5 shadow-pop data-[state=open]:animate-pop-in"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector("input")?.focus();
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              aria-label={p.placeholder}
              placeholder={p.placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(shown.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(active < 0 ? 0 : active);
                }
              }}
              className="h-10 w-full rounded-[10px] border border-line-2 bg-panel-2 pr-3 pl-9 text-[13.5px] placeholder:text-faint focus-visible:border-blue"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filters">
            {p.filters.map(([key, lab]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => {
                  setFilter(key);
                  setActive(-1);
                }}
                className={cn(
                  "rounded-full border border-line-2 px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:text-fg",
                  filter === key && "border-blue bg-blue/14 text-fg",
                )}
              >
                {lab}
              </button>
            ))}
          </div>
          <div ref={listRef} id={listId} role="listbox" aria-label={p.ariaLabel} className="grid max-h-[min(380px,55vh)] gap-px overflow-auto overscroll-contain">
            {shown.length === 0 ? <div className="p-3.5 text-[13px] text-muted">Nothing matches. Try another name or filter.</div> : null}
            {shown.map((it, i) => {
              const g = groupStarts[i];
              const header =
                g !== null ? (
                  <div className="px-2 pt-2 pb-0.5 font-display text-[12.5px] font-bold tracking-[0.1em] text-faint uppercase" role="presentation">
                    {g}
                  </div>
                ) : null;
              const key = p.getKey(it);
              const selected = key === p.value;
              return (
                <React.Fragment key={key}>
                  {header}
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-${i}`}
                    aria-selected={selected}
                    data-selected={selected}
                    data-index={i}
                    onClick={() => choose(i)}
                    onMouseMove={() => active !== i && setActive(i)}
                    className={cn(
                      "grid w-full grid-cols-[1fr_auto] gap-x-2.5 rounded-[9px] px-2.5 py-[7px] text-left",
                      i === active && "bg-panel-3",
                      selected && "shadow-[inset_3px_0_0_var(--blue)]",
                    )}
                  >
                    <span className="truncate text-[13.5px] font-semibold">{p.label(it)}</span>
                    <span className="font-mono text-xs whitespace-nowrap text-muted">{p.right(it)}</span>
                    <span className="col-span-2 truncate text-[11.5px] text-faint">{p.sub(it)}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
