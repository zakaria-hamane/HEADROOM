import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormSkeleton } from "@/components/auth/form-skeleton";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { socialProviderFlags } from "@/lib/auth-features";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  const social = socialProviderFlags();
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignUpForm github={social.github} google={social.google} />
    </Suspense>
  );
}
