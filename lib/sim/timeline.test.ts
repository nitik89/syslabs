import { describe, expect, it } from "vitest";
import { LAB_STARTER } from "@/data/lab-starter";
import { latencyPercentiles, loadFactor, simulate, simulateTimeline, TIMEOUT_MS } from "./index";

describe("timeline", () => {
  it("ramps up, never exceeds peak, and ends exactly at peak", () => {
    expect(loadFactor(0, 60)).toBeLessThan(0.5);
    for (let t = 0; t < 60; t++) expect(loadFactor(t, 60)).toBeLessThanOrEqual(1);
    expect(loadFactor(59, 60)).toBe(1);
  });

  it("is deterministic and its last tick equals the steady-state run", () => {
    const { graph, traffic } = LAB_STARTER;
    const a = simulateTimeline(graph, traffic);
    const b = simulateTimeline(graph, traffic);
    expect(a.ticks.map((t) => t.p99)).toEqual(b.ticks.map((t) => t.p99));
    expect(a.ticks).toHaveLength(60);
    expect(a.ticks[59].result.servedRps).toBeCloseTo(simulate(graph, traffic).servedRps, 6);
  });

  it("orders percentiles and lets drops dominate the tail", () => {
    const calm = latencyPercentiles(40, 0.4, 0);
    expect(calm.p50).toBeLessThan(calm.p95);
    expect(calm.p95).toBeLessThan(calm.p99);
    expect(latencyPercentiles(40, 0.95, 0).p99).toBeGreaterThan(calm.p99);
    expect(latencyPercentiles(40, 1.1, 0.2).p99).toBe(TIMEOUT_MS);
  });

  it("logs overload when a design can't keep up", () => {
    const { graph, traffic } = LAB_STARTER;
    const tl = simulateTimeline(graph, { ...traffic, rps: 20000 });
    expect(tl.events.some((e) => e.level === "error")).toBe(true);
    expect(tl.busiest.length).toBeGreaterThan(0);
  });
});
