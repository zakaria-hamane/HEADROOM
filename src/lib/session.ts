import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DatabaseNotConfiguredError } from "@/db";
import { getAuth, type AuthSession } from "@/lib/auth";

/** The signed-in session for this request, or null. Deduplicated per request. */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  // Read the request first: during prerendering this stops here, before any database work.
  const requestHeaders = await headers();
  try {
    const auth = await getAuth();
    return await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return null;
    throw error;
  }
});

/** The signed-in session, or a redirect to sign-in that returns to `next` afterwards. */
export async function requireSession(next: string): Promise<AuthSession> {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return session;
}
