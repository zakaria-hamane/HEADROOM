"use client";

import { Tabs } from "radix-ui";
import { Card } from "@/components/ui/card";
import { usePlanner } from "@/components/planner/context";
import { Capacity } from "@/components/planner/lower/capacity";
import { CompareTable } from "@/components/planner/lower/compare";
import { Formulas } from "@/components/planner/lower/formulas";
import { Simulation } from "@/components/planner/lower/simulation";

export type LowerTab = "sim" | "capacity" | "compare" | "math";

const INF_TABS: [LowerTab, string][] = [
  ["sim", "Inference simulation"],
  ["capacity", "Capacity"],
  ["compare", "Compare all GPUs"],
  ["math", "How it is calculated"],
];
const FT_TABS: [LowerTab, string][] = [
  ["compare", "Compare all GPUs"],
  ["math", "How it is calculated"],
];

export function LowerTabs({ tab, onTabChange }: { tab: LowerTab; onTabChange: (t: LowerTab) => void }) {
  const { state } = usePlanner();
  const tabs = state.mode === "inf" ? INF_TABS : FT_TABS;
  const value = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];
  return (
    <Card className="p-4 sm:p-[18px]">
      <Tabs.Root value={value} onValueChange={(v) => onTabChange(v as LowerTab)}>
        <Tabs.List aria-label="Details" className="mb-4 flex flex-wrap gap-1">
          {tabs.map(([k, label]) => (
            <Tabs.Trigger
              key={k}
              value={k}
              className="rounded-[10px] border border-line-2 bg-panel-2 px-3.5 py-2 font-display text-[15px] font-bold tracking-[0.06em] text-muted uppercase transition-colors hover:text-fg data-[state=active]:border-blue data-[state=active]:bg-blue/12 data-[state=active]:text-fg"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {state.mode === "inf" ? (
          <>
            <Tabs.Content value="sim">
              <Simulation />
            </Tabs.Content>
            <Tabs.Content value="capacity">
              <Capacity />
            </Tabs.Content>
          </>
        ) : null}
        <Tabs.Content value="compare">
          <CompareTable />
        </Tabs.Content>
        <Tabs.Content value="math">
          <Formulas />
        </Tabs.Content>
      </Tabs.Root>
    </Card>
  );
}
