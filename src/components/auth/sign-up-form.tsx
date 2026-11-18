"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthHeading, authErrorMessage, FormError, PasswordInput, PasswordStrength, SocialButtons } from "@/components/auth/shared";
import { safeNext, signUp, useSession } from "@/lib/auth-client";

export function SignUpForm({ github, google }: { github: boolean; google: boolean }) {
  const uid = React.useId();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { data: session } = useSession();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
        title="Create your account"
        subtitle={
          <>
            Free. Already have one?{" "}
            <Link href={`/sign-in${q}`} className="font-semibold text-blue hover:underline">
              Sign in
            </Link>
          </>
        }
      />
      <SocialButtons github={github} google={google} next={next} />
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8) {
            setError("Use at least 8 characters for your password.");
            return;
          }
          setPending(true);
          setError(null);
          const { error: err } = await signUp.email({ name: name.trim(), email: email.trim(), password });
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
          <Label htmlFor={`${uid}-name`}>Name</Label>
          <Input id={`${uid}-name`} autoComplete="name" required maxLength={80} className="h-10" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-email`}>Work email</Label>
          <Input id={`${uid}-email`} type="email" autoComplete="email" required className="h-10" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-password`}>Password</Label>
          <PasswordInput id={`${uid}-password`} autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordStrength password={password} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
          Create account
        </Button>
        <p className="text-center text-xs text-faint">Your plans stay private unless you turn on a share link.</p>
      </form>
    </div>
  );
}
