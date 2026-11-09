import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <section className="surface w-full max-w-sm space-y-4 rounded-2xl p-6">
        <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
        <ResetPasswordForm />
      </section>
    </div>
  );
}
