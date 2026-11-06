import type { NodeKind, TrafficProfile } from "@/lib/sim";
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
  | "unsafeWriteRps";

export type ObjectiveOp = "<=" | ">=" | "==";

export interface Objective {
  id: string;
  label: string;
  metric: ObjectiveMetric;
  op: ObjectiveOp;
  value: number;
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
}
