"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "./auth-provider";

/** Reached from the reset email: the link signs the user in, then they set a new password here. */
export function ResetPasswordForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="text-[13px] text-muted-foreground">Checking your reset link…</p>;
  if (!user) return <p className="text-[13px] text-muted-foreground">This reset link has expired or was already used. Request a new one from the sign-in page.</p>;

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await getSupabase()!.auth.updateUser({ password });
        setBusy(false);
        if (error) return void toast.error(error.message);
        toast.success("Password updated.");
        router.push("/");
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Update password
      </Button>
    </form>
  );
}
