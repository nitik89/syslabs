"use client";

import { useId, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTOSCALE_KINDS,
  cacheHitRatioFor,
  cdnHitRatio,
  connectionLimit,
  type BaseKind,
  type EvictionPolicy,
  type IndexLevel,
  type LbAlgorithm,
  type NodeConfig,
  type TrafficProfile,
  type WritePolicy,
} from "@/lib/sim";
import { fmtPct } from "@/lib/format";
import { COMPONENT_GUIDE } from "@/data/component-guide";

/* ------------------------------ building blocks ------------------------------ */

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; detail: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 w-full rounded-lg border border-input bg-input/30 px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="text-[11.5px] leading-snug text-muted-foreground">{current.detail}</p>
    </div>
  );
}

function Toggle({ label, checked, onChange, detail }: { label: string; checked: boolean; onChange: (v: boolean) => void; detail: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
        <span>{label}</span>
        <span className="relative inline-flex">
          <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
          <span className="h-5 w-9 rounded-full bg-white/[0.12] transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
          <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
      <p className="text-[11.5px] leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}

function Readout({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return (
    <p
      className={cn(
        "rounded-lg border px-2.5 py-2 text-[12px] leading-snug",
        tone === "good" && "border-status-ok/30 bg-status-ok/[0.07]",
        tone === "warn" && "border-status-warn/30 bg-status-warn/[0.07]",
        tone === "bad" && "border-status-crit/30 bg-status-crit/[0.07]",
        tone === "neutral" && "border-border bg-white/[0.02]",
      )}
    >
      {children}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-3">
      <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

/* ------------------------------ settings per component ------------------------------ */

const TTL_OPTIONS = [
  { value: "10", label: "10 seconds", detail: "Very fresh data, but items expire constantly: many more misses reach the database." },
  { value: "60", label: "1 minute", detail: "Good for data that changes often (stock levels, scores). Some extra misses." },
  { value: "300", label: "5 minutes", detail: "A common middle ground: data can be up to 5 minutes old." },
  { value: "3600", label: "1 hour (default)", detail: "Great hit ratio; fine for data that rarely changes (product details, profiles)." },
  { value: "86400", label: "1 day", detail: "Highest hit ratio; only for data that almost never changes, or that you invalidate on write." },
];

const EVICTION: { value: EvictionPolicy; label: string; detail: string }[] = [
  { value: "lru", label: "LRU: least recently used (default)", detail: "Throws out whatever hasn't been read for the longest. A safe default for most apps." },
  { value: "lfu", label: "LFU: least frequently used", detail: "Keeps the most popular items longest. Best when a few items get most of the reads (hot keys)." },
  { value: "fifo", label: "FIFO: oldest first", detail: "Throws out the oldest item even if it's popular. Simple, but misses more." },
  { value: "random", label: "Random", detail: "Throws out a random item. Cheap to run, but popular items get evicted too." },
];

const WRITE: { value: WritePolicy; label: string; detail: string }[] = [
  {
    value: "cache-aside",
    label: "Cache-aside (default)",
    detail: "The app reads the cache; on a miss it reads the database and fills the cache. Writes go to the database and clear the cached copy.",
  },
  {
    value: "write-through",
    label: "Write-through",
    detail: "Every write updates the cache and the database together. Reads right after a write still hit; each write is a little slower.",
  },
  {
    value: "write-back",
    label: "Write-back (write-behind)",
    detail: "Writes land in the cache and reach the database later in batches: far less database write load, but recent writes are lost if the cache crashes.",
  },
];

const LB: { value: LbAlgorithm; label: string; detail: string }[] = [
  { value: "round-robin", label: "Round robin (default)", detail: "Takes turns: 1, 2, 3, 1, 2, 3… Even when every request costs about the same." },
  { value: "least-connections", label: "Least connections", detail: "Sends each request to the least busy server. Best when some requests are slow (uploads, reports)." },
  { value: "ip-hash", label: "IP hash (sticky sessions)", detail: "Each user always lands on the same server. Keeps sessions simple but splits load unevenly." },
  { value: "random", label: "Random", detail: "Picks a server at random. Simple, and roughly even over time, but lumpy in the short run." },
];

const CDN_TTL = [
  { value: "forever", label: "Versioned files, cache forever (default)", detail: "File names change on every release (app.3f9a.js), so the edge never needs to refetch." },
  { value: "86400", label: "1 day", detail: "About 1% of requests go back to your servers to refresh files." },
  { value: "3600", label: "1 hour", detail: "About 5% of requests go back to your servers." },
  { value: "300", label: "5 minutes", detail: "About 12% go back to your servers: noticeable extra load during a spike." },
  { value: "30", label: "30 seconds", detail: "Around 40% go back to your servers: the CDN barely helps." },
];

const LEVEL_FOR_COUNT = (n: number): IndexLevel => (n === 0 ? "none" : n <= 3 ? "standard" : "heavy");

function IndexedColumns({ cfg, onChange }: { cfg: NodeConfig; onChange: (patch: Partial<NodeConfig>) => void }) {
  const [draft, setDraft] = useState("");
  const cols = cfg.indexedColumns ?? [];
  const id = useId();
  const add = () => {
    const c = draft.trim().toLowerCase().replace(/\s+/g, "_");
    if (!c || cols.includes(c)) return setDraft("");
    const next = [...cols, c].slice(0, 12);
    onChange({ indexedColumns: next, indexes: LEVEL_FOR_COUNT(next.length) });
    setDraft("");
  };
  const remove = (c: string) => {
    const next = cols.filter((x) => x !== c);
    onChange({ indexedColumns: next, indexes: LEVEL_FOR_COUNT(next.length) });
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        Indexed columns
      </label>
      {cols.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {cols.map((c) => (
            <li key={c} className="flex items-center gap-1 rounded-md bg-brand-blue/12 px-2 py-0.5 font-mono text-[11.5px] text-brand-blue">
              {c}
              <button type="button" onClick={() => remove(c)} aria-label={`Remove index on ${c}`} className="rounded hover:text-foreground">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. email, user_id, created_at"
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-input/30 px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Add indexed column"
          className="flex size-8 items-center justify-center rounded-lg border border-border hover:bg-white/[0.05]"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <p className="text-[11.5px] leading-snug text-muted-foreground">
        Index the columns your busiest queries filter by (WHERE email = …). No indexes: every read scans the whole table. 1–3: the usual sweet spot. 4 or more: reads get
        faster still, but every write has to update every index.
      </p>
    </div>
  );
}

/**
 * Settings that change how a component behaves in the simulator, each explained in plain words, plus a
 * live readout of the effect. Shown in the component panel below capacity and replicas.
 */
export function ComponentSettings({
  behavior,
  cfg,
  traffic,
  onChange,
}: {
  behavior: BaseKind;
  cfg: NodeConfig;
  traffic: TrafficProfile;
  onChange: (patch: Partial<NodeConfig>) => void;
}) {
  const isDb = behavior === "sqlDb" || behavior === "nosqlDb" || behavior === "timeseriesDb";
  const sections: React.ReactNode[] = [];

  if (behavior === "cache") {
    const hr = cacheHitRatioFor(cfg, traffic.hotKeyFraction);
    sections.push(
      <Section key="cache" title="Cache policies">
        <Choice label="When full, throw out… (eviction)" value={cfg.eviction ?? "lru"} options={EVICTION} onChange={(v) => onChange({ eviction: v })} />
        <Choice
          label="Keep items for… (TTL)"
          value={String(cfg.ttlSeconds ?? 3600)}
          options={TTL_OPTIONS.some((o) => o.value === String(cfg.ttlSeconds ?? 3600)) ? TTL_OPTIONS : [...TTL_OPTIONS, { value: String(cfg.ttlSeconds), label: `${cfg.ttlSeconds} s`, detail: "Custom." }]}
          onChange={(v) => onChange({ ttlSeconds: Number(v) })}
        />
        <Choice label="Writes (write policy)" value={cfg.writePolicy ?? "cache-aside"} options={WRITE} onChange={(v) => onChange({ writePolicy: v })} />
        <Readout tone={hr >= 0.85 ? "good" : hr >= 0.6 ? "warn" : "bad"}>
          With this traffic, about <span className="font-semibold">{fmtPct(hr, 0)}</span> of reads are answered from the cache; {fmtPct(1 - hr, 0)} still reach the
          database.
          {cfg.writePolicy === "write-back" && " ⚠ Write-back: recent writes are lost if the cache crashes before flushing."}
        </Readout>
      </Section>,
    );
  }

  if (isDb) {
    const limit = connectionLimit(cfg.maxConnections, cfg.latencyMs);
    const capped = limit < cfg.capacity;
    const id = "max-conn";
    sections.push(
      <Section key="db" title="Database settings">
        <div className="space-y-1">
          <label htmlFor={id} className="text-xs text-muted-foreground">
            Max connections (per instance)
          </label>
          <input
            id={id}
            type="number"
            min={1}
            max={5000}
            value={cfg.maxConnections ?? 100}
            onChange={(e) => onChange({ maxConnections: Math.max(1, Number(e.target.value) || 1) })}
            className="h-8 w-full rounded-lg border border-input bg-input/30 px-2 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-[11.5px] leading-snug text-muted-foreground">
            How many queries it works on at the same time. Each query holds a connection for about {cfg.latencyMs} ms, so {cfg.maxConnections ?? 100} connections can run
            about {Math.round(limit).toLocaleString("en-US")} queries a second.
          </p>
        </div>
        <Readout tone={capped ? "bad" : "good"}>
          {capped
            ? `Too few connections: this instance is limited to ~${Math.round(limit).toLocaleString("en-US")} queries/s, below its ${cfg.capacity.toLocaleString("en-US")} capacity. Requests wait in line.`
            : "Enough connections: throughput is limited by the database itself, not the pool."}
        </Readout>
        {behavior !== "timeseriesDb" && <IndexedColumns cfg={cfg} onChange={onChange} />}
        {behavior === "nosqlDb" && (
          <Choice
            label="Read consistency"
            value={cfg.consistency ?? "eventual"}
            options={[
              { value: "eventual", label: "Eventual (default)", detail: "Reads are fast and cheap, but right after a write a read may briefly return the old value." },
              { value: "strong", label: "Strong", detail: "Reads always see the latest write, but each one checks several copies: about half the read capacity and a bit slower." },
            ]}
            onChange={(v) => onChange({ consistency: v })}
          />
        )}
      </Section>,
    );
  }

  if (behavior === "loadBalancer") {
    sections.push(
      <Section key="lb" title="Load balancing">
        <Choice label="How to spread requests (algorithm)" value={cfg.lbAlgorithm ?? "round-robin"} options={LB} onChange={(v) => onChange({ lbAlgorithm: v })} />
        <Toggle
          label="Health checks"
          checked={cfg.healthChecks ?? true}
          onChange={(v) => onChange({ healthChecks: v })}
          detail={
            cfg.healthChecks === false
              ? "Off: if a server dies, the balancer keeps sending it requests and those users get errors."
              : "On: every few seconds it asks each server 'are you OK?' and stops sending traffic to one that doesn't answer."
          }
        />
      </Section>,
    );
  }

  if (AUTOSCALE_KINDS.has(behavior)) {
    const on = (cfg.autoscaleMax ?? 0) > cfg.replicas;
    const id = "autoscale-max";
    sections.push(
      <Section key="scale" title="Autoscaling">
        <Toggle
          label="Scale out automatically"
          checked={on}
          onChange={(v) => onChange({ autoscaleMax: v ? Math.max(cfg.replicas * 3, cfg.replicas + 2) : undefined })}
          detail="Adds copies when traffic rises and removes them when it falls, keeping each copy around 70% busy. You pay for the copies running at peak."
        />
        {on && (
          <div className="space-y-1">
            <label htmlFor={id} className="text-xs text-muted-foreground">
              Maximum replicas
            </label>
            <input
              id={id}
              type="number"
              min={cfg.replicas + 1}
              max={200}
              value={cfg.autoscaleMax}
              onChange={(e) => onChange({ autoscaleMax: Math.max(cfg.replicas + 1, Number(e.target.value) || cfg.replicas + 1) })}
              className="h-8 w-full rounded-lg border border-input bg-input/30 px-2 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Readout>
              Runs between <span className="font-semibold">{cfg.replicas}</span> and <span className="font-semibold">{cfg.autoscaleMax}</span> copies: up to{" "}
              {(cfg.capacity * (cfg.autoscaleMax ?? 0)).toLocaleString("en-US")} req/s. The maximum caps your bill, so a huge spike can still overload it.
            </Readout>
          </div>
        )}
      </Section>,
    );
  }

  if (behavior === "cdn") {
    const v = cfg.cdnTtlSeconds === undefined ? "forever" : String(cfg.cdnTtlSeconds);
    sections.push(
      <Section key="cdn" title="Edge caching">
        <Choice
          label="Keep files at the edge for…"
          value={CDN_TTL.some((o) => o.value === v) ? v : "forever"}
          options={CDN_TTL}
          onChange={(x) => onChange({ cdnTtlSeconds: x === "forever" ? undefined : Number(x) })}
        />
        <Readout tone={cdnHitRatio(cfg.cdnTtlSeconds) >= 0.95 ? "good" : "warn"}>
          About <span className="font-semibold">{fmtPct(cdnHitRatio(cfg.cdnTtlSeconds), 0)}</span> of file requests are served at the edge. Misses go back to whatever
          the CDN is connected to (object storage or your servers).
        </Readout>
      </Section>,
    );
  }

  return <div className="space-y-3">{sections}</div>;
}

/** The plain-language guide for a component type, collapsible. */
export function ComponentGuideCard({ behavior }: { behavior: BaseKind }) {
  const g = COMPONENT_GUIDE[behavior];
  const [open, setOpen] = useState(false);
  if (!g) return null;
  return (
    <section className="rounded-xl border border-brand-blue/25 bg-brand-blue/[0.05]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-2 p-3 text-left">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold">In plain words</span>
          <span className="block text-[12.5px] leading-snug text-muted-foreground">
            {g.what} <span className="italic">Like {g.analogy.charAt(0).toLowerCase() + g.analogy.slice(1)}</span>
          </span>
        </span>
        {open ? <ChevronDown className="mt-0.5 size-4 shrink-0" /> : <ChevronRight className="mt-0.5 size-4 shrink-0" />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-brand-blue/20 p-3 text-[12.5px] leading-relaxed">
          <div>
            <p className="font-semibold">Use it when</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {g.useWhen.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold">Words you&apos;ll see</p>
            <dl className="mt-1 space-y-1.5">
              {g.terms.map((t) => (
                <div key={t.name}>
                  <dt className="font-medium">{t.name}</dt>
                  <dd className="text-muted-foreground">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="font-semibold text-status-warn">Watch out for</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {g.watchOut.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          {g.rule && (
            <p className="rounded-lg bg-white/[0.04] px-2.5 py-2">
              <span className="font-semibold">Rule of thumb: </span>
              {g.rule}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
