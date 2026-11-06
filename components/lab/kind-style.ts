import {
  Activity,
  Boxes,
  Database,
  Globe,
  HardDrive,
  Layers,
  ListOrdered,
  MonitorSmartphone,
  Network,
  Search,
  Server,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind, NodeStatus } from "@/lib/sim";

export const KIND_ICON: Record<NodeKind, LucideIcon> = {
  client: MonitorSmartphone,
  cdn: Globe,
  loadBalancer: Network,
  apiGateway: ShieldCheck,
  appServer: Server,
  cache: Zap,
  sqlDb: Database,
  nosqlDb: Layers,
  queue: ListOrdered,
  objectStorage: HardDrive,
  search: Search,
  monitoring: Activity,
};

/** Accent per component family, used for icon chips. */
export const KIND_ACCENT: Record<NodeKind, string> = {
  client: "text-foreground bg-white/5",
  cdn: "text-brand-cyan bg-brand-cyan/10",
  loadBalancer: "text-brand-blue bg-brand-blue/10",
  apiGateway: "text-brand-blue bg-brand-blue/10",
  appServer: "text-brand-violet bg-brand-violet/10",
  cache: "text-status-warn bg-status-warn/10",
  sqlDb: "text-status-ok bg-status-ok/10",
  nosqlDb: "text-status-ok bg-status-ok/10",
  queue: "text-brand-cyan bg-brand-cyan/10",
  objectStorage: "text-muted-foreground bg-white/5",
  search: "text-brand-violet bg-brand-violet/10",
  monitoring: "text-muted-foreground bg-white/5",
};

export const PALETTE_GROUPS: Array<{ title: string; kinds: NodeKind[] }> = [
  { title: "Entry", kinds: ["client", "cdn", "loadBalancer", "apiGateway"] },
  { title: "Compute", kinds: ["appServer", "queue"] },
  { title: "Data", kinds: ["cache", "sqlDb", "nosqlDb", "search", "objectStorage"] },
  { title: "Operations", kinds: ["monitoring"] },
];

export const STATUS_RING: Record<NodeStatus, string> = {
  idle: "border-border",
  ok: "border-status-ok/70 shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-ok)_18%,transparent)]",
  warn: "border-status-warn/80 shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-warn)_20%,transparent)]",
  crit: "border-status-crit shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-crit)_25%,transparent)]",
};

export const STATUS_TEXT: Record<NodeStatus, string> = {
  idle: "text-muted-foreground",
  ok: "text-status-ok",
  warn: "text-status-warn",
  crit: "text-status-crit",
};

export const STATUS_BAR: Record<NodeStatus, string> = {
  idle: "bg-muted-foreground/40",
  ok: "bg-status-ok",
  warn: "bg-status-warn",
  crit: "bg-status-crit",
};

export const STATUS_LABEL: Record<NodeStatus, string> = {
  idle: "No traffic",
  ok: "Healthy",
  warn: "Running hot",
  crit: "Overloaded / failing",
};

export { Boxes as EmptyCanvasIcon };
