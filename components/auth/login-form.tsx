"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "./auth-provider";

type Mode = "signin" | "signup" | "magic" | "reset";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12Z" />
    </svg>
  );
}
function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

/** Which social providers are switched on in Supabase (so we never show a button that can't work). */
function useEnabledProviders(): { google: boolean; github: boolean } {
  const [p, setP] = useState({ google: false, github: false });
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((s: { external?: Record<string, boolean> }) => setP({ google: Boolean(s.external?.google), github: Boolean(s.external?.github) }))
      .catch(() => undefined);
  }, []);
  return p;
}

/** Supabase errors in plain words. */
function friendly(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number };
  const m = e?.message ?? "";
  if (e?.code === "invalid_credentials" || /invalid login credentials/i.test(m)) return "Wrong email or password. New here? Switch to Sign up.";
  if (e?.code === "email_not_confirmed" || /not confirmed/i.test(m)) return "Confirm your email first: open the link we sent you, then sign in.";
  if (e?.code === "user_already_exists" || /already registered/i.test(m)) return "An account with this email already exists. Sign in instead.";
  if (e?.code === "email_address_invalid") return "That email address can't be used. Try another one.";
  if (e?.code === "over_email_send_rate_limit" || /rate limit/i.test(m)) return "Too many emails were sent just now. Wait a few minutes and try again.";
  if (/error sending|not authorized/i.test(m)) return "We couldn't send the email right now. Try again later or use another sign-in method.";
  return m || "Something went wrong. Try again.";
}

export function LoginForm() {
  const { enabled, user } = useAuth();
  const providers = useEnabledProviders();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/";
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  if (!enabled) {
    return (
      <p className="rounded-xl border border-border bg-white/[0.02] p-4 text-[13px] text-muted-foreground">
        Accounts aren&apos;t configured on this deployment yet. You can keep using SysLab as a guest: your progress is saved in this browser.
      </p>
    );
  }
  if (user) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-[14px]">You&apos;re signed in as {user.email}.</p>
        <Button onClick={() => router.push(next as "/")}>Continue</Button>
      </div>
    );
  }

  const sb = getSupabase()!;
  // Read only in event handlers: this component also renders on the server.
  const redirectUrl = () => `${window.location.origin}${next}`;

  const oauth = async (provider: "google" | "github") => {
    setBusy(true);
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl() } });
    if (error) {
      setBusy(false);
      toast.error(friendly(error));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        router.push(next as "/");
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl(), data: { full_name: name.trim() || undefined } } });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Your progress is now saved to it.");
          router.push(next as "/");
        } else setSent(`We sent a confirmation link to ${email}. Open it to finish creating your account.`);
      } else if (mode === "magic") {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl() } });
        if (error) throw error;
        setSent(`We sent a sign-in link to ${email}.`);
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent(`If ${email} has an account, a password reset link is on its way.`);
      }
    } catch (err) {
      toast.error(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <Mail className="mx-auto size-6 text-brand-blue" aria-hidden="true" />
        <p className="text-[14px]">{sent}</p>
        <Button variant="ghost" size="sm" onClick={() => setSent(null)}>
          Use a different email
        </Button>
      </div>
    );
  }

  const title = { signin: "Sign in", signup: "Create your account", magic: "Email me a sign-in link", reset: "Reset your password" }[mode];
  const cta = { signin: "Sign in", signup: "Create account", magic: "Send link", reset: "Send reset link" }[mode];

  return (
    <div className="space-y-5">
      {(mode === "signin" || mode === "signup") && (
        <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-lg border border-border bg-white/[0.03] p-0.5">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn("h-8 rounded-md text-[13px] font-medium transition-colors", mode === m ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>
      )}

      {(mode === "signin" || mode === "signup") && (providers.google || providers.github) && (
        <>
          <div className={cn("grid gap-2", providers.google && providers.github && "sm:grid-cols-2")}>
            {providers.google && (
              <Button variant="outline" disabled={busy} onClick={() => void oauth("google")}>
                <GoogleMark /> Continue with Google
              </Button>
            )}
            {providers.github && (
              <Button variant="outline" disabled={busy} onClick={() => void oauth("github")}>
                <GitHubMark /> Continue with GitHub
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={(e) => void submit(e)} className="space-y-3" aria-label={title}>
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} placeholder="How others see you" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
        </div>
        {(mode === "signin" || mode === "signup") && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "signin" && (
                <button type="button" onClick={() => setMode("reset")} className="text-[12px] text-brand-blue hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : ""}
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {cta}
        </Button>
      </form>

      <p className="text-center text-[12.5px] text-muted-foreground">
        {mode === "signin" || mode === "signup" ? (
          <button type="button" onClick={() => setMode("magic")} className="text-brand-blue hover:underline">
            Email me a sign-in link instead
          </button>
        ) : (
          <button type="button" onClick={() => setMode("signin")} className="text-brand-blue hover:underline">
            Back to sign in
          </button>
        )}
      </p>
    </div>
  );
}
