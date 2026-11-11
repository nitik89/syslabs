/** Renders data/component-guide.ts to docs/components.md. Run with: npm run docs:components */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = resolve(fileURLToPath(import.meta.url), "../..");
const { COMPONENT_GUIDE } = await import(resolve(root, "data/component-guide.ts"));
const NAMES = {
  client: "Client", dns: "DNS", cdn: "CDN", loadBalancer: "Load balancer", apiGateway: "API gateway", rateLimiter: "Rate limiter",
  appGateway: "Application gateway", websocketGateway: "WebSocket gateway", appServer: "App server", serverless: "Serverless function",
  cache: "Cache", sqlDb: "SQL database", nosqlDb: "NoSQL database", timeseriesDb: "Time-series database", queue: "Queue", worker: "Worker",
  objectStorage: "Object storage", search: "Search engine", redisLock: "Lock service", zookeeper: "Coordination service (ZooKeeper / etcd)",
  monitoring: "Monitoring", codeRepo: "Code repository", ciPipeline: "CI/CD pipeline", containerRegistry: "Container registry", llm: "LLM (AI model)", fineTune: "Fine-tuning",
};
let md = `# Component reference

Every building block in SysLab, in plain words. This is the same guide shown under **In plain words** when you double-click a component on the canvas (generated from \`data/component-guide.ts\`).

Named real-world services (AWS ALB, Redis, PostgreSQL, Kafka, Claude…) behave like one of these building blocks, with their own capacity, latency and price. For the settings that change the simulation (cache policies, connection pools, autoscaling and more), see [simulator.md](simulator.md#component-settings).

## Contents

${Object.keys(COMPONENT_GUIDE).map((k) => `- [${NAMES[k] ?? k}](#${(NAMES[k] ?? k).toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-")})`).join("\n")}
`;
for (const [k, g] of Object.entries(COMPONENT_GUIDE)) {
  md += `\n## ${NAMES[k] ?? k}\n\n${g.what}\n\n> *Like ${g.analogy.charAt(0).toLowerCase()}${g.analogy.slice(1)}*\n\n**Use it when**\n\n${g.useWhen.map((x) => `- ${x}`).join("\n")}\n\n**Words you'll see**\n\n| Term | Meaning |\n| --- | --- |\n${g.terms.map((t) => `| ${t.name} | ${t.meaning.replace(/\|/g, "\\|")} |`).join("\n")}\n\n**Watch out for**\n\n${g.watchOut.map((x) => `- ${x}`).join("\n")}\n`;
  if (g.rule) md += `\n**Rule of thumb:** ${g.rule}\n`;
}
writeFileSync(resolve(root, "docs/components.md"), md);
console.log("components:", Object.keys(COMPONENT_GUIDE).length);
