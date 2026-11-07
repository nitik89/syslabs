import type { BaseKind, NodeKind, TrafficProfile } from "@/lib/sim";
import type { DesignDoc } from "@/lib/storage";

export type ObjectiveMetric =
  | "errorRate"
  | "avgLatencyMs"
  | "dbLoadRps"
  | "spofCount"
  | "monthlyCost"
  | "servedRps"
  | "cacheHitRatio"
  | "maxUtilization"
  | "backlogRps"
  | "unsafeWriteRps"
  | "componentLoad";

export type ObjectiveOp = "<=" | ">=" | "==";

export interface Objective {
  id: string;
  label: string;
  metric: ObjectiveMetric;
  op: ObjectiveOp;
  value: number;
  /** componentLoad only: total rps through components that behave like any of these (a requirement check). */
  kinds?: BaseKind[];
}

export type ScoreCategory = "performance" | "reliability" | "cost" | "architecture";

export interface ScoringConfig {
  weights: Record<ScoreCategory, number>;
  /** Average latency at or below this scores full performance-latency points. */
  latencyTargetMs: number;
  /** Monthly cost at or below this scores full cost points. */
  costBudget: number;
}

export interface Challenge {
  id: string;
  order: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  summary: string;
  scenario: string[];
  objectives: Objective[];
  startingDesign: Omit<DesignDoc, "traffic">;
  traffic: TrafficProfile;
  allowedComponents: NodeKind[];
  hints: [string, string, string];
  scoring: ScoringConfig;
  explanation: string[];
  /** "fix" (default): repair a broken design. "build": design a product from a blank canvas. */
  mode?: "fix" | "build";
  /** Build problems: product area, e.g. "E-commerce". */
  category?: string;
  /** Build problems: what the product must do, and how well. */
  requirements?: { functional: string[]; nonFunctional: string[] };
  /** Build problems: back-of-envelope numbers that lead to the traffic profile. */
  estimates?: string[];
  /** Build problems: a design that meets every objective, loadable onto the canvas. */
  reference?: Omit<DesignDoc, "traffic">;
}
