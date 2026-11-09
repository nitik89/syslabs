import type { Metadata } from "next";
import { Suspense } from "react";
import { Cloud, Share2, Trophy } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/shell/logo";

export const metadata: Metadata = { title: "Sign in" };

const PERKS = [
  { icon: Cloud, text: "Your progress and designs, on every device" },
  { icon: Trophy, text: "A public profile and a spot on the leaderboard" },
  { icon: Share2, text: "Share any design with a link" },
];

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-border md:grid-cols-2">
        <aside className="relative hidden flex-col justify-between gap-8 bg-sidebar/70 p-8 md:flex">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <Logo />
          </div>
          <div className="relative space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Save your progress. Show your work.</h1>
            <ul className="space-y-3">
              {PERKS.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-[14px] text-muted-foreground">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-blue/12 text-brand-blue">
                    <p.icon className="size-4" aria-hidden="true" />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-[12px] text-muted-foreground">Already practising as a guest? Your progress in this browser moves into your account when you sign in.</p>
        </aside>
        <section className="bg-card p-8">
          <Suspense>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
