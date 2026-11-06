"use client";

import { useCallback, useEffect, useState } from "react";
import { getRepo, type ProgressState, type SavedDesign } from "@/lib/storage";

export type ProgressData =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; progress: ProgressState; designs: SavedDesign[]; today: Date };

/** Loads progress + saved designs from storage. `reload()` refetches after a mutation. */
export function useProgressData() {
  const [data, setData] = useState<ProgressData>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const repo = getRepo();
    Promise.all([repo.getProgress(), repo.listDesigns()]).then(
      ([progress, designs]) => {
        if (!cancelled) setData({ status: "ready", progress, designs, today: new Date() });
      },
      (e: unknown) => {
        if (!cancelled) setData({ status: "error", message: e instanceof Error ? e.message : "Could not read saved data." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setData({ status: "loading" });
    setNonce((n) => n + 1);
  }, []);

  return { data, reload };
}
