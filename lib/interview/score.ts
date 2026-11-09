import type { Challenge, Objective } from "@/lib/challenges/types";
import { scoreChallenge } from "@/lib/challenges/score";
import { lockGraph, simulate, type SimGraph, type TrafficProfile } from "@/lib/sim";
import type { Twist } from "@/data/interviews";

export interface InterviewAnswers {
  functional: string[];
  nonFunctional: string[];
  /** Estimated peak requests per second. */
  peakRps: number | null;
  /** Estimated share of reads, 0–100. */
  readPct: number | null;
}

export interface Part {
  id: "requirements" | "estimation" | "design" | "twist" | "time";
  label: string;
  weight: number;
  score: number;
  notes: string[];
}

export interface Scorecard {
  total: number;
  level: "E6" | "E5" | "E4" | "Not yet";
  parts: Part[];
}

const pct = (x: number) => Math.round(Math.max(0, Math.min(100, x)));

/** Coverage, not wording: at least 3 features, and at least 3 non-functional requirements that carry a number. */
export function scoreRequirements(a: InterviewAnswers): Part {
  const fr = a.functional.filter((x) => x.trim()).length;
  const measurable = a.nonFunctional.filter((x) => /\d/.test(x)).length;
  const notes = [
    fr >= 3 ? `${fr} functional requirements.` : `Only ${fr} functional requirement${fr === 1 ? "" : "s"}: aim for at least 3 core features.`,
    measurable >= 3
      ? `${measurable} measurable non-functional requirements.`
      : `Only ${measurable} measurable non-functional requirement${measurable === 1 ? "" : "s"}: put numbers on scale, latency, availability and cost.`,
  ];
  return { id: "requirements", label: "Requirements", weight: 0.15, score: pct(Math.min(1, fr / 3) * 50 + Math.min(1, measurable / 3) * 50), notes };
}

/** Peak load within 25% scores full marks (within 2× partial); read share within 10 points full (20 partial). */
export function scoreEstimation(a: InterviewAnswers, t: TrafficProfile): Part {
  const notes: string[] = [];
  let s = 0;
  if (a.peakRps && a.peakRps > 0) {
    const off = Math.abs(Math.log2(a.peakRps / t.rps));
    const pts = off <= Math.log2(1.25) ? 50 : off <= 1 ? 30 : off <= 2 ? 10 : 0;
    s += pts;
    notes.push(`Peak load: you said ${Math.round(a.peakRps).toLocaleString("en-US")} req/s; the brief implies ${t.rps.toLocaleString("en-US")} (${pts}/50).`);
  } else notes.push("No peak-load estimate (0/50).");
  if (a.readPct !== null && a.readPct >= 0) {
    const diff = Math.abs(a.readPct - t.readRatio * 100);
    const pts = diff <= 10 ? 50 : diff <= 20 ? 25 : 0;
    s += pts;
    notes.push(`Read share: you said ${Math.round(a.readPct)}%; actual ${Math.round(t.readRatio * 100)}% (${pts}/50).`);
  } else notes.push("No read/write estimate (0/50).");
  return { id: "estimation", label: "Estimation", weight: 0.15, score: pct(s), notes };
}

/** The scenario a twist creates: new traffic and/or changed objectives. */
export function twistScenario(problem: Challenge, twist: Twist): { traffic: TrafficProfile; objectives: Objective[] } {
  const f = twist.factor ?? 1;
  const traffic = twist.kind === "traffic" ? { ...problem.traffic, rps: Math.round(problem.traffic.rps * f) } : problem.traffic;
  let objectives = problem.objectives.filter((o) => o.metric !== "componentLoad");
  if (twist.kind === "budget") {
    objectives = objectives.map((o) =>
      o.metric === "monthlyCost" ? { ...o, value: Math.round(o.value * f), label: `Monthly cost at or below $${Math.round(o.value * f).toLocaleString("en-US")}` } : o,
    );
  }
  if (twist.kind === "failure" && !objectives.some((o) => o.metric === "spofCount")) {
    objectives = [...objectives, { id: "spof", label: "No single points of failure", metric: "spofCount", op: "==", value: 0 }];
  }
  return { traffic, objectives };
}

export function scoreDesignAndTwist(problem: Challenge, twist: Twist, graph: SimGraph): { design: Part; twist: Part } {
  // Scored with catalog capacity, latency and cost, whatever the design carries.
  graph = lockGraph(graph);
  const base = scoreChallenge(problem, simulate(graph, problem.traffic), graph);
  const design: Part = {
    id: "design",
    label: "Design",
    weight: 0.4,
    // A design that misses an objective can't score full marks, however well it does on the rest.
    score: pct(base.total * (base.passed ? 1 : 0.85)),
    notes: base.passed ? [`Every objective met (score ${base.total}).`] : base.objectives.filter((o) => !o.met).map((o) => `Missed: ${o.objective.label}`).slice(0, 4),
  };
  const sc = twistScenario(problem, twist);
  const twisted = { ...problem, traffic: sc.traffic, objectives: sc.objectives };
  const tr = scoreChallenge(twisted, simulate(graph, sc.traffic), graph);
  const met = tr.objectives.filter((o) => o.met).length;
  const missed = tr.objectives.filter((o) => !o.met).map((o) => `After the twist, missed: ${o.objective.label}`);
  return {
    design,
    twist: {
      id: "twist",
      label: `Twist: ${twist.title}`,
      weight: 0.2,
      // Scaled by the design's own quality: an empty or broken design trivially "meets" cost and SPOF checks.
      score: pct((met / Math.max(1, tr.objectives.length)) * 100 * Math.min(1, base.total / 75)),
      notes: missed.length ? missed.slice(0, 4) : ["Handled the twist: every objective still met."],
    },
  };
}

/** Full marks within the time limit, then 10 points off per extra minute. */
export function scoreTime(elapsedMs: number, limitMin: number): Part {
  const min = elapsedMs / 60000;
  const score = min <= limitMin ? 100 : pct(100 - (min - limitMin) * 10);
  return { id: "time", label: "Time", weight: 0.1, score, notes: [`Finished in ${Math.floor(min)}m ${String(Math.round((min % 1) * 60)).padStart(2, "0")}s of ${limitMin}m.`] };
}

export function levelFor(total: number): Scorecard["level"] {
  return total >= 85 ? "E6" : total >= 70 ? "E5" : total >= 55 ? "E4" : "Not yet";
}

export function buildScorecard(parts: Part[]): Scorecard {
  const total = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0));
  return { total, level: levelFor(total), parts };
}
