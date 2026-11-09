"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getRepo, type DesignDoc } from "@/lib/storage";
import { getSharedDesign } from "@/lib/supabase/public";
import { LAB_STARTER } from "@/data/lab-starter";
import { Button } from "@/components/ui/button";
import { Designer } from "./designer";
import { ShareButton } from "./share-button";
import { LoadDesignButton, ResetButton, SaveDesignButton, type CurrentDesign } from "./design-actions";

const DRAFT = "lab";
const EMPTY: DesignDoc = { graph: { nodes: [], edges: [] }, positions: {}, traffic: LAB_STARTER.traffic };

type Phase =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; doc: DesignDoc; current: CurrentDesign | null; key: number };

async function loadInitial(designId: string | null, sharedId: string | null): Promise<{ doc: DesignDoc; current: CurrentDesign | null; missingDesign: boolean }> {
  const repo = getRepo();
  if (sharedId) {
    // Fork a shared design: it opens as an unsaved copy in your Lab.
    const shared = await getSharedDesign(sharedId).catch(() => null);
    if (shared) return { doc: shared.design, current: null, missingDesign: false };
    return { doc: (await repo.getDraft(DRAFT)) ?? LAB_STARTER, current: null, missingDesign: true };
  }
  if (designId) {
    const d = (await repo.listDesigns()).find((x) => x.id === designId);
    if (d) return { doc: d, current: { id: d.id, name: d.name }, missingDesign: false };
  }
  const draft = await repo.getDraft(DRAFT);
  return { doc: draft ?? LAB_STARTER, current: null, missingDesign: designId !== null };
}

export function LabClient() {
  const params = useSearchParams();
  const router = useRouter();
  // Read ?design= once: clearing it from the URL afterwards must not trigger a reload of the draft.
  const [designParam] = useState(() => params.get("design"));
  const [sharedParam] = useState(() => params.get("shared"));
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const [current, setCurrent] = useState<CurrentDesign | null>(null);
  const draftWarned = useRef(false);

  const boot = useCallback(() => {
    let cancelled = false;
    loadInitial(designParam, sharedParam).then(
      (res) => {
        if (cancelled) return;
        if (res.missingDesign) toast.error(sharedParam ? "That shared design couldn't be opened." : "That saved design no longer exists.");
        else if (sharedParam) toast.success("Opened a copy of the shared design. Save it to keep it.");
        if (designParam || sharedParam) router.replace("/lab");
        setCurrent(res.current);
        setState({ phase: "ready", doc: res.doc, current: res.current, key: Date.now() });
      },
      (e: unknown) => {
        if (!cancelled) setState({ phase: "error", message: e instanceof Error ? e.message : "Could not read saved data." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [designParam, sharedParam, router]);

  useEffect(() => boot(), [boot]);

  const saveDraft = useCallback((doc: DesignDoc) => {
    getRepo()
      .setDraft(DRAFT, doc)
      .catch((e: unknown) => {
        if (!draftWarned.current) {
          draftWarned.current = true;
          toast.error(e instanceof Error ? e.message : "Autosave failed.");
        }
      });
  }, []);

  const markActive = useCallback(() => {
    getRepo().markActive().catch(() => undefined);
  }, []);

  if (state.phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" /> Loading your canvas…
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load your canvas</p>
          <p className="text-xs text-muted-foreground">{state.message}</p>
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setState({ phase: "loading" });
                boot();
              }}
            >
              Try again
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                setState({ phase: "loading" });
                await getRepo().clearDraft(DRAFT).catch(() => undefined);
                boot();
              }}
            >
              Discard draft
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Designer
      key={state.key}
      initial={state.doc}
      onDocChange={saveDraft}
      onRun={markActive}
      actions={({ getDoc, loadDoc }) => (
        <>
          <SaveDesignButton getDoc={getDoc} current={current} onSaved={(d) => setCurrent({ id: d.id, name: d.name })} />
          <ShareButton getDoc={getDoc} defaultName={current?.name ?? "My architecture"} />
          <LoadDesignButton
            filter={(d) => !d.challengeId}
            onLoad={(d) => {
              loadDoc(d);
              setCurrent({ id: d.id, name: d.name });
            }}
          />
          <ResetButton
            options={[
              {
                label: "Blank canvas",
                destructive: true,
                onSelect: () => {
                  loadDoc(EMPTY);
                  setCurrent(null);
                },
              },
              {
                label: "Starter design",
                onSelect: () => {
                  loadDoc(LAB_STARTER);
                  setCurrent(null);
                },
              },
            ]}
          />
          {current && (
            <span className="max-w-40 truncate px-1 text-xs text-muted-foreground" title={current.name}>
              {current.name}
            </span>
          )}
        </>
      )}
    />
  );
}
