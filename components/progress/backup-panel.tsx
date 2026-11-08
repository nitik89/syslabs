"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { getRepo, localDay, parseBackup, type BackupFile } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function BackupPanel({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: string; backup: BackupFile } | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  const exportNow = async () => {
    setBusy("export");
    try {
      const backup = await getRepo().exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `syslab-backup-${localDay(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${backup.designs.length} design${backup.designs.length === 1 ? "" : "s"} and your progress`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      setPending({ file: file.name, backup });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const apply = async (mode: "merge" | "replace") => {
    if (!pending) return;
    setBusy("import");
    try {
      const { designs } = await getRepo().importBackup(pending.backup, mode);
      toast.success(mode === "merge" ? `Merged. You now have ${designs} saved design${designs === 1 ? "" : "s"}.` : "Backup restored.");
      setPending(null);
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(null);
    }
  };

  const b = pending?.backup;
  const passed = b ? Object.values(b.progress.challenges).filter((r) => r.passed).length : 0;

  return (
    <section className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5" aria-labelledby="backup-h">
      <div>
        <h2 id="backup-h" className="text-sm font-semibold">
          Backup
        </h2>
        <p className="text-xs text-muted-foreground">Your data lives only in this browser. Export a JSON file to keep it safe or move it to another browser.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void exportNow()} disabled={busy !== null}>
          {busy === "export" ? <Loader2 className="animate-spin" /> : <Download />} Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          <Upload /> Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a SysLab backup file"
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
      </div>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import backup?</DialogTitle>
            <DialogDescription>
              {pending?.file}
              {b?.exportedAt ? `, exported ${fmtDate(b.exportedAt)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {b && (
            <ul className="space-y-1 text-sm">
              <li>
                <span className="font-mono">{b.designs.length}</span> saved design{b.designs.length === 1 ? "" : "s"}
              </li>
              <li>
                <span className="font-mono">{b.progress.xp}</span> XP · <span className="font-mono">{passed}</span> challenge{passed === 1 ? "" : "s"} passed ·{" "}
                <span className="font-mono">{b.progress.activeDays.length}</span> active day{b.progress.activeDays.length === 1 ? "" : "s"}
              </li>
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Merge</strong> keeps everything here and adds the backup: newer copies of a design win, and the best score per challenge is kept.{" "}
            <strong className="text-foreground">Replace</strong> erases your current designs and progress first.
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={busy !== null} onClick={() => void apply("replace")}>
              Replace
            </Button>
            <Button disabled={busy !== null} onClick={() => void apply("merge")}>
              {busy === "import" && <Loader2 className="animate-spin" />} Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
