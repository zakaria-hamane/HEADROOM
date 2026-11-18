"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

/** Friendly copy for Better Auth errors. */
export function authErrorMessage(error: AuthError): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (error.status === 503 || error.code === "DATABASE_NOT_CONFIGURED") return "Accounts aren't set up on this deployment yet (no database). The planner still works without an account.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match. Check them and try again.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "That password is too long (128 characters at most).";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "INVALID_TOKEN":
      return "This reset link is invalid or has expired. Ask for a new one.";
    case "INVALID_PASSWORD":
      return "Your current password is not correct.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

export function PasswordInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} className={cn(controlClass, "h-10 pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-fg"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, pw.length < 8 ? Math.min(1, s) : s);
}

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["var(--status-critical)", "var(--status-serious)", "var(--status-warning)", "var(--status-good)", "var(--status-good)"];
  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1 flex-1 rounded-full bg-track transition-colors" style={i < Math.max(1, score) && password ? { background: colors[score] } : undefined} />
        ))}
      </div>
      <span className="mt-1 block text-[11.5px] text-muted">{password ? `${labels[score]} password` : "At least 8 characters. A short phrase works well."}</span>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] fill-current" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.26a12 12 0 0 0 0 10.76l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.26 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

export function SocialButtons({ github, google, next }: { github: boolean; google: boolean; next: string }) {
  const [pending, setPending] = React.useState<string | null>(null);
  if (!github && !google) return null;
  const go = async (provider: "github" | "google") => {
    setPending(provider);
    await signIn.social({ provider, callbackURL: next, errorCallbackURL: "/sign-in" });
    setPending(null);
  };
  return (
    <>
      <div className="grid gap-2">
        {github ? (
          <Button size="lg" className="w-full" onClick={() => void go("github")} loading={pending === "github"}>
            {pending === "github" ? null : <GitHubIcon />} Continue with GitHub
          </Button>
        ) : null}
        {google ? (
          <Button size="lg" className="w-full" onClick={() => void go("google")} loading={pending === "google"}>
            {pending === "google" ? null : <GoogleIcon />} Continue with Google
          </Button>
        ) : null}
      </div>
      <div className="my-5 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] border border-red/40 bg-red/10 px-3 py-2 text-[13px] font-medium">
      {message}
    </p>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="m-0 font-display text-[34px] leading-none font-bold tracking-[0.02em] uppercase">{title}</h1>
      <p className="mt-2 text-[14px] text-muted">{subtitle}</p>
    </div>
  );
}
