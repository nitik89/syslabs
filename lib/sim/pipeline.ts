import { CATALOG } from "./catalog";
import type { BaseKind, SimGraph, SimNode } from "./types";

/** Components that run deployed code. */
const DEPLOY_TARGETS: ReadonlySet<BaseKind> = new Set(["appServer", "serverless", "worker", "llm"]);
const STAGES: ReadonlySet<BaseKind> = new Set(["ciPipeline", "containerRegistry", "fineTune"]);

export interface PipelineReport {
  /** True when the design has any delivery component (repo, CI or registry). */
  present: boolean;
  /** Human-readable paths from a repo to the servers it deploys, e.g. "GitHub → Docker Build → AWS ECR → App Server". */
  chains: string[];
  /** Gaps in the pipeline, in plain language. */
  problems: string[];
  /** Ids of compute nodes that some pipeline deploys to. */
  deployed: string[];
}

/**
 * Trace the delivery pipeline: code repo → CI (build/test) → registry → compute.
 * Purely structural and deterministic; it doesn't affect traffic, latency or challenge scores.
 */
export function analyzePipeline(graph: SimGraph, behaviorOf: (n: SimNode) => BaseKind): PipelineReport {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const kids = new Map<string, string[]>();
  for (const n of graph.nodes) kids.set(n.id, []);
  for (const e of graph.edges) if (byId.has(e.source) && byId.has(e.target)) kids.get(e.source)!.push(e.target);

  const b = (id: string) => behaviorOf(byId.get(id)!);
  const name = (id: string) => {
    const n = byId.get(id)!;
    return n.label?.trim() || CATALOG[n.kind].label;
  };
  const ofBehavior = (k: BaseKind) => graph.nodes.filter((n) => behaviorOf(n) === k);

  const repos = ofBehavior("codeRepo");
  const cis = ofBehavior("ciPipeline");
  const registries = ofBehavior("containerRegistry");
  const tunes = ofBehavior("fineTune");
  const present = repos.length + cis.length + registries.length + tunes.length > 0;
  if (!present) return { present, chains: [], problems: [], deployed: [] };

  const chains: string[] = [];
  const problems: string[] = [];
  const deployed = new Set<string>();

  // Walk forward from each repo through pipeline stages (CI → CI → registry) to deploy targets.
  const walk = (id: string, path: string[], seen: Set<string>) => {
    const next = kids.get(id)!.filter((k) => !seen.has(k));
    const targets = next.filter((k) => DEPLOY_TARGETS.has(b(k)));
    const stages = next.filter((k) => STAGES.has(b(k)));
    if (targets.length > 0) {
      targets.forEach((t) => deployed.add(t));
      chains.push(`${[...path, id].map(name).join(" → ")} → ${targets.map(name).join(", ")}`);
    }
    for (const s of stages) walk(s, [...path, id], new Set([...seen, s]));
  };
  for (const r of repos) walk(r.id, [], new Set([r.id]));
  // Model pipelines start at the fine-tuning job (its input is a dataset, not a repo).
  for (const t of tunes) if (!graph.edges.some((e) => e.target === t.id && STAGES.has(b(e.source)))) walk(t.id, [], new Set([t.id]));

  for (const r of repos) {
    if (!kids.get(r.id)!.some((k) => b(k) === "ciPipeline")) {
      problems.push(`${name(r.id)} isn't connected to a CI pipeline, so pushed code is never built or tested.`);
    }
  }
  if (repos.length === 0 && cis.length > 0) problems.push("No code repository: connect GitHub (or another repo) into your CI pipeline.");

  const fedByRepo = (id: string) => graph.edges.some((e) => e.target === id && b(e.source) === "codeRepo");
  const fedByCi = (id: string) => graph.edges.some((e) => e.target === id && b(e.source) === "ciPipeline");
  for (const c of cis) {
    if (!fedByRepo(c.id) && !fedByCi(c.id)) problems.push(`${name(c.id)} has no repo feeding it, so nothing triggers a build.`);
    if (kids.get(c.id)!.length === 0) problems.push(`${name(c.id)} builds, but the result goes nowhere. Connect a registry or the servers it deploys.`);
  }
  for (const t of tunes) {
    if (kids.get(t.id)!.length === 0) problems.push(`${name(t.id)} trains a model, but nothing serves it. Connect a model registry or an LLM server.`);
  }
  const fedByTune = (id: string) => graph.edges.some((e) => e.target === id && b(e.source) === "fineTune");
  for (const r of registries) {
    if (!fedByCi(r.id) && !fedByTune(r.id)) problems.push(`${name(r.id)} has no CI pushing images into it.`);
    if (!kids.get(r.id)!.some((k) => DEPLOY_TARGETS.has(b(k)))) {
      problems.push(`Nothing pulls from ${name(r.id)}. Connect it to the servers or model servers that run what it stores.`);
    }
  }

  // Hosted model APIs (OpenAI, Claude...) aren't yours to deploy; only flag servers you run.
  const manual = graph.nodes.filter((n) => DEPLOY_TARGETS.has(behaviorOf(n)) && behaviorOf(n) !== "llm" && !deployed.has(n.id));
  if (chains.length > 0 && manual.length > 0) {
    problems.push(`Deployed by hand: ${manual.map((n) => name(n.id)).join(", ")}. Connect the pipeline to ${manual.length > 1 ? "them" : "it"} too.`);
  }

  return { present, chains, problems, deployed: [...deployed] };
}
