import { describe, expect, it } from "vitest";
import { INTERVIEWS } from "@/data/interviews";
import { getDesign } from "@/data/designs";
import { buildScorecard, levelFor, scoreDesignAndTwist, scoreEstimation, scoreRequirements, scoreTime, twistScenario } from "./score";

describe("mock interview scoring", () => {
  it("every interview points at a real build problem", () => {
    for (const i of INTERVIEWS) expect(getDesign(i.problem), i.id).toBeDefined();
  });

  it("rewards three features and three measurable non-functional requirements", () => {
    const good = scoreRequirements({ functional: ["a", "b", "c"], nonFunctional: ["10k rps", "p99 < 200 ms", "99.9% up"], peakRps: null, readPct: null });
    expect(good.score).toBe(100);
    const vague = scoreRequirements({ functional: ["a"], nonFunctional: ["fast", "scalable"], peakRps: null, readPct: null });
    expect(vague.score).toBeLessThan(30);
  });

  it("grades estimates by how close they are", () => {
    const t = { rps: 10000, readRatio: 0.9, hotKeyFraction: 0.5, staticFraction: 0 };
    expect(scoreEstimation({ functional: [], nonFunctional: [], peakRps: 11000, readPct: 85 }, t).score).toBe(100);
    expect(scoreEstimation({ functional: [], nonFunctional: [], peakRps: 100000, readPct: 40 }, t).score).toBe(0);
  });

  it("a reference design aces the design part, and twists actually change the test", () => {
    for (const i of INTERVIEWS) {
      const p = getDesign(i.problem)!;
      const { design } = scoreDesignAndTwist(p, i.twist, p.reference!.graph);
      expect(design.score, i.id).toBeGreaterThanOrEqual(75);
      const sc = twistScenario(p, i.twist);
      if (i.twist.kind === "traffic") expect(sc.traffic.rps).toBeGreaterThan(p.traffic.rps);
      if (i.twist.kind === "budget") expect(sc.objectives.find((o) => o.metric === "monthlyCost")!.value).toBeLessThan(p.objectives.find((o) => o.metric === "monthlyCost")!.value);
      if (i.twist.kind === "failure") expect(sc.objectives.some((o) => o.metric === "spofCount")).toBe(true);
    }
  });

  it("weights parts into a total and maps it to a level", () => {
    const card = buildScorecard([
      { id: "requirements", label: "", weight: 0.15, score: 100, notes: [] },
      { id: "estimation", label: "", weight: 0.15, score: 100, notes: [] },
      { id: "design", label: "", weight: 0.4, score: 90, notes: [] },
      { id: "twist", label: "", weight: 0.2, score: 50, notes: [] },
      scoreTime(30 * 60000, 45),
    ]);
    expect(card.total).toBe(Math.round(15 + 15 + 36 + 10 + 10));
    expect(card.level).toBe("E6");
    expect(levelFor(60)).toBe("E4");
    expect(scoreTime(50 * 60000, 45).score).toBe(50);
  });
});

describe("twist fairness", () => {
  it("an empty canvas earns almost nothing for the twist", () => {
    const iv = INTERVIEWS[0];
    const p = getDesign(iv.problem)!;
    const { twist } = scoreDesignAndTwist(p, iv.twist, p.startingDesign.graph);
    expect(twist.score).toBeLessThan(15);
  });
});
