import {
  siAlgolia,
  siApachecassandra,
  siApachekafka,
  siArgo,
  siBitbucket,
  siCelery,
  siClaude,
  siCloudflare,
  siCloudflareworkers,
  siDatadog,
  siDocker,
  siElasticsearch,
  siEtcd,
  siFirebase,
  siGithub,
  siGithubactions,
  siGitlab,
  siGooglecloud,
  siGooglecloudstorage,
  siGooglegemini,
  siGooglepubsub,
  siHuggingface,
  siHaproxy,
  siInfluxdb,
  siJenkins,
  siKong,
  siKubernetes,
  siLangchain,
  siModelcontextprotocol,
  siMongodb,
  siMysql,
  siNatsdotio,
  siNeon,
  siNginx,
  siOpensearch,
  siPlanetscale,
  siPostgresql,
  siPrometheus,
  siPusher,
  siRabbitmq,
  siRedis,
  siSentry,
  siSocketdotio,
  siSupabase,
  siUpstash,
  siVercel,
  siVllm,
  type SimpleIcon,
} from "simple-icons";
import { cn } from "@/lib/utils";
import { CATALOG, type NodeKind } from "@/lib/sim";
import { KIND_ACCENT, KIND_ICON } from "./kind-style";
import { BRAND_SVGS, type BrandSvg } from "./brand-svgs";

/** Real brand marks (Simple Icons, CC0). Services without one fall back to their component icon. */
const LOGOS: Partial<Record<NodeKind, SimpleIcon>> = {
  github: siGithub,
  gitlab: siGitlab,
  bitbucket: siBitbucket,
  githubActions: siGithubactions,
  jenkins: siJenkins,
  dockerBuild: siDocker,
  docker: siDocker,
  dockerHub: siDocker,
  argocd: siArgo,
  kubernetes: siKubernetes,
  kafka: siApachekafka,
  rabbitmq: siRabbitmq,
  nats: siNatsdotio,
  redisPubsub: siRedis,
  redisStreams: siRedis,
  redisLock: siRedis,
  cache: siRedis,
  postgres: siPostgresql,
  pgvector: siPostgresql,
  mysql: siMysql,
  mongodb: siMongodb,
  mongodbAtlas: siMongodb,
  cassandra: siApachecassandra,
  supabase: siSupabase,
  neon: siNeon,
  planetscale: siPlanetscale,
  firestore: siFirebase,
  cloudSql: siGooglecloud,
  cloudRun: siGooglecloud,
  gcs: siGooglecloudstorage,
  pubsub: siGooglepubsub,
  gemini: siGooglegemini,
  claude: siClaude,
  vercel: siVercel,
  vercelAiGateway: siVercel,
  vercelSandbox: siVercel,
  cloudflare: siCloudflare,
  cloudflareWorkers: siCloudflareworkers,
  nginx: siNginx,
  haproxy: siHaproxy,
  kong: siKong,
  upstash: siUpstash,
  elasticsearch: siElasticsearch,
  opensearch: siOpensearch,
  algolia: siAlgolia,
  influxdb: siInfluxdb,
  etcd: siEtcd,
  prometheus: siPrometheus,
  datadog: siDatadog,
  sentry: siSentry,
  socketio: siSocketdotio,
  pusher: siPusher,
  celery: siCelery,
  mcpServer: siModelcontextprotocol,
  vllm: siVllm,
  agentService: siLangchain,
  huggingface: siHuggingface,
  huggingfaceHub: siHuggingface,
};

/** Marks Simple Icons doesn't carry (OpenAI, Groq...), with the color to draw mono marks in. */
const EXTRA: Partial<Record<NodeKind, { svg: BrandSvg; color: string }>> = {
  openai: { svg: BRAND_SVGS.openai, color: "var(--mono-mark)" },
  embeddings: { svg: BRAND_SVGS.openai, color: "var(--mono-mark)" },
  openaiFineTune: { svg: BRAND_SVGS.openai, color: "var(--mono-mark)" },
  codex: { svg: BRAND_SVGS.codex, color: "" },
  groq: { svg: BRAND_SVGS.groq, color: "#F55036" },
};

/** Near-black brand colors (GitHub, Vercel, ...) vanish on the dark canvas, so draw those in white. */
function visibleColor(hex: string): string {
  const n = parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.28 ? "var(--mono-mark)" : `#${hex}`;
}

const SIZES = {
  sm: { box: "size-6 rounded-md", glyph: "size-3.5" },
  md: { box: "size-7 rounded-md", glyph: "size-[15px]" },
  lg: { box: "size-8 rounded-lg", glyph: "size-4" },
  xl: { box: "size-9 rounded-lg", glyph: "size-[18px]" },
} as const;


export function KindIcon({ kind, size = "md", className }: { kind: NodeKind; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  const extra = EXTRA[kind] ?? (CATALOG[kind].vendor === "AWS" ? { svg: BRAND_SVGS.aws, color: "#FF9900" } : undefined);
  if (extra) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center bg-white/[0.07] ring-1 ring-white/10", s.box, className)}>
        <svg
          aria-hidden="true"
          viewBox={extra.svg.viewBox}
          className={s.glyph}
          fill={extra.svg.mono ? extra.color : undefined}
          fillRule="evenodd"
          // Static markup from a vetted icon package (see brand-svgs.ts), never user input.
          dangerouslySetInnerHTML={{ __html: extra.svg.markup }}
        />
      </span>
    );
  }
  const logo = LOGOS[kind];
  if (logo) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center bg-white/[0.07] ring-1 ring-white/10", s.box, className)}>
        <svg role="img" aria-hidden="true" viewBox="0 0 24 24" className={s.glyph} fill={visibleColor(logo.hex)}>
          <path d={logo.path} />
        </svg>
      </span>
    );
  }
  const Icon = KIND_ICON[kind];
  const accent = KIND_ACCENT[kind];
  return (
    <span className={cn("flex shrink-0 items-center justify-center", s.box, accent, className)}>
      <Icon className={s.glyph} aria-hidden="true" />
    </span>
  );
}
