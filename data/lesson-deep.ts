/** In-depth lesson content: how it works, a worked example, trade-offs, mistakes and interview tips. */
export interface LessonDeep {
  /** "Under the hood" sections. */
  sections: { heading: string; body: string[] }[];
  example: { title: string; steps: string[] };
  tradeoffs: { option: string; pros: string; cons: string }[];
  mistakes: string[];
  /** What interviewers listen for. */
  interview: string[];
}

import { DEEP_1 } from "./lesson-deep-1";
import { DEEP_2 } from "./lesson-deep-2";

export const LESSON_DEEP: Record<string, LessonDeep> = { ...DEEP_1, ...DEEP_2 };

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Reading time for the whole lesson: technical text at ~150 words a minute, plus a minute for the diagram. */
export function readingMinutes(lesson: { id: string; summary: string; points: string[]; ruleOfThumb: string }): number {
  const d = LESSON_DEEP[lesson.id];
  const parts = [lesson.summary, lesson.ruleOfThumb, ...lesson.points];
  if (d) {
    parts.push(...d.sections.flatMap((s) => [s.heading, ...s.body]), d.example.title, ...d.example.steps, ...d.mistakes, ...d.interview);
    parts.push(...d.tradeoffs.flatMap((t) => [t.option, t.pros, t.cons]));
  }
  return Math.max(3, Math.round(parts.reduce((n, p) => n + words(p), 0) / 150) + 1);
}
