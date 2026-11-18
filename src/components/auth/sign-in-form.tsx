"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthHeading, authErrorMessage, FormError, PasswordInput, SocialButtons } from "@/components/auth/shared";
import { safeNext, signIn, useSession } from "@/lib/auth-client";

export function SignInForm({ github, google, resetAvailable }: { github: boolean; google: boolean; resetAvailable: boolean }) {
  const uid = React.useId();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { data: session } = useSession();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(params.get("error") ? "Sign-in with that provider didn't complete. Try again." : null);

  if (session) {
    return (
      <div>
        <AuthHeading title="You're signed in" subtitle={`as ${session.user.email}`} />
        <Link href={next} className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
          Continue
        </Link>
      </div>
    );
  }

  const q = params.get("next") ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div>
      <AuthHeading
        title="Welcome back"
        subtitle={
          <>
            New here?{" "}
            <Link href={`/sign-up${q}`} className="font-semibold text-blue hover:underline">
              Create a free account
            </Link>
          </>
        }
      />
      <SocialButtons github={github} google={google} next={next} />
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const { error: err } = await signIn.email({ email: email.trim(), password, rememberMe: remember });
          if (err) {
            setPending(false);
            setError(authErrorMessage(err));
            return;
          }
          setPassword("");
          window.location.assign(next);
        }}
      >
        <FormError message={error} />
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-email`}>Email</Label>
          <Input id={`${uid}-email`} type="email" autoComplete="email" required className="h-10" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${uid}-password`}>Password</Label>
            {resetAvailable ? (
              <Link href="/forgot-password" className="text-xs font-semibold text-blue hover:underline">
                Forgot password?
              </Link>
            ) : null}
          </div>
          <PasswordInput id={`${uid}-password`} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" className="size-4 accent-blue" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Keep me signed in for 30 days
        </label>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
