import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-reset";
import { passwordResetAvailable } from "@/lib/auth-features";
import { emailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm available={passwordResetAvailable()} devHint={!emailConfigured()} />;
}
