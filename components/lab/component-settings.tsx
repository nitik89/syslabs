"use client";

import { cloneElement, isValidElement, useId, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTOSCALE_KINDS,
  INSTANCE_SIZES,
  sizeOf,
  cacheHitRatioFor,
  cdnHitRatio,
  connectionLimit,
  handlesClass,
  type BaseKind,
  type EvictionPolicy,
  type IndexLevel,
  type InstanceSize,
  type LbAlgorithm,
  type NodeConfig,
  type TrafficClass,
  type TrafficProfile,
  type WritePolicy,
} from "@/lib/sim";
import { fmtPct } from "@/lib/format";
import { COMPONENT_GUIDE } from "@/data/component-guide";
import { trafficSplit } from "./traffic-panel";

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

/** A collapsible group of settings; only the first one starts open, so the panel stays short. */
function Section({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <details open={first} className="group rounded-xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 outline-none hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground group-open:text-foreground">{title}</h4>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="space-y-3 px-3 pb-3">{children}</div>
    </details>
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

const REQUEST_KINDS: { cls: TrafficClass; label: string; verbs: string; detail: string }[] = [
  { cls: "read", label: "Reads", verbs: "GET", detail: "Fetching data: open a post, load a feed, view a profile." },
  { cls: "write", label: "Writes", verbs: "POST · PUT · DELETE", detail: "Changing data: create a post, like, comment, update a profile." },
  { cls: "static", label: "Static files", verbs: "GET /assets", detail: "Images, scripts and stylesheets (better served by a CDN or object storage)." },
];

const ROLES: { id: string; label: string; handles: TrafficClass[] | undefined; detail: string }[] = [
  { id: "all", label: "Everything", handles: undefined, detail: "One service does it all (a monolith). Simple to start with." },
  { id: "read", label: "Reads only", handles: ["read"], detail: "Only answers GETs, e.g. a feed or timeline service. Scale it for the busy read side." },
  { id: "write", label: "Writes only", handles: ["write"], detail: "Only takes POST/PUT/DELETE, e.g. a post service. Usually needs far fewer copies." },
];

/** Which kinds of request a service takes: lets one design split reads and writes into separate services. */
function RequestTypes({ cfg, traffic, onChange }: { cfg: NodeConfig; traffic: TrafficProfile; onChange: (patch: Partial<NodeConfig>) => void }) {
  const on = (cls: TrafficClass) => handlesClass(cfg, cls);
  const set = (next: TrafficClass[]) => onChange({ handles: next.length === 0 || next.length === 3 ? undefined : next });
  const toggle = (cls: TrafficClass) => {
    const cur = REQUEST_KINDS.map((k) => k.cls).filter(on);
    const next = cur.includes(cls) ? cur.filter((c) => c !== cls) : [...cur, cls];
    if (next.length === 0) return; // a service must take something
    set(next);
  };
  const role = ROLES.find((r) => JSON.stringify(r.handles ?? null) === JSON.stringify(cfg.handles && cfg.handles.length > 0 && cfg.handles.length < 3 ? [...cfg.handles].sort() : null));
  const { reads, writes, stat } = trafficSplit(traffic);
  const perClass: Record<TrafficClass, number> = { read: reads, write: writes, static: stat };
  const share = REQUEST_KINDS.filter((k) => on(k.cls)).reduce((a, k) => a + perClass[k.cls], 0);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-[13px]">What is this service for?</p>
        <div role="radiogroup" aria-label="Service role" className="grid grid-cols-3 gap-1 rounded-lg border border-border p-0.5">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={role?.id === r.id}
              onClick={() => set(r.handles ?? [])}
              className={cn(
                "rounded-md px-1.5 py-1.5 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                role?.id === r.id ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] leading-snug text-muted-foreground">{role ? role.detail : "A custom mix of request types."}</p>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-[13px]">Requests it handles</legend>
        {REQUEST_KINDS.map((k) => (
          <label key={k.cls} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-2.5 py-2 hover:bg-white/[0.03]">
            <input type="checkbox" checked={on(k.cls)} onChange={() => toggle(k.cls)} className="mt-0.5 size-3.5 accent-[var(--primary)]" />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium">{k.label}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">{k.verbs}</span>
              </span>
              <span className="block text-[11.5px] leading-snug text-muted-foreground">{k.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Readout>
        In this traffic, that&apos;s up to <span className="font-semibold">{Math.round(share).toLocaleString("en-US")} req/s</span> across all services like this one. Load
        balancers and gateways send each request only to services that take it. If no service takes a kind, those requests fail, so make sure something
        handles reads <em>and</em> writes.
      </Readout>
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

  if (behavior === "appServer" || behavior === "serverless") {
    sections.push(
      <Section key="handles" title="Request types">
        <RequestTypes cfg={cfg} traffic={traffic} onChange={onChange} />
      </Section>,
    );
  }

  // Scale up: a bigger (or smaller) machine for every replica.
  if (AUTOSCALE_KINDS.has(behavior) || isDb || behavior === "cache") {
    const size = sizeOf(cfg);
    sections.push(
      <Section key="size" title="Machine size (scale up)">
        <Choice
          label="Instance size"
          value={cfg.instanceSize ?? "medium"}
          options={(Object.keys(INSTANCE_SIZES) as InstanceSize[]).map((k) => ({
            value: k,
            label: `${INSTANCE_SIZES[k].label}${k === "medium" ? " (default)" : ""}: ${INSTANCE_SIZES[k].capacity}× capacity, ${INSTANCE_SIZES[k].cost}× price`,
            detail:
              k === "small"
                ? "Half the power at half the price. Fine for light traffic, but less headroom for spikes."
                : k === "medium"
                  ? "The standard machine for this component."
                  : k === "large"
                    ? "Twice the power for a bit more than twice the price. Scaling up is simple, but one big machine is still one machine."
                    : "Four times the power. Useful for a database that can't easily be split; past this you have to scale out (more copies or shards).",
          }))}
          onChange={(v) => onChange({ instanceSize: v === "medium" ? undefined : v })}
        />
        <Readout>
          Each copy handles about <span className="font-semibold">{Math.round(cfg.capacity * size.capacity).toLocaleString("en-US")} req/s</span>; with {cfg.replicas}{" "}
          {cfg.replicas === 1 ? "copy" : "copies"} that&apos;s {Math.round(cfg.capacity * size.capacity * cfg.replicas).toLocaleString("en-US")} req/s.{" "}
          {behavior === "sqlDb" && "Read replicas add reads only: writes still go to one primary, so a bigger primary is how you add write room."}
          {AUTOSCALE_KINDS.has(behavior) && "Scale out (more replicas) also survives a machine dying; scale up doesn't."}
        </Readout>
      </Section>,
    );
  }

  if (behavior === "appServer" || behavior === "serverless") {
    const v = cfg.timeoutMs === undefined ? "none" : String(cfg.timeoutMs);
    sections.push(
      <Section key="timeout" title="Request handling">
        <Choice
          label="Request timeout"
          value={["none", "100", "500", "2000", "10000"].includes(v) ? v : "none"}
          options={[
            { value: "none", label: "No limit (default)", detail: "Requests wait as long as it takes. When the server is overloaded, users stare at a spinner for seconds." },
            { value: "100", label: "100 ms", detail: "Very strict: anything slower fails at once. Good for internal calls where a quick fallback exists." },
            { value: "500", label: "500 ms", detail: "Common for user-facing APIs: slow requests fail fast so the user can retry instead of waiting." },
            { value: "2000", label: "2 seconds", detail: "Forgiving: only very slow requests fail." },
            { value: "10000", label: "10 seconds", detail: "Long jobs like uploads or reports." },
          ]}
          onChange={(x) => onChange({ timeoutMs: x === "none" ? undefined : Number(x) })}
        />
        <Readout>
          A timeout turns a slow request into a fast error. It doesn&apos;t add capacity, but it stops overloaded servers from holding users for seconds, and frees the server to
          take new work.
        </Readout>
        <div className="space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Good habits for app servers</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <span className="text-foreground">Stateless:</span> keep sessions in a cache or database, not in server memory, so any copy can serve any user.
            </li>
            <li>
              <span className="text-foreground">Health endpoint:</span> a /health URL the load balancer checks every few seconds.
            </li>
            <li>
              <span className="text-foreground">Graceful shutdown:</span> finish in-flight requests before stopping during a deploy.
            </li>
            <li>
              <span className="text-foreground">Retries with backoff:</span> retry failed calls after a short, growing wait, never instantly, or a slowdown becomes a retry storm.
            </li>
            <li>
              <span className="text-foreground">Connection pooling:</span> reuse a small pool of database connections instead of opening one per request.
            </li>
          </ul>
        </div>
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

  if (sections.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Settings</p>
      {sections.map((el, i) => (i === 0 && isValidElement<{ first?: boolean }>(el) ? cloneElement(el, { first: true }) : el))}
    </div>
  );
}

/** The plain-language guide for a component type, collapsible. */
export function ComponentGuideCard({ behavior, simBehavior }: { behavior: BaseKind; simBehavior?: string }) {
  const g = COMPONENT_GUIDE[behavior];
  const [open, setOpen] = useState(false);
  if (!g) return null;
  return (
    <section className="rounded-xl border border-brand-blue/25 bg-brand-blue/[0.05]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-2 p-3 text-left">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold">In plain words</span>
          <span className={cn("block text-[12.5px] leading-snug text-muted-foreground", !open && "line-clamp-2")}>
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
          {simBehavior && (
            <p className="text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">In the simulator: </span>
              {simBehavior}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
