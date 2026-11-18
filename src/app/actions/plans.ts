"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { DatabaseNotConfiguredError, getDb } from "@/db";
import { plan } from "@/db/schema";
import { randomId } from "@/lib/ids";
import { countPlans, getOwnedPlan } from "@/lib/plans";
import { defaultPlanName, planSummary } from "@/lib/planner/compute";
import { sanitizeState } from "@/lib/planner/state";
import { getSession } from "@/lib/session";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; code?: "UNAUTHORIZED" | "NOT_FOUND" | "INVALID" | "UNAVAILABLE" };

const MAX_PLANS = 500;
const MAX_STATE_BYTES = 100_000;

const nameSchema = z.string().trim().min(1, "Give the plan a name.").max(120, "Keep the name under 120 characters.");
const descriptionSchema = z.string().trim().max(500, "Keep the description under 500 characters.").nullish();
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

class ActionError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHORIZED" | "NOT_FOUND" | "INVALID" | "UNAVAILABLE",
  ) {
    super(message);
  }
}

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new ActionError("Sign in to save plans.", "UNAUTHORIZED");
  return session.user.id;
}

function parseState(input: unknown) {
  if (JSON.stringify(input ?? null).length > MAX_STATE_BYTES) throw new ActionError("This plan is too large to save.", "INVALID");
  return sanitizeState(input);
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ActionError) return { ok: false, error: error.message, code: error.code };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Invalid input.", code: "INVALID" };
    if (error instanceof DatabaseNotConfiguredError)
      return { ok: false, error: "Saving is not available: this deployment has no database yet.", code: "UNAVAILABLE" };
    console.error("[plans] action failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function createPlan(input: { name?: string; description?: string | null; state: unknown }): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const userId = await requireUserId();
    const state = parseState(input.state);
    const name = nameSchema.parse(input.name?.trim() ? input.name : defaultPlanName(state));
    const description = descriptionSchema.parse(input.description) ?? null;
    if ((await countPlans(userId)) >= MAX_PLANS) throw new ActionError(`You can keep up to ${MAX_PLANS} plans. Delete some to save new ones.`, "INVALID");
    const db = await getDb();
    const id = randomId(16);
    await db.insert(plan).values({ id, userId, name, description, mode: state.mode, state: state as unknown as Record<string, unknown>, summary: planSummary(state) });
    return { id };
  });
}

export async function updatePlanState(id: string, rawState: unknown): Promise<ActionResult<{ updatedAt: string }>> {
  return run(async () => {
    const userId = await requireUserId();
    const planId = idSchema.parse(id);
    const state = parseState(rawState);
    const db = await getDb();
    const rows = await db
      .update(plan)
      .set({ state: state as unknown as Record<string, unknown>, mode: state.mode, summary: planSummary(state), updatedAt: new Date() })
      .where(and(eq(plan.id, planId), eq(plan.userId, userId)))
      .returning({ updatedAt: plan.updatedAt });
    if (!rows[0]) throw new ActionError("This plan no longer exists.", "NOT_FOUND");
    return { updatedAt: rows[0].updatedAt.toISOString() };
  });
}

export async function updatePlanDetails(id: string, input: { name: string; description?: string | null }): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const planId = idSchema.parse(id);
    const name = nameSchema.parse(input.name);
    const description = descriptionSchema.parse(input.description) ?? null;
    const db = await getDb();
    const rows = await db
      .update(plan)
      .set({ name, description, updatedAt: new Date() })
      .where(and(eq(plan.id, planId), eq(plan.userId, userId)))
      .returning({ id: plan.id });
    if (!rows[0]) throw new ActionError("This plan no longer exists.", "NOT_FOUND");
    refresh();
    return null;
  });
}

export async function setPlanStarred(id: string, starred: boolean): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const db = await getDb();
    await db
      .update(plan)
      .set({ starred: Boolean(starred) })
      .where(and(eq(plan.id, idSchema.parse(id)), eq(plan.userId, userId)));
    refresh();
    return null;
  });
}

export async function duplicatePlan(id: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const userId = await requireUserId();
    const source = await getOwnedPlan(idSchema.parse(id), userId);
    if (!source) throw new ActionError("This plan no longer exists.", "NOT_FOUND");
    if ((await countPlans(userId)) >= MAX_PLANS) throw new ActionError(`You can keep up to ${MAX_PLANS} plans.`, "INVALID");
    const db = await getDb();
    const newId = randomId(16);
    await db.insert(plan).values({
      id: newId,
      userId,
      name: `${source.name} (copy)`.slice(0, 120),
      description: source.description,
      mode: source.mode,
      state: source.state,
      summary: source.summary,
    });
    refresh();
    return { id: newId };
  });
}

export async function setPlanSharing(id: string, isPublic: boolean): Promise<ActionResult<{ shareId: string | null; isPublic: boolean }>> {
  return run(async () => {
    const userId = await requireUserId();
    const current = await getOwnedPlan(idSchema.parse(id), userId);
    if (!current) throw new ActionError("This plan no longer exists.", "NOT_FOUND");
    const shareId = current.shareId ?? randomId(12);
    const db = await getDb();
    await db
      .update(plan)
      .set({ isPublic: Boolean(isPublic), shareId })
      .where(and(eq(plan.id, current.id), eq(plan.userId, userId)));
    refresh();
    return { shareId, isPublic: Boolean(isPublic) };
  });
}

export async function deletePlan(id: string): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    const db = await getDb();
    await db.delete(plan).where(and(eq(plan.id, idSchema.parse(id)), eq(plan.userId, userId)));
    refresh();
    return null;
  });
}
