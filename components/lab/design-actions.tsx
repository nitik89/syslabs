"use client";

import { useId, useRef, useState } from "react";
import { FolderOpen, Loader2, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { getRepo, parseBackup, type DesignDoc, type SavedDesign } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CurrentDesign {
  id: string;
  name: string;
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/* --------------------------------- Save --------------------------------- */

export function SaveDesignButton({
  getDoc,
  current,
  onSaved,
  challengeId,
  defaultName = "My design",
}: {
  getDoc: () => DesignDoc;
  current: CurrentDesign | null;
  onSaved: (d: SavedDesign) => void;
  challengeId?: string;
  defaultName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId();

  const save = async (asNew: boolean) => {
    setBusy(true);
    try {
      const d = await getRepo().saveDesign({ id: asNew ? undefined : current?.id, name, doc: getDoc(), challengeId });
      onSaved(d);
      toast.success(`Saved "${d.name}"`);
      setOpen(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setName(current?.name ?? defaultName);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Save /> Save
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(false);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{current ? "Save design" : "Save new design"}</DialogTitle>
            <DialogDescription>Stored in this browser. You can reopen it from Load or the Progress page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={id}>Name</Label>
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus required />
          </div>
          <DialogFooter>
            {current && (
              <Button type="button" variant="outline" disabled={busy || !name.trim()} onClick={() => void save(true)}>
                Save as new
              </Button>
            )}
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />} {current ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Load --------------------------------- */

type LoadState = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; designs: SavedDesign[] };

export function LoadDesignButton({
  onLoad,
  filter,
}: {
  onLoad: (d: SavedDesign) => void;
  filter?: (d: SavedDesign) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const all = await getRepo().listDesigns();
      setState({ phase: "ready", designs: filter ? all.filter(filter) : all });
    } catch (e) {
      setState({ phase: "error", message: errMsg(e) });
    }
  };

  /**
   * Import a SysLab file (backup or shared design) without leaving the Lab. Merges with what's saved, never
   * replaces. If the file holds exactly one design, open it straight away.
   */
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const backup = parseBackup(await file.text());
      await getRepo().importBackup(backup, "merge");
      const visible = filter ? backup.designs.filter(filter) : backup.designs;
      if (visible.length === 1) {
        onLoad(visible[0]);
        setOpen(false);
        toast.success(`Imported and opened "${visible[0].name}"`);
      } else {
        toast.success(`Imported ${backup.designs.length} design${backup.designs.length === 1 ? "" : "s"}`);
        await refresh();
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (d: SavedDesign) => {
    try {
      await getRepo().deleteDesign(d.id);
      toast.success(`Deleted "${d.name}"`);
      setConfirmDelete(null);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setState({ phase: "loading" });
          setConfirmDelete(null);
          void refresh();
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <FolderOpen /> Load
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Saved designs</DialogTitle>
          <DialogDescription>Opening a design replaces what is on the canvas.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">
          {state.phase === "loading" && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          )}
          {state.phase === "error" && (
            <div className="space-y-2 py-4">
              <p className="text-sm text-destructive">{state.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setState({ phase: "loading" });
                  void refresh();
                }}
              >
                Try again
              </Button>
            </div>
          )}
          {state.phase === "ready" && state.designs.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No saved designs yet. Use Save to keep one.</p>
          )}
          {state.phase === "ready" && state.designs.length > 0 && (
            <ul className="divide-y divide-border">
              {state.designs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.graph.nodes.length} components · {fmtDate(d.updatedAt)}
                    </p>
                  </div>
                  {confirmDelete === d.id ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => void remove(d)}>
                        Confirm delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => setConfirmDelete(d.id)}>
                        <Trash2 />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          onLoad(d);
                          setOpen(false);
                          toast.success(`Opened "${d.name}"`);
                        }}
                      >
                        Open
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Have a SysLab .json file? Import it here.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Design file" onChange={(e) => void importFile(e.target.files?.[0])} />
          <Button size="sm" variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 className="animate-spin" /> : <Upload />} Import file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Reset --------------------------------- */

export function ResetButton({
  options,
  title = "Reset canvas?",
  description = "Unsaved changes on the canvas will be lost. Saved designs are not affected.",
}: {
  options: Array<{ label: string; onSelect: () => void; destructive?: boolean }>;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <RotateCcw /> Reset
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          {options.map((o) => (
            <Button
              key={o.label}
              variant={o.destructive ? "destructive" : "default"}
              onClick={() => {
                o.onSelect();
                setOpen(false);
              }}
            >
              {o.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
