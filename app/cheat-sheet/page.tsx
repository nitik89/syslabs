import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { CATALOG } from "@/lib/sim";

export const metadata: Metadata = { title: "Cheat sheet" };

/** Commonly cited approximate latencies (orders of magnitude, not benchmarks). */
const LATENCY: Array<[string, string, number]> = [
  ["L1 cache reference", "1 ns", 0],
  ["Main memory (RAM) read", "100 ns", 2],
  ["Read 1 MB sequentially from RAM", "~10 µs", 4],
  ["SSD random read", "~100 µs", 5],
  ["Round trip in the same data centre", "~500 µs", 5.7],
  ["Redis / Memcached GET over the network", "~1 ms", 6],
  ["Read 1 MB sequentially from SSD", "~1 ms", 6],
  ["Indexed SQL query", "1–10 ms", 7],
  ["Disk seek (spinning HDD)", "~10 ms", 7],
  ["Round trip US East ↔ US West", "~70 ms", 7.85],
  ["Round trip US ↔ Europe", "~150 ms", 8.2],
  ["LLM response (first token to full answer)", "0.5–5 s", 9.3],
];

const NINES: Array<[string, string, string]> = [
  ["99%", "3.65 days", "7.2 hours"],
  ["99.9%", "8.8 hours", "43.8 minutes"],
  ["99.95%", "4.4 hours", "21.9 minutes"],
  ["99.99%", "52.6 minutes", "4.4 minutes"],
  ["99.999%", "5.3 minutes", "26 seconds"],
];

const FORMULAS: Array<[string, string, string]> = [
  ["Average RPS", "daily requests ÷ 86,400", "10M requests/day ≈ 115 rps on average"],
  ["Peak RPS", "average × 2–10", "Plan for the peak, not the average"],
  ["Replicas needed", "peak rps ÷ (capacity per replica × 0.8)", "Keep ~20% headroom on every component"],
  ["Little's law", "in-flight requests = rps × latency (s)", "2,000 rps × 0.05 s = 100 concurrent requests"],
  ["Cache hit ratio", "hits ÷ (hits + misses)", "DB load = reads × (1 − hit ratio)"],
  ["Queue keeps up", "consumer rate > producer rate", "Otherwise backlog grows forever"],
  ["Quorum", "majority = ⌊n / 2⌋ + 1", "3 nodes tolerate 1 failure, 5 tolerate 2"],
  ["Storage per year", "writes/s × bytes × 31.5M", "100 writes/s × 1 KB ≈ 3 TB / year"],
];

const SIZES: Array<[string, string]> = [
  ["2¹⁰", "≈ 1 thousand (KB)"],
  ["2²⁰", "≈ 1 million (MB)"],
  ["2³⁰", "≈ 1 billion (GB)"],
  ["2⁴⁰", "≈ 1 trillion (TB)"],
];

/** Rules of thumb straight from SysLab's simulator defaults, so the sheet matches what you'll see. */
const CAPACITY_KINDS = ["loadBalancer", "appGateway", "appServer", "cache", "sqlDb", "nosqlDb", "queue", "worker", "cdn", "search"] as const;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <h2 className="border-b border-border px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function CheatSheetPage() {
  return (
    <>
      <PageHeader eyebrow="Cheat sheet" title="Numbers and formulas on one page" description="The estimates every design starts from. Approximate orders of magnitude, good enough for back-of-envelope maths." />
      <div className="mx-auto grid w-full max-w-[1280px] gap-5 px-6 pb-12 md:px-10 lg:grid-cols-2">
        <Card title="Latency numbers">
          <ul className="space-y-3">
            {LATENCY.map(([label, value, log]) => (
              <li key={label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span>{label}</span>
                  <span className="font-mono text-[12.5px] tabular-nums text-foreground">{value}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-brand-blue" style={{ width: `${Math.max(3, (log / 9.3) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] text-muted-foreground">Bars use a log scale: each step right is roughly 10× slower.</p>
        </Card>

        <Card title="Formulas">
          <ul className="divide-y divide-border">
            {FORMULAS.map(([name, f, example]) => (
              <li key={name} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[13px] font-semibold">{name}</span>
                  <code className="font-mono text-[12px] text-brand-cyan">{f}</code>
                </div>
                <p className="text-[12px] text-muted-foreground">{example}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Capacity per replica in SysLab">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="pb-2 font-normal">Component</th>
                <th className="pb-2 text-right font-normal">rps / replica</th>
                <th className="pb-2 text-right font-normal">latency</th>
                <th className="pb-2 text-right font-normal">$ / month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CAPACITY_KINDS.map((k) => {
                const d = CATALOG[k].defaults;
                return (
                  <tr key={k}>
                    <td className="py-2">{CATALOG[k].label}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{d.capacity.toLocaleString("en-US")}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{d.latencyMs} ms</td>
                    <td className="py-2 text-right font-mono tabular-nums">${d.costPerReplica}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11.5px] text-muted-foreground">SQL databases: replicas add read capacity only. Every write still goes to one primary. Caches: the price is for 8 GB; doubling the memory costs about 41% more (32 GB is twice the price). In graded problems capacity, latency and cost are fixed: you scale with replicas, cache size or a different component.</p>
        </Card>

        <div className="grid gap-5">
          <Card title="Availability (the nines)">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="pb-2 font-normal">Uptime</th>
                  <th className="pb-2 text-right font-normal">Down per year</th>
                  <th className="pb-2 text-right font-normal">Down per month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {NINES.map(([u, y, m]) => (
                  <tr key={u}>
                    <td className="py-2 font-mono text-brand-cyan">{u}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{y}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Powers of two">
            <ul className="grid grid-cols-2 gap-2">
              {SIZES.map(([p, v]) => (
                <li key={p} className="rounded-lg bg-white/[0.03] px-3 py-2 text-[13px]">
                  <span className="font-mono text-brand-blue">{p}</span> <span className="text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
