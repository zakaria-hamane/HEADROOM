"use client";

import { createAuthClient } from "better-auth/react";

/** Browser auth client. Talks to /api/auth on the current origin. */
export const authClient = createAuthClient();

export const { useSession, signIn, signUp, signOut } = authClient;

/** Only same-site relative paths are accepted as post-login destinations (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
