"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { DesignDoc } from "@/lib/storage";
import { shareDesign } from "@/lib/supabase/public";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";

/** Publish a read-only snapshot of the canvas and get a link anyone can open (and fork into their Lab). */
export function ShareButton({ getDoc, defaultName, challengeId }: { getDoc: () => DesignDoc; defaultName: string; challengeId?: string }) {
  const { enabled, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!enabled) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setUrl(null);
          setCopied(false);
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Share2 /> Share
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this design</DialogTitle>
          <DialogDescription>Creates a read-only snapshot. Anyone with the link can view it and open a copy in their own Lab. Later edits on your canvas aren&apos;t included.</DialogDescription>
        </DialogHeader>
        {!user ? (
          <p className="text-[13px] text-muted-foreground">
            <Link href="/login" className="font-medium text-brand-blue hover:underline">
              Sign in
            </Link>{" "}
            to share designs.
          </p>
        ) : url ? (
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const id = await shareDesign(name.trim(), getDoc(), challengeId);
                setUrl(`${window.location.origin}/d/${id}`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Couldn't share.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="share-name">Name</Label>
              <Input id="share-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />} Create link
            </Button>
          </form>
        )}
        {url && (
          <Link href={url.replace(window.location.origin, "") as "/"} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Open the shared page
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
}
