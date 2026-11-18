import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { Skeleton } from "@/components/ui/misc";
import { DangerSection, PasswordSection, ProfileSection, SessionsSection } from "@/components/settings/settings-sections";
import { getDb } from "@/db";
import { account } from "@/db/schema";
import { countPlans } from "@/lib/plans";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Account settings", robots: { index: false } };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="m-0 font-display text-[34px] leading-none font-bold tracking-[0.02em] uppercase">Account settings</h1>
      <p className="mt-2 mb-7 text-[14px] text-muted">Your profile, sign-in and data.</p>
      <Suspense
        fallback={
          <div className="grid gap-4" aria-busy="true">
            {[180, 200, 160].map((h) => (
              <Skeleton key={h} className="rounded-2xl" style={{ height: h }} />
            ))}
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const session = await requireSession("/settings");
  const db = await getDb();
  const [accounts, planCount] = await Promise.all([
    db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, session.user.id)),
    countPlans(session.user.id),
  ]);
  const providers = [...new Set(accounts.map((a) => a.providerId))];
  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    createdAt: new Date(session.user.createdAt).toISOString(),
    hasPassword: providers.includes("credential"),
    providers,
  };
  return (
    <div className="grid gap-4">
      <ProfileSection user={user} />
      <PasswordSection user={user} />
      <SessionsSection />
      <DangerSection user={user} planCount={planCount} />
    </div>
  );
}
