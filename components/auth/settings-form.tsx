"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "./user-menu";
import { useAuth, type Profile } from "./auth-provider";

const USERNAME = /^[a-z0-9_]{3,24}$/;

function Form({ profile, email }: { profile: Profile; email: string }) {
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [busy, setBusy] = useState(false);
  const validName = USERNAME.test(username);

  return (
    <form
      className="surface space-y-5 rounded-2xl p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!validName) return;
        setBusy(true);
        const { error } = await getSupabase()!
          .from("profiles")
          .update({ username, display_name: displayName.trim(), is_public: isPublic })
          .eq("id", profile.id);
        setBusy(false);
        if (error) return void toast.error(error.code === "23505" ? "That username is taken." : error.message);
        await refreshProfile();
        toast.success("Saved.");
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={displayName || username} url={profile.avatar_url} className="size-12 text-sm" />
        <div>
          <p className="font-semibold">{displayName || username}</p>
          <p className="text-[12.5px] text-muted-foreground">{email}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="display-name">Display name</Label>
        <Input id="display-name" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} aria-invalid={!validName} aria-describedby="username-help" />
        <p id="username-help" className={validName ? "text-[12px] text-muted-foreground" : "text-[12px] text-status-crit"}>
          3–24 characters: lowercase letters, numbers and underscores. Your profile lives at /u/{username || "…"}.
        </p>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-border p-3">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
        <span>
          <span className="block text-[13.5px] font-medium">Public profile and leaderboard</span>
          <span className="block text-[12.5px] text-muted-foreground">Show your name, XP and solved problems on your profile page and the leaderboard. Your designs stay private unless you share one.</span>
        </span>
      </label>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy || !validName}>
          {busy && <Loader2 className="animate-spin" />} Save
        </Button>
        {profile.is_public && (
          <Link href={`/u/${profile.username}`} className={buttonVariants({ variant: "ghost" })}>
            View public profile
          </Link>
        )}
      </div>
    </form>
  );
}

export function SettingsForm() {
  const { enabled, loading, user, profile } = useAuth();
  if (!enabled) return <p className="text-[13px] text-muted-foreground">Accounts aren&apos;t configured on this deployment.</p>;
  if (loading || (user && !profile)) return <p className="text-[13px] text-muted-foreground">Loading…</p>;
  if (!user || !profile) {
    return (
      <p className="text-[13px] text-muted-foreground">
        <Link href="/login?next=/settings" className="text-brand-blue hover:underline">
          Sign in
        </Link>{" "}
        to manage your account.
      </p>
    );
  }
  return <Form key={profile.id} profile={profile} email={user.email ?? ""} />;
}
