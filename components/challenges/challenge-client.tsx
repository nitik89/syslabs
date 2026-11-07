"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, Lightbulb, Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import type { Challenge } from "@/lib/challenges/types";
import { scoreChallenge } from "@/lib/challenges/score";
import { CATALOG, simulate, type SimGraph, type SimResult } from "@/lib/sim";
import { getRepo, type ChallengeRecord, type DesignDoc } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Designer } from "@/components/lab/designer";
import { LoadDesignButton, ResetButton, SaveDesignButton, type CurrentDesign } from "@/components/lab/design-actions";
import { ObjectiveList, ScoreCard } from "./score-card";

type Phase = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; doc: DesignDoc; key: number };

/** Same components (kind + config) and same connections, ignoring ids' order, labels and positions. */
function sameGraph(a: SimGraph, b: SimGraph): boolean {
  const nodes = (g: SimGraph) =>
    g.nodes
      .map((n) => `${n.id}|${n.kind}|${JSON.stringify(Object.entries(n.config).sort(([x], [y]) => x.localeCompare(y)))}`)
      .sort()
      .join("\n");
  const edges = (g: SimGraph) =>
    g.edges
      .map((e) => `${e.source}>${e.target}`)
      .sort()
      .join("\n");
  return nodes(a) === nodes(b) && edges(a) === edges(b);
}

function startingDoc(ch: Challenge): DesignDoc {
  return { ...structuredClone(ch.startingDesign), traffic: { ...ch.traffic } };
}

export function ChallengeClient({ challenge }: { challenge: Challenge }) {
  const isBuild = challenge.mode === "build";
  const basePath = isBuild ? "/build" : "/challenges";
  const noun = isBuild ? "problem" : "challenge";
  const draftScope = `challenge:${challenge.id}`;
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const [record, setRecord] = useState<ChallengeRecord | null>(null);
  const [current, setCurrent] = useState<CurrentDesign | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [briefOpen, setBriefOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const draftWarned = useRef(false);
  const router = useRouter();
  const params = useSearchParams();
  // Read ?design= once: clearing it from the URL afterwards must not reload the draft over it.
  const [designParam] = useState(() => params.get("design"));

  const boot = useCallback(() => {
    let cancelled = false;
    const repo = getRepo();
    Promise.all([repo.getDraft(draftScope), repo.getProgress(), designParam ? repo.listDesigns() : Promise.resolve([])]).then(
      ([draft, progress, designs]) => {
        if (cancelled) return;
        const saved = designs.find((d) => d.id === designParam && d.challengeId === challenge.id);
        if (designParam) {
          if (!saved) toast.error("That saved design no longer exists.");
          router.replace(`${basePath}/${challenge.id}`);
        }
        // Traffic is always the challenge's, even if an old draft or save says otherwise.
        const base = saved ?? draft;
        const doc = base ? { graph: base.graph, positions: base.positions, traffic: { ...challenge.traffic } } : startingDoc(challenge);
        if (saved) setCurrent({ id: saved.id, name: saved.name });
        setRecord(progress.challenges[challenge.id] ?? null);
        setState({ phase: "ready", doc, key: Date.now() });
      },
      (e: unknown) => {
        if (!cancelled) setState({ phase: "error", message: e instanceof Error ? e.message : "Could not read saved data." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [challenge, draftScope, designParam, router, basePath]);

  useEffect(() => boot(), [boot]);

  const saveDraft = useCallback(
    (doc: DesignDoc) => {
      getRepo()
        .setDraft(draftScope, doc)
        .catch((e: unknown) => {
          if (!draftWarned.current) {
            draftWarned.current = true;
            toast.error(e instanceof Error ? e.message : "Autosave failed.");
          }
        });
    },
    [draftScope],
  );

  const onRun = useCallback(
    async (result: SimResult, doc: DesignDoc) => {
      const s = scoreChallenge(challenge, result, doc.graph);
      // The reference design, run unchanged, is a worked example: score it, but don't record it or award XP.
      if (challenge.reference && sameGraph(doc.graph, challenge.reference.graph)) {
        toast.info("That's the reference design, unchanged. Change something to make it yours and earn XP.");
        return;
      }
      try {
        const { progress, xpGained } = await getRepo().recordAttempt(challenge.id, s.total, s.passed);
        const rec = progress.challenges[challenge.id];
        const firstPass = s.passed && rec.firstPassedAt === rec.lastAttemptAt;
        setRecord(rec);
        if (firstPass) {
          toast.success(`${isBuild ? "Design accepted" : "Challenge passed"}! Score ${s.total}. +${xpGained} XP`);
          setExplanationOpen(true);
        } else if (xpGained > 0) toast.success(`New best: ${s.total}. +${xpGained} XP`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not record your attempt.");
      }
    },
    [challenge, isBuild],
  );

  const pendingObjectives = useMemo(() => {
    // An "empty" result just to list objectives in their unchecked state.
    const r = simulate({ nodes: [], edges: [] }, challenge.traffic);
    return scoreChallenge(challenge, r, { nodes: [], edges: [] }).objectives;
  }, [challenge]);

  const brief = (
    <div className="space-y-5">
      <section className="space-y-2">
        {challenge.scenario.map((p) => (
          <p key={p} className="text-sm leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </section>
      {challenge.requirements && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Must do</h3>
            <ul className="list-disc space-y-1 pl-4 text-[12.5px]">
              {challenge.requirements.functional.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Must be</h3>
            <ul className="list-disc space-y-1 pl-4 text-[12.5px]">
              {challenge.requirements.nonFunctional.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {challenge.estimates && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Back-of-envelope</h3>
          <ul className="space-y-1 rounded-lg border border-border bg-secondary/30 p-2.5 font-mono text-[11.5px] leading-relaxed">
            {challenge.estimates.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Traffic (fixed)</h3>
        <p className="font-mono text-[12px]">
          {challenge.traffic.rps.toLocaleString()} rps · {Math.round(challenge.traffic.readRatio * 100)}% reads · {Math.round(challenge.traffic.hotKeyFraction * 100)}% hot keys
          {challenge.traffic.staticFraction > 0 && ` · ${Math.round(challenge.traffic.staticFraction * 100)}% static`}
          {(challenge.traffic.contendedWriteFraction ?? 0) > 0 &&
            ` · ${Math.round(challenge.traffic.contendedWriteFraction! * 100)}% of writes contended`}
          {(challenge.traffic.aiFraction ?? 0) > 0 && ` · ${Math.round(challenge.traffic.aiFraction! * 100)}% call an AI model`}
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Objectives</h3>
        <ObjectiveList results={pendingObjectives} pending />
      </section>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hints</h3>
        {hintsShown === 0 && <p className="text-[12px] text-muted-foreground">Stuck? Hints get more specific as you reveal them.</p>}
        <ol className="space-y-2">
          {challenge.hints.slice(0, hintsShown).map((h, i) => (
            <li key={h} className="flex gap-2 rounded-lg border border-status-warn/25 bg-status-warn/5 p-2.5 text-[12px] leading-relaxed">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-status-warn" aria-hidden="true" />
              <span>
                <span className="font-medium">Hint {i + 1}: </span>
                {h}
              </span>
            </li>
          ))}
        </ol>
        {hintsShown < challenge.hints.length && (
          <Button variant="outline" size="sm" onClick={() => setHintsShown((n) => n + 1)}>
            <Lightbulb /> Reveal hint {hintsShown + 1} of {challenge.hints.length}
          </Button>
        )}
      </section>
      {!isBuild && <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allowed components</h3>
        <p className="text-[12px] text-muted-foreground">Only these appear in the palette for this challenge.</p>
        <ul className="flex flex-wrap gap-1.5">
          {challenge.allowedComponents.map((k) => (
            <li key={k}>
              <Badge variant="secondary">{CATALOG[k].label}</Badge>
            </li>
          ))}
        </ul>
      </section>}
      {isBuild && challenge.reference && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference architecture</h3>
          <p className="text-[12px] text-muted-foreground">
            Really stuck? Use <span className="font-medium text-foreground">Reference</span> in the canvas toolbar to load a design that meets every objective, then
            study or improve it.
          </p>
        </section>
      )}
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      {challenge.explanation.map((p) => (
        <p key={p} className="text-sm leading-relaxed text-muted-foreground">
          {p}
        </p>
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col lg:h-dvh">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 md:px-6">
        <Link href={basePath} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={isBuild ? "Back to build problems" : "Back to challenges"}>
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight">{challenge.title}</h1>
            {challenge.category && <Badge variant="secondary">{challenge.category}</Badge>}
            <Badge variant="outline">{challenge.difficulty}</Badge>
            {record?.passed && <Badge className="bg-status-ok/15 text-status-ok">Passed</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {record ? `Best score ${record.bestScore} · ${record.attempts} attempt${record.attempts === 1 ? "" : "s"}` : challenge.summary}
          </p>
        </div>
        <Sheet open={briefOpen} onOpenChange={setBriefOpen}>
          <SheetTrigger render={<Button variant="outline" size="sm" />}>
            <ScrollText /> {isBuild ? "Requirements & hints" : "Brief & hints"}
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{challenge.title}</SheetTitle>
              <SheetDescription>{challenge.summary}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">{brief}</div>
          </SheetContent>
        </Sheet>
        <Sheet open={explanationOpen} onOpenChange={setExplanationOpen}>
          <SheetTrigger render={<Button variant="outline" size="sm" />}>
            <BookOpen /> {record?.passed ? "Explanation" : "Reveal explanation"}
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>How to think about it</SheetTitle>
              <SheetDescription>
                {record?.passed ? "You passed. Here is the reasoning behind a strong solution." : "Spoiler: this describes a working solution. You can still earn full XP afterwards."}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">{explanation}</div>
          </SheetContent>
        </Sheet>
      </div>

      {state.phase === "loading" && (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Loading {noun}…
        </div>
      )}
      {state.phase === "error" && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-center">
            <p className="text-sm font-medium">Couldn&apos;t load your progress</p>
            <p className="text-xs text-muted-foreground">{state.message}</p>
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
          </div>
        </div>
      )}
      {state.phase === "ready" && (
        <Designer
          key={state.key}
          initial={state.doc}
          allowedKinds={challenge.allowedComponents}
          trafficLocked
          onDocChange={saveDraft}
          onRun={(r, d) => void onRun(r, d)}
          resultsExtra={({ getDoc, result, stale }) =>
            result ? (
              <ScoreCard score={scoreChallenge(challenge, result, getDoc().graph)} stale={stale} />
            ) : (
              <section className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
                <h3 className="text-xs font-semibold">Objectives</h3>
                <ObjectiveList results={pendingObjectives} pending />
              </section>
            )
          }
          actions={({ getDoc, loadDoc }) => (
            <>
              <SaveDesignButton
                getDoc={getDoc}
                current={current}
                challengeId={challenge.id}
                defaultName={`${challenge.title} ${isBuild ? "design" : "attempt"}`}
                onSaved={(d) => setCurrent({ id: d.id, name: d.name })}
              />
              <LoadDesignButton
                filter={(d) => d.challengeId === challenge.id}
                onLoad={(d) => {
                  loadDoc({ ...d, traffic: { ...challenge.traffic } });
                  setCurrent({ id: d.id, name: d.name });
                }}
              />
              {challenge.reference && (
                <ResetButton
                  title="Load the reference architecture?"
                  description="Replaces the canvas with a design that meets every objective. Undo brings yours back, and you can still earn full XP by improving it."
                  trigger={
                    <>
                      <BookOpen /> Reference
                    </>
                  }
                  options={[
                    {
                      label: "Load reference",
                      onSelect: () => {
                        loadDoc({ ...structuredClone(challenge.reference!), traffic: { ...challenge.traffic } });
                        setCurrent(null);
                      },
                    },
                  ]}
                />
              )}
              <ResetButton
                title={isBuild ? "Start over?" : "Reset challenge?"}
                description={isBuild ? "Clears the canvas back to just your users. Your best score and saved designs are kept." : "Restores the starting design. Your best score and saved designs are kept."}
                options={[
                  {
                    label: "Reset to start",
                    destructive: true,
                    onSelect: () => {
                      loadDoc(startingDoc(challenge));
                      setCurrent(null);
                    },
                  },
                ]}
              />
            </>
          )}
        />
      )}
    </div>
  );
}
