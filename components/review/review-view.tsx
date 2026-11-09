"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Layers, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { FLASHCARDS } from "@/data/flashcards";
import { LESSONS } from "@/data/lessons";
import { BOX_DAYS, dueCards, getRepo, localDay, type CardState, type Rating } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/progress/bits";

const BY_ID = new Map(FLASHCARDS.map((c) => [c.id, c]));
const LESSON = new Map(LESSONS.map((l) => [l.id, l]));
const RATINGS: Array<{ id: Rating; label: string; hint: string; cls: string; key: string }> = [
  { id: "again", label: "Again", hint: "today", cls: "border-status-crit/40 text-status-crit hover:bg-status-crit/10", key: "1" },
  { id: "hard", label: "Hard", hint: "soon", cls: "border-status-warn/40 text-status-warn hover:bg-status-warn/10", key: "2" },
  { id: "good", label: "Good", hint: "later", cls: "border-status-ok/40 text-status-ok hover:bg-status-ok/10", key: "3" },
  { id: "easy", label: "Easy", hint: "much later", cls: "border-brand-blue/40 text-brand-blue hover:bg-brand-blue/10", key: "4" },
];

export function ReviewView() {
  const [cards, setCards] = useState<CardState | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const today = localDay(new Date());

  useEffect(() => {
    getRepo()
      .getCards()
      .then((c) => {
        setCards(c);
        const { due, fresh } = dueCards(
          FLASHCARDS.map((x) => x.id),
          c,
          today,
        );
        setQueue([...due, ...fresh]);
      })
      .catch(() => setCards({}));
  }, [today]);

  const current = queue[0] ? BY_ID.get(queue[0]) : undefined;

  const rate = async (rating: Rating) => {
    if (!current) return;
    try {
      const next = await getRepo().reviewCard(current.id, rating);
      setCards(next);
      setDone((n) => n + 1);
      // "Again" puts the card back at the end of today's queue.
      setQueue((q) => (rating === "again" ? [...q.slice(1), q[0]] : q.slice(1)));
      setFlipped(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your review.");
    }
  };

  // Keyboard: space flips, 1–4 rate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName))) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped) {
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) void rate(r.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stats = useMemo(() => {
    if (!cards) return null;
    const seen = Object.keys(cards).length;
    const mastered = Object.values(cards).filter((c) => c.box >= 4).length;
    return { seen, mastered, total: FLASHCARDS.length };
  }, [cards]);

  if (!cards || !stats) return <LoadingBlock label="Loading your cards…" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <section className="space-y-4">
        <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span>
            {queue.length > 0 ? `${queue.length} left today` : "All caught up"} · {done} reviewed this session
          </span>
          <span className="font-mono">space flips · 1–4 rate</span>
        </div>

        {current ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? "Hide answer" : "Show answer"}
              className="surface flex min-h-72 w-full flex-col justify-between gap-6 rounded-3xl p-8 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-blue">{LESSON.get(current.lesson)?.title ?? "Card"}</p>
              <div className="space-y-5">
                <p className="text-2xl font-semibold leading-snug tracking-tight">{current.front}</p>
                {flipped ? (
                  <p className="border-t border-border pt-5 text-[16px] leading-relaxed text-foreground/90">{current.back}</p>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Think of the answer, then click or press space to check.</p>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground">{cards[current.id] ? `Box ${cards[current.id].box} · reviewed ${cards[current.id].reviews}×` : "New card"}</p>
            </button>
            {flipped ? (
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void rate(r.id)}
                    className={cn("rounded-xl border bg-white/[0.02] px-3 py-2.5 text-center transition-colors", r.cls)}
                  >
                    <span className="block text-[14px] font-semibold">{r.label}</span>
                    <span className="block font-mono text-[10.5px] opacity-70">
                      {r.key} · {r.hint}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={() => setFlipped(true)}>
                Show answer
              </Button>
            )}
            <Link href={`/learn/${current.lesson}`} className="flex items-center gap-1.5 text-[12.5px] text-brand-blue hover:underline">
              <BookOpen className="size-3.5" /> Read the lesson
            </Link>
          </div>
        ) : (
          <div className="surface flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center">
            <CheckCircle2 className="size-8 text-status-ok" aria-hidden="true" />
            <p className="text-lg font-semibold">You&apos;re done for today</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">Cards come back right before you&apos;d forget them. Come back tomorrow, or practise a problem in the meantime.</p>
            <div className="flex gap-2">
              <Link href="/challenges" className="text-[13px] font-medium text-brand-blue hover:underline">
                Practise a problem
              </Link>
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-3">
        <div className="surface space-y-3 rounded-2xl p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <Layers className="size-4 text-brand-blue" aria-hidden="true" /> Your deck
          </p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Seen", stats.seen],
              ["Mastered", stats.mastered],
              ["Total", stats.total],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-border py-2">
                <dd className="font-mono text-[18px] font-semibold">{v}</dd>
                <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{l}</dt>
              </div>
            ))}
          </dl>
          <div className="space-y-1">
            {BOX_DAYS.map((d, b) => {
              const n = Object.values(cards).filter((c) => c.box === b).length;
              return (
                <div key={b} className="grid grid-cols-[4.5rem_1fr_1.5rem] items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span>{b === 0 ? "learning" : `every ${d}d`}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-brand-blue" style={{ width: `${(n / stats.total) * 100}%` }} />
                  </span>
                  <span className="text-right">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="flex gap-2 rounded-2xl border border-dashed border-border p-4 text-[12px] leading-relaxed text-muted-foreground">
          <RotateCcw className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Spaced repetition: a card you know comes back after 1, 3, 7, 16 then 35 days. Miss it and it returns today. Up to 10 new cards a day.
        </p>
      </aside>
    </div>
  );
}
