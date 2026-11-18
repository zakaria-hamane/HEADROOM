import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormSkeleton } from "@/components/auth/form-skeleton";
import { SignInForm } from "@/components/auth/sign-in-form";
import { passwordResetAvailable, socialProviderFlags } from "@/lib/auth-features";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  const social = socialProviderFlags();
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignInForm github={social.github} google={social.google} resetAvailable={passwordResetAvailable()} />
    </Suspense>
  );
}
