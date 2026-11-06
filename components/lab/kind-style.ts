import {
  Activity,
  Bot,
  Boxes,
  Container,
  FlaskConical,
  GitBranch,
  Puzzle,
  Workflow,
  CloudLightning,
  Gauge,
  Cog,
  Database,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Lock,
  LineChart,
  ListOrdered,
  Radio,
  MonitorSmartphone,
  Network,
  Search,
  Signpost,
  Server,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CATALOG, NODE_KINDS, type BaseKind, type NodeKind, type NodeStatus } from "@/lib/sim";

const BASE_ICON: Record<BaseKind, LucideIcon> = {
  client: MonitorSmartphone,
  dns: Signpost,
  cdn: Globe,
  loadBalancer: Network,
  apiGateway: ShieldCheck,
  rateLimiter: Gauge,
  websocketGateway: Radio,
  appServer: Server,
  serverless: CloudLightning,
  cache: Zap,
  sqlDb: Database,
  nosqlDb: Layers,
  timeseriesDb: LineChart,
  queue: ListOrdered,
  worker: Cog,
  objectStorage: HardDrive,
  search: Search,
  redisLock: Lock,
  zookeeper: KeyRound,
  monitoring: Activity,
  codeRepo: GitBranch,
  ciPipeline: Workflow,
  containerRegistry: Container,
  llm: Bot,
  fineTune: FlaskConical,
};

/** Accent per component family, used for icon chips. */
const BASE_ACCENT: Record<BaseKind, string> = {
  client: "text-foreground bg-white/5",
  dns: "text-brand-blue bg-brand-blue/10",
  cdn: "text-brand-cyan bg-brand-cyan/10",
  loadBalancer: "text-brand-blue bg-brand-blue/10",
  apiGateway: "text-brand-blue bg-brand-blue/10",
  rateLimiter: "text-brand-blue bg-brand-blue/10",
  websocketGateway: "text-brand-blue bg-brand-blue/10",
  appServer: "text-brand-violet bg-brand-violet/10",
  serverless: "text-brand-violet bg-brand-violet/10",
  cache: "text-status-warn bg-status-warn/10",
  sqlDb: "text-status-ok bg-status-ok/10",
  nosqlDb: "text-status-ok bg-status-ok/10",
  timeseriesDb: "text-status-ok bg-status-ok/10",
  queue: "text-brand-cyan bg-brand-cyan/10",
  worker: "text-brand-violet bg-brand-violet/10",
  objectStorage: "text-muted-foreground bg-white/5",
  search: "text-brand-violet bg-brand-violet/10",
  redisLock: "text-status-crit bg-status-crit/10",
  zookeeper: "text-status-crit bg-status-crit/10",
  monitoring: "text-muted-foreground bg-white/5",
  codeRepo: "text-foreground bg-white/10",
  ciPipeline: "text-brand-cyan bg-brand-cyan/10",
  containerRegistry: "text-brand-blue bg-brand-blue/10",
  llm: "text-brand-violet bg-brand-violet/15",
  fineTune: "text-brand-violet bg-brand-violet/15",
};

/** Named services reuse the icon and accent of the behavior they run as. */
const ICON_OVERRIDE: Partial<Record<NodeKind, LucideIcon>> = { custom: Puzzle, agentService: Bot, mcpServer: Puzzle, docker: Container, dockerBuild: Container };
const ACCENT_OVERRIDE: Partial<Record<NodeKind, string>> = {
  custom: "text-foreground bg-white/10 ring-1 ring-dashed ring-white/20",
  agentService: BASE_ACCENT.llm,
  mcpServer: BASE_ACCENT.llm,
  playwright: BASE_ACCENT.llm,
};
export const KIND_ICON = Object.fromEntries(NODE_KINDS.map((k) => [k, ICON_OVERRIDE[k] ?? BASE_ICON[CATALOG[k].behavior]])) as Record<NodeKind, LucideIcon>;
export const KIND_ACCENT = Object.fromEntries(
  NODE_KINDS.map((k) => [k, ACCENT_OVERRIDE[k] ?? (CATALOG[k].group === "AI" ? BASE_ACCENT.llm : BASE_ACCENT[CATALOG[k].behavior])]),
) as Record<NodeKind, string>;

/** Palette sections by role. Each lists its generic blocks first, then named services that belong to it. */
const GROUP_BEHAVIORS: Array<{ title: string; icon: LucideIcon; behaviors: BaseKind[] }> = [
  { title: "Entry", icon: Globe, behaviors: ["client", "dns", "cdn", "loadBalancer", "apiGateway", "rateLimiter"] },
  { title: "Compute", icon: Server, behaviors: ["appServer", "serverless", "worker"] },
  { title: "Messaging", icon: ListOrdered, behaviors: ["queue", "websocketGateway"] },
  { title: "Databases", icon: Database, behaviors: ["sqlDb", "nosqlDb", "timeseriesDb"] },
  { title: "Storage", icon: HardDrive, behaviors: ["cache", "search", "objectStorage"] },
  { title: "AI", icon: Bot, behaviors: ["llm", "fineTune"] },
  { title: "Locks", icon: Lock, behaviors: ["redisLock", "zookeeper"] },
  { title: "Delivery", icon: GitBranch, behaviors: ["codeRepo", "ciPipeline", "containerRegistry"] },
  { title: "Ops", icon: Activity, behaviors: ["monitoring"] },
];

const groupOfBehavior = (b: BaseKind) => GROUP_BEHAVIORS.find((g) => g.behaviors.includes(b))!.title;

export interface PaletteGroup {
  title: string;
  icon: LucideIcon;
  /** Generic building blocks. */
  generic: NodeKind[];
  /** Named real-world services. */
  services: NodeKind[];
}

export const PALETTE_GROUPS: PaletteGroup[] = [
  ...GROUP_BEHAVIORS.map((g) => ({
    title: g.title,
    icon: g.icon,
    generic: g.behaviors as NodeKind[],
    services: NODE_KINDS.filter((k) => k !== "custom" && CATALOG[k].vendor && (CATALOG[k].group ?? groupOfBehavior(CATALOG[k].behavior)) === g.title),
  })),
  { title: "Custom", icon: Puzzle, generic: ["custom"], services: [] },
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
