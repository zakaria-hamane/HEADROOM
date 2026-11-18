import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, type Database } from "@/db";
import { authSchema } from "@/db/schema";
import { passwordResetAvailable, socialProviderFlags } from "@/lib/auth-features";
import { escapeHtml, sendEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site";

const isProd = process.env.NODE_ENV === "production";

function hostOf(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).host;
  } catch {
    return undefined;
  }
}

/**
 * The public URL auth runs on. BETTER_AUTH_URL wins when set. Otherwise the request host is accepted when it is
 * one of this deployment's Vercel URLs (production domain, branch URL, deployment URL), AUTH_ALLOWED_HOSTS, or
 * localhost during development.
 */
function authBaseURL(): BetterAuthOptions["baseURL"] {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  const hosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
    ...(process.env.AUTH_ALLOWED_HOSTS ?? "").split(","),
  ]
    .map((h) => hostOf(h?.trim()))
    .filter((h): h is string => Boolean(h));
  if (!isProd || !process.env.VERCEL) hosts.push("localhost:*", "127.0.0.1:*");
  const production = hostOf(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return {
    allowedHosts: [...new Set(hosts)],
    fallback: production ? `https://${production}` : "http://localhost:3000",
    protocol: process.env.VERCEL ? "https" : "auto",
  };
}

function buildAuth(db: Database) {
  const social = socialProviderFlags();
  return betterAuth({
    appName: siteConfig.name,
    baseURL: authBaseURL(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: passwordResetAvailable()
        ? async ({ user, url }) => {
            const name = escapeHtml(user.name || "there");
            await sendEmail({
              to: user.email,
              subject: `Reset your ${siteConfig.name} password`,
              text: `Hi ${user.name || "there"},\n\nReset your password with this link (valid for 1 hour):\n${url}\n\nIf you did not ask for this, ignore this email.`,
              html: `<p>Hi ${name},</p><p><a href="${escapeHtml(url)}">Reset your password</a>. The link is valid for 1 hour.</p><p>If you did not ask for this, ignore this email.</p>`,
            });
          }
        : undefined,
    },
    socialProviders: {
      ...(social.github
        ? { github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! } }
        : {}),
      ...(social.google
        ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
        : {}),
    },
    user: {
      deleteUser: { enabled: true },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // No cookie cache: revoking a session (sign out everywhere, password reset) takes effect immediately.
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: isProd,
      storage: "database",
      window: 60,
      max: 120,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    telemetry: { enabled: false },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof buildAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

const globalForAuth = globalThis as unknown as { __headroomAuth?: Promise<Auth> };

/** The Better Auth instance, created on first use (after the database connection is ready). */
export function getAuth(): Promise<Auth> {
  if (!globalForAuth.__headroomAuth) {
    globalForAuth.__headroomAuth = getDb()
      .then(buildAuth)
      .catch((error) => {
        globalForAuth.__headroomAuth = undefined;
        throw error;
      });
  }
  return globalForAuth.__headroomAuth;
}
