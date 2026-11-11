import type { BaseKind } from "./types";

/**
 * Which building blocks each building block may send traffic to. Mirrors how the simulator routes
 * (see routeFor in engine.ts), so a connection the canvas allows always means something in the run.
 */
const FRONT_DOORS: BaseKind[] = ["loadBalancer", "apiGateway", "rateLimiter", "appGateway", "websocketGateway"];
const SERVICES: BaseKind[] = ["appServer", "serverless"];
const DATABASES: BaseKind[] = ["sqlDb", "nosqlDb", "timeseriesDb"];
const STORES: BaseKind[] = [...DATABASES, "objectStorage", "search"];
const COORDINATION: BaseKind[] = ["redisLock", "zookeeper"];

const ALLOWED: Record<BaseKind, readonly BaseKind[]> = {
  client: ["dns", "cdn", ...FRONT_DOORS, ...SERVICES, "objectStorage"],
  dns: ["cdn", ...FRONT_DOORS, ...SERVICES, "objectStorage"],
  cdn: [...FRONT_DOORS, ...SERVICES, "objectStorage"],
  loadBalancer: [...FRONT_DOORS, ...SERVICES, "cdn", "objectStorage", "monitoring"],
  apiGateway: [...FRONT_DOORS, ...SERVICES, "cdn", "objectStorage", "queue", "monitoring"],
  rateLimiter: [...FRONT_DOORS, ...SERVICES, "cdn", "objectStorage", "cache", "monitoring"],
  appGateway: [...FRONT_DOORS, ...SERVICES, "cdn", "objectStorage", "monitoring"],
  websocketGateway: ["loadBalancer", ...SERVICES, "queue", "cache", "monitoring"],
  appServer: [...FRONT_DOORS, ...SERVICES, "cdn", "cache", ...STORES, "queue", "llm", ...COORDINATION, "monitoring"],
  serverless: [...FRONT_DOORS, ...SERVICES, "cdn", "cache", ...STORES, "queue", "llm", ...COORDINATION, "monitoring"],
  worker: [...SERVICES, "cache", ...STORES, "queue", "llm", ...COORDINATION, "monitoring"],
  cache: [...STORES, "monitoring"],
  queue: ["worker", "serverless", "appServer", "queue", "monitoring"],
  sqlDb: ["monitoring"],
  nosqlDb: ["monitoring"],
  timeseriesDb: ["monitoring"],
  objectStorage: ["monitoring"],
  search: ["monitoring"],
  redisLock: ["monitoring"],
  zookeeper: ["monitoring"],
  llm: [],
  monitoring: [],
  codeRepo: ["ciPipeline"],
  ciPipeline: ["containerRegistry", ...SERVICES, "worker"],
  containerRegistry: [...SERVICES, "worker"],
  fineTune: ["llm"],
};

const NAMES: Record<BaseKind, string> = {
  client: "A client",
  dns: "DNS",
  cdn: "A CDN",
  loadBalancer: "A load balancer",
  apiGateway: "An API gateway",
  rateLimiter: "A rate limiter",
  appGateway: "An app gateway",
  websocketGateway: "A WebSocket gateway",
  appServer: "An app server",
  serverless: "A serverless function",
  worker: "A worker",
  cache: "A cache",
  queue: "A queue",
  sqlDb: "A SQL database",
  nosqlDb: "A NoSQL database",
  timeseriesDb: "A time-series database",
  objectStorage: "Object storage",
  search: "A search index",
  redisLock: "A lock service",
  zookeeper: "ZooKeeper",
  llm: "An AI model",
  monitoring: "Monitoring",
  codeRepo: "A code repository",
  ciPipeline: "A CI pipeline",
  containerRegistry: "A container registry",
  fineTune: "A fine-tuning job",
};

/** Plain-language advice for the commonest wrong connections. */
function hint(source: BaseKind, target: BaseKind): string {
  if (source === "queue")
    return "A queue only holds messages; something has to consume them. Connect the queue to a consumer (a Worker, serverless function or app server), and the consumer to the database.";
  if (source === "client" && (DATABASES.includes(target) || target === "cache" || target === "search"))
    return "Users never talk to a database directly. Put an app server (behind a load balancer) in between.";
  if (FRONT_DOORS.includes(source) && (DATABASES.includes(target) || target === "search"))
    return "Load balancers and gateways forward requests to services. Connect it to an app server, and the app server to the data store.";
  if (source === "cache")
    return "A cache sits in front of a data store: connect your app server to the cache, and the cache to the database it speeds up.";
  if (STORES.includes(source) || COORDINATION.includes(source))
    return "Data stores answer requests; they don't send traffic on. Connect from the service that uses it instead.";
  if (source === "llm") return "An AI model only answers calls; connect the service that calls it to the model.";
  if (target === "worker") return "Workers pull jobs from a queue. Send the work to a Queue, and connect the queue to the worker.";
  if (source === "monitoring") return "Monitoring only collects metrics; connect other components to it.";
  return "";
}

/** Why `source` can't send traffic to `target` (both building blocks), or null if the connection makes sense. */
export function connectionRule(source: BaseKind, target: BaseKind): string | null {
  const allowed = ALLOWED[source];
  if (!allowed || allowed.includes(target)) return null;
  const t = NAMES[target] ?? target;
  const named = /^(DNS|ZooKeeper)/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
  return `${NAMES[source] ?? source} can't send traffic to ${named}. ${hint(source, target)}`.trim();
}

/** The building blocks `source` may connect to. */
export function allowedTargets(source: BaseKind): readonly BaseKind[] {
  return ALLOWED[source] ?? [];
}
