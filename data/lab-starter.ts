import { defaultConfig } from "@/lib/sim";
import type { DesignDoc } from "@/lib/storage";

/** What the Lab shows the first time (and after Reset): a minimal three-tier web app. */
export const LAB_STARTER: DesignDoc = {
  graph: {
    nodes: [
      { id: "client-1", kind: "client", label: "Users", config: defaultConfig("client") },
      { id: "loadBalancer-1", kind: "loadBalancer", label: "Load Balancer", config: defaultConfig("loadBalancer") },
      { id: "appServer-1", kind: "appServer", label: "App Server", config: { ...defaultConfig("appServer"), replicas: 2 } },
      { id: "sqlDb-1", kind: "sqlDb", label: "Postgres", config: defaultConfig("sqlDb") },
    ],
    edges: [
      { id: "e:client-1->loadBalancer-1", source: "client-1", target: "loadBalancer-1" },
      { id: "e:loadBalancer-1->appServer-1", source: "loadBalancer-1", target: "appServer-1" },
      { id: "e:appServer-1->sqlDb-1", source: "appServer-1", target: "sqlDb-1" },
    ],
  },
  positions: {
    "client-1": { x: 0, y: 120 },
    "loadBalancer-1": { x: 260, y: 120 },
    "appServer-1": { x: 520, y: 120 },
    "sqlDb-1": { x: 780, y: 120 },
  },
  traffic: { rps: 800, readRatio: 0.8, hotKeyFraction: 0.7, staticFraction: 0 },
};
