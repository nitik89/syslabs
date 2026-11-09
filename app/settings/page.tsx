import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsForm } from "@/components/auth/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" description="Your public name, username and what others can see." />
      <div className="mx-auto w-full max-w-2xl px-6 pb-12 md:px-10">
        <SettingsForm />
      </div>
    </>
  );
}
