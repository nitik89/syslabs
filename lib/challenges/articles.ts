import { LESSONS, type Lesson } from "@/data/lessons";
import { ROADMAP } from "@/data/roadmap";

/** Learn lessons worth reading for a problem: the one written for it first, then its roadmap stage's lessons. */
export function relatedLessons(problemId: string): Lesson[] {
  const direct = LESSONS.filter((l) => l.practice === problemId);
  const stage = ROADMAP.find((s) => s.problems.includes(problemId));
  const sameStage = stage ? LESSONS.filter((l) => l.stage === stage.id && !direct.includes(l)) : [];
  return [...direct, ...sameStage].slice(0, 6);
}
