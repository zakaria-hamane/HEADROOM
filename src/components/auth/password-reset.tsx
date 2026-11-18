"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthHeading, authErrorMessage, FormError, PasswordInput, PasswordStrength } from "@/components/auth/shared";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm({ available, devHint }: { available: boolean; devHint: boolean }) {
  const uid = React.useId();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!available) {
    return (
      <div>
        <AuthHeading title="Reset your password" subtitle="Password reset by email isn't set up on this deployment yet." />
        <p className="text-[13px] text-muted">Ask the administrator to add an email provider (RESEND_API_KEY and EMAIL_FROM), or sign in with another method.</p>
        <Link href="/sign-in" className={buttonVariants({ variant: "secondary", size: "lg", className: "mt-6 w-full" })}>
          Back to sign in
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div>
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-green/12 text-green">
          <MailCheck className="size-6" />
        </span>
        <AuthHeading title="Check your inbox" subtitle={`If an account exists for ${email}, a reset link is on its way. It works for 1 hour.`} />
        {devHint ? <p className="rounded-[10px] border border-line bg-panel-2 px-3 py-2 text-xs text-muted">Development mode: the link is printed in the terminal running the dev server.</p> : null}
        <Link href="/sign-in" className={buttonVariants({ variant: "secondary", size: "lg", className: "mt-6 w-full" })}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Reset your password" subtitle="Enter your account's email and we'll send you a link to choose a new password." />
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const { error: err } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
          setPending(false);
          if (err) return setError(authErrorMessage(err));
          setSent(true);
        }}
      >
        <FormError message={error} />
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-email`}>Email</Label>
          <Input id={`${uid}-email`} type="email" autoComplete="email" required className="h-10" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
          Send reset link
        </Button>
        <Link href="/sign-in" className="text-center text-[13px] font-semibold text-blue hover:underline">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}

export function ResetPasswordForm() {
  const uid = React.useId();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const linkError = params.get("error");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!token || linkError) {
    return (
      <div>
        <AuthHeading title="Link expired" subtitle="This reset link is invalid or has already been used." />
        <Link href="/forgot-password" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
          Get a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Choose a new password" subtitle="You'll be signed out on other devices." />
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8) return setError("Use at least 8 characters for your password.");
          setPending(true);
          setError(null);
          const { error: err } = await authClient.resetPassword({ newPassword: password, token });
          setPending(false);
          if (err) return setError(authErrorMessage(err));
          toast.success("Password updated. Sign in with your new password.");
          router.push("/sign-in");
        }}
      >
        <FormError message={error} />
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-password`}>New password</Label>
          <PasswordInput id={`${uid}-password`} autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          <PasswordStrength password={password} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
          Update password
        </Button>
      </form>
    </div>
  );
}
