import "server-only";

import { emailConfigured } from "@/lib/email";

/** Which sign-in options this deployment offers (read from environment variables). */
export function socialProviderFlags() {
  return {
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}

/** Password reset needs email delivery in production; in development the link is printed to the server console. */
export function passwordResetAvailable(): boolean {
  return emailConfigured() || process.env.NODE_ENV !== "production";
}
