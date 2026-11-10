/**
 * Authoritative grading: re-runs a submitted design on the server, exactly as the client does on Submit,
 * with the catalog's capacity, latency and cost forced on every component. The result is what counts for
 * XP and the leaderboard; nothing the browser claims about its own score is trusted.
 */
import { getChallenge } from "@/data/challenges";
import { getDesign } from "@/data/designs";
import { scoreChallenge } from "@/lib/challenges/score";
import { runHiddenTests } from "@/lib/challenges/hidden";
import { NODE_KINDS, lockGraph, simulate, type SimGraph } from "@/lib/sim";
import { xpFor } from "@/lib/storage/repo";

/** Same components (kind + config) and same connections, ignoring order, labels and positions. */
export function sameGraph(a: SimGraph, b: SimGraph): boolean {
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

export const MAX_NODES = 80;
export const MAX_EDGES = 200;

export type GradeResult =
  | { ok: true; problemId: string; score: number; passed: boolean; xp: number; hiddenPassed: number; hiddenTotal: number; reference: boolean }
  | { ok: false; status: 400 | 404; error: string };

const KINDS = new Set<string>(NODE_KINDS);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Checks an untrusted graph's shape and size; returns a clean copy or an error message. */
export function parseGraph(input: unknown): SimGraph | string {
  if (!isObj(input) || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) return "graph must have nodes and edges";
  if (input.nodes.length === 0) return "graph has no components";
  if (input.nodes.length > MAX_NODES || input.edges.length > MAX_EDGES) return "graph is too large";
  const ids = new Set<string>();
  const nodes: SimGraph["nodes"] = [];
  for (const n of input.nodes) {
    if (!isObj(n) || typeof n.id !== "string" || n.id.length > 100 || typeof n.kind !== "string" || !KINDS.has(n.kind) || !isObj(n.config)) return "invalid component";
    const c = n.config;
    if (!isNum(c.capacity) || !isNum(c.latencyMs) || !isNum(c.replicas) || !isNum(c.costPerReplica)) return "invalid component config";
    if (ids.has(n.id)) return "duplicate component id";
    ids.add(n.id);
    nodes.push({ id: n.id, kind: n.kind as SimGraph["nodes"][number]["kind"], config: { ...(c as unknown as SimGraph["nodes"][number]["config"]) } });
  }
  const edges: SimGraph["edges"] = [];
  for (const e of input.edges) {
    if (!isObj(e) || typeof e.id !== "string" || typeof e.source !== "string" || typeof e.target !== "string") return "invalid connection";
    if (!ids.has(e.source) || !ids.has(e.target)) return "connection to an unknown component";
    edges.push({ id: e.id, source: e.source, target: e.target });
  }
  return { nodes, edges };
}

/** Grade a submission for a challenge or build problem. Pure: no I/O. */
export function grade(problemId: unknown, graphInput: unknown): GradeResult {
  if (typeof problemId !== "string") return { ok: false, status: 400, error: "problemId is required" };
  const problem = getChallenge(problemId) ?? getDesign(problemId);
  if (!problem) return { ok: false, status: 404, error: "unknown problem" };
  const parsed = parseGraph(graphInput);
  if (typeof parsed === "string") return { ok: false, status: 400, error: parsed };
  const graph = lockGraph(parsed);
  const result = simulate(graph, problem.traffic);
  const s = scoreChallenge(problem, result, graph);
  const hidden = runHiddenTests(graph, problem.traffic);
  const passed = s.passed && hidden.every((h) => h.passed);
  // The revealed reference, unchanged, is a worked example: graded, but worth nothing.
  const reference = Boolean(problem.reference && sameGraph(graph, lockGraph(problem.reference.graph)));
  return {
    ok: true,
    problemId: problem.id,
    score: Math.round(s.total),
    passed,
    xp: reference ? 0 : xpFor(s.total, passed),
    hiddenPassed: hidden.filter((h) => h.passed).length,
    hiddenTotal: hidden.length,
    reference,
  };
}
