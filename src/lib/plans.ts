import "server-only";

import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { plan, user, type Plan } from "@/db/schema";

/** Data access for saved plans. Every read is scoped to its owner or to a public share link. */

export type PlanListItem = Pick<Plan, "id" | "name" | "description" | "mode" | "summary" | "starred" | "isPublic" | "shareId" | "createdAt" | "updatedAt">;

export async function listPlans(userId: string): Promise<PlanListItem[]> {
  const db = await getDb();
  return db
    .select({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      mode: plan.mode,
      summary: plan.summary,
      starred: plan.starred,
      isPublic: plan.isPublic,
      shareId: plan.shareId,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    })
    .from(plan)
    .where(eq(plan.userId, userId))
    .orderBy(desc(plan.updatedAt))
    .limit(500);
}

export async function getOwnedPlan(id: string, userId: string): Promise<Plan | null> {
  const db = await getDb();
  const rows = await db.select().from(plan).where(and(eq(plan.id, id), eq(plan.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function getSharedPlan(shareId: string): Promise<(Plan & { ownerName: string }) | null> {
  const db = await getDb();
  const rows = await db
    .select({ plan, ownerName: user.name })
    .from(plan)
    .innerJoin(user, eq(user.id, plan.userId))
    .where(and(eq(plan.shareId, shareId), eq(plan.isPublic, true)))
    .limit(1);
  const row = rows[0];
  return row ? { ...row.plan, ownerName: row.ownerName } : null;
}

export async function countPlans(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ value: count() }).from(plan).where(eq(plan.userId, userId));
  return Number(rows[0]?.value ?? 0);
}
