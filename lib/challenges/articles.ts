import { LESSONS, type Lesson } from "@/data/lessons";
import { ROADMAP } from "@/data/roadmap";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import type { Challenge } from "@/lib/challenges/types";

/** Learn lessons worth reading for a problem: the one written for it first, then its roadmap stage's lessons. */
export function relatedLessons(problemId: string): Lesson[] {
  const direct = LESSONS.filter((l) => l.practice === problemId);
  const stage = ROADMAP.find((s) => s.problems.includes(problemId));
  const sameStage = stage ? LESSONS.filter((l) => l.stage === stage.id && !direct.includes(l)) : [];
  return [...direct, ...sameStage].slice(0, 6);
}

/** Problems that put a lesson to work: its own practice problem first, then every problem that lists it as an article. */
export function relatedProblems(lessonId: string, limit = 6): Challenge[] {
  const all = [...CHALLENGES, ...DESIGNS];
  const practice = LESSONS.find((l) => l.id === lessonId)?.practice;
  const first = all.filter((p) => p.id === practice);
  const rest = all.filter((p) => p.id !== practice && relatedLessons(p.id).some((l) => l.id === lessonId));
  return [...first, ...rest].slice(0, limit);
}
