/**
 * One 2D diagram per lesson: what is actually happening, drawn as components, links and notes.
 * Coordinates are in a 720-wide canvas; links with `flow` show requests moving.
 */
export type Tone = "blue" | "cyan" | "violet" | "ok" | "warn" | "crit" | "muted";

export interface DiagramNode {
  id: string;
  x: number;
  y: number;
  label: string;
  sub?: string;
  tone?: Tone;
  shape?: "box" | "db" | "queue" | "client" | "circle" | "dot";
  w?: number;
  h?: number;
  /** Filled with the tone (for the thing the lesson is about). */
  solid?: boolean;
  emphasis?: boolean;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  tone?: Tone;
  dashed?: boolean;
  /** Number of moving request dots (0 = static link). */
  flow?: number;
  /** Seconds per trip for the dots. */
  dur?: number;
  /** Curve: sideways offset of the midpoint, in px (sign picks the side). */
  bend?: number;
  noArrow?: boolean;
  both?: boolean;
}

export interface Diagram {
  w: number;
  h: number;
  caption: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  notes?: { x: number; y: number; text: string; tone?: Tone; anchor?: "start" | "middle" | "end"; size?: number; bold?: boolean }[];
  zones?: { x: number; y: number; w: number; h: number; label: string; tone?: Tone }[];
  rings?: { cx: number; cy: number; r: number }[];
  /** Dashed dividers, e.g. a network partition. */
  lines?: { x1: number; y1: number; x2: number; y2: number; label?: string; tone?: Tone }[];
}

const W = 720;

export const LESSON_DIAGRAMS: Record<string, Diagram> = {
  "request-path": {
    w: W,
    h: 300,
    caption: "A request resolves the name (usually from cache), enters through the load balancer, lands on any stateless app server, and reads or writes the database. Latency adds up hop by hop.",
    nodes: [
      { id: "user", x: 70, y: 160, label: "User", sub: "browser", tone: "violet", shape: "client", w: 100 },
      { id: "dns", x: 220, y: 52, label: "DNS", sub: "cached", tone: "muted", w: 100 },
      { id: "lb", x: 250, y: 160, label: "Load balancer", sub: "+1 ms", w: 128 },
      { id: "a1", x: 440, y: 80, label: "App server", sub: "stateless" },
      { id: "a2", x: 440, y: 160, label: "App server", sub: "stateless" },
      { id: "a3", x: 440, y: 240, label: "App server", sub: "unhealthy", tone: "crit" },
      { id: "db", x: 628, y: 160, label: "Database", sub: "+8 ms", tone: "ok", shape: "db", w: 112, h: 62 },
    ],
    edges: [
      { from: "user", to: "dns", label: "1 · resolve", dashed: true, bend: -10 },
      { from: "user", to: "lb", label: "2 · HTTPS", flow: 2 },
      { from: "lb", to: "a1", flow: 1 },
      { from: "lb", to: "a2", flow: 1 },
      { from: "lb", to: "a3", tone: "crit", dashed: true, label: "skipped" },
      { from: "a1", to: "db", flow: 1 },
      { from: "a2", to: "db", flow: 1 },
    ],
    notes: [{ x: 628, y: 220, text: "Usually the first to run out", tone: "crit" }],
  },

  estimation: {
    w: W,
    h: 250,
    caption: "Start from product numbers and multiply your way to servers. Each step is rough on purpose: you only need the right order of magnitude.",
    nodes: [
      { id: "u", x: 85, y: 70, label: "10M users", sub: "daily active", tone: "violet", w: 130 },
      { id: "a", x: 265, y: 70, label: "× 20 actions", sub: "per user per day", tone: "muted", w: 140 },
      { id: "d", x: 450, y: 70, label: "200M / day", sub: "requests", w: 130 },
      { id: "s", x: 630, y: 70, label: "÷ 86,400 s", sub: "≈ 2,300 req/s avg", tone: "muted", w: 140 },
      { id: "p", x: 160, y: 185, label: "× 3 at peak", sub: "≈ 7,000 req/s", tone: "warn", w: 140 },
      { id: "c", x: 375, y: 185, label: "÷ 1,500 × 0.8", sub: "per server, 80% max", tone: "muted", w: 150 },
      { id: "n", x: 590, y: 185, label: "≈ 6 servers", sub: "+1 spare = 7", tone: "ok", solid: true, w: 150 },
    ],
    edges: [
      { from: "u", to: "a" },
      { from: "a", to: "d" },
      { from: "d", to: "s" },
      { from: "s", to: "p", bend: -30 },
      { from: "p", to: "c" },
      { from: "c", to: "n" },
    ],
  },

  caching: {
    w: W,
    h: 290,
    caption: "Without a cache every read hits the database. With one, hot keys are answered from memory and only misses reach the database: at a 90% hit ratio, 10× less load.",
    zones: [
      { x: 12, y: 12, w: 300, h: 266, label: "Without cache", tone: "crit" },
      { x: 330, y: 12, w: 378, h: 266, label: "With cache · 90% hits", tone: "ok" },
    ],
    nodes: [
      { id: "app1", x: 90, y: 150, label: "App", sub: "5,000 reads/s", w: 120 },
      { id: "db1", x: 240, y: 150, label: "Database", sub: "500% busy", tone: "crit", shape: "db", w: 104, h: 62, emphasis: true },
      { id: "app2", x: 400, y: 150, label: "App", sub: "5,000 reads/s", w: 110 },
      { id: "cache", x: 550, y: 90, label: "Cache", sub: "4,500 hits/s", tone: "cyan", solid: true, w: 120 },
      { id: "db2", x: 620, y: 215, label: "Database", sub: "500 misses/s", tone: "ok", shape: "db", w: 110, h: 60 },
    ],
    edges: [
      { from: "app1", to: "db1", flow: 4, dur: 1.4, tone: "crit" },
      { from: "app2", to: "cache", flow: 3, dur: 1.4 },
      { from: "cache", to: "db2", label: "miss", dashed: true, flow: 1, dur: 2.6, tone: "ok" },
    ],
    notes: [{ x: 519, y: 268, text: "Hit ratio depends on how concentrated reads are", tone: "muted", size: 11 }],
  },

  indexes: {
    w: W,
    h: 300,
    caption: "Without an index the database reads every row to find a match. A B-tree index walks from the root to the right leaf in a few page reads. The price: every write updates the index too.",
    zones: [
      { x: 12, y: 12, w: 270, h: 276, label: "No index · full scan", tone: "crit" },
      { x: 300, y: 12, w: 408, h: 276, label: "B-tree index · 3 page reads", tone: "ok" },
    ],
    nodes: [
      { id: "q1", x: 147, y: 60, label: "WHERE email = ?", tone: "muted", w: 150, h: 30 },
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: `r${i}`, x: 147, y: 102 + i * 28, label: i === 4 ? "row 4,812,003 ✓" : `row ${((i + 1) * 812_000).toLocaleString("en-US")}`, tone: (i === 4 ? "ok" : "crit") as Tone, w: 170, h: 22 })),
      { id: "root", x: 505, y: 70, label: "root", sub: "a … z", w: 110 },
      { id: "b1", x: 405, y: 150, label: "a … m", w: 90, h: 34 },
      { id: "b2", x: 605, y: 150, label: "n … z", w: 90, h: 34 },
      { id: "leaf", x: 350, y: 228, label: "leaf: jo…", w: 96, h: 32 },
      { id: "leaf2", x: 465, y: 228, label: "leaf: ka…", tone: "muted", w: 96, h: 32 },
      { id: "row", x: 610, y: 238, label: "row 4,812,003", tone: "ok", solid: true, w: 140, h: 34 },
    ],
    edges: [
      { from: "q1", to: "r0", flow: 0 },
      { from: "root", to: "b1", flow: 1, tone: "ok" },
      { from: "root", to: "b2", tone: "muted" },
      { from: "b1", to: "leaf", flow: 1, tone: "ok" },
      { from: "b1", to: "leaf2", tone: "muted" },
      { from: "leaf", to: "row", flow: 1, tone: "ok", bend: 45 },
    ],
    notes: [{ x: 147, y: 280, text: "Reads ~5 million rows", tone: "crit" }],
  },

  "replication-sharding": {
    w: W,
    h: 300,
    caption: "Replicas copy all of the data, so they add read capacity but every write still goes to one primary. Shards split the data by key, so each node takes only its share of the writes.",
    zones: [
      { x: 12, y: 12, w: 340, h: 276, label: "Replication · more reads", tone: "blue" },
      { x: 368, y: 12, w: 340, h: 276, label: "Sharding · more writes", tone: "violet" },
    ],
    nodes: [
      { id: "w", x: 80, y: 70, label: "Writes", tone: "warn", shape: "client", w: 90 },
      { id: "r", x: 80, y: 220, label: "Reads", tone: "blue", shape: "client", w: 90 },
      { id: "p", x: 230, y: 70, label: "Primary", sub: "all writes", tone: "warn", shape: "db", w: 110, h: 58 },
      { id: "rep1", x: 200, y: 215, label: "Replica", shape: "db", w: 92, h: 54 },
      { id: "rep2", x: 300, y: 215, label: "Replica", shape: "db", w: 92, h: 54 },
      { id: "router", x: 538, y: 70, label: "Router", sub: "hash(user_id)", tone: "violet", w: 130 },
      { id: "s1", x: 438, y: 215, label: "Shard A", sub: "users a–h", tone: "violet", shape: "db", w: 96, h: 58 },
      { id: "s2", x: 538, y: 215, label: "Shard B", sub: "users i–p", tone: "violet", shape: "db", w: 96, h: 58 },
      { id: "s3", x: 638, y: 215, label: "Shard C", sub: "users q–z", tone: "violet", shape: "db", w: 96, h: 58 },
    ],
    edges: [
      { from: "w", to: "p", flow: 1, tone: "warn" },
      { from: "p", to: "rep1", label: "copy", dashed: true, tone: "muted" },
      { from: "p", to: "rep2", dashed: true, tone: "muted" },
      { from: "r", to: "rep1", flow: 2 },
      { from: "router", to: "s1", flow: 1, tone: "violet" },
      { from: "router", to: "s2", flow: 1, tone: "violet" },
      { from: "router", to: "s3", flow: 1, tone: "violet" },
    ],
  },

  "cdn-edge": {
    w: W,
    h: 300,
    caption: "Users fetch images and scripts from the edge location nearest them (a few ms away). Only cache misses travel to your origin, so most static traffic never touches your servers.",
    nodes: [
      { id: "u1", x: 80, y: 60, label: "User · Tokyo", tone: "violet", shape: "client", w: 128 },
      { id: "u2", x: 80, y: 150, label: "User · London", tone: "violet", shape: "client", w: 128 },
      { id: "u3", x: 80, y: 240, label: "User · New York", tone: "violet", shape: "client", w: 128 },
      { id: "e1", x: 290, y: 60, label: "Edge · Tokyo", sub: "hit", tone: "cyan" },
      { id: "e2", x: 290, y: 150, label: "Edge · London", sub: "hit", tone: "cyan" },
      { id: "e3", x: 290, y: 240, label: "Edge · New York", sub: "miss", tone: "cyan", w: 132 },
      { id: "o", x: 600, y: 150, label: "Origin", sub: "your app + storage", tone: "blue", w: 150, h: 58 },
    ],
    edges: [
      { from: "u1", to: "e1", label: "~10 ms", flow: 2, dur: 1 },
      { from: "u2", to: "e2", label: "~10 ms", flow: 2, dur: 1 },
      { from: "u3", to: "e3", label: "~10 ms", flow: 2, dur: 1 },
      { from: "e3", to: "o", label: "miss only · ~150 ms", dashed: true, flow: 1, dur: 3 },
      { from: "e1", to: "o", dashed: true, tone: "muted", noArrow: true },
      { from: "e2", to: "o", dashed: true, tone: "muted", noArrow: true },
    ],
  },

  queues: {
    w: W,
    h: 270,
    caption: "The API puts the slow work on a queue and answers right away. Workers pull jobs at their own pace, so a spike just makes the queue longer for a while instead of failing requests.",
    nodes: [
      { id: "c", x: 70, y: 120, label: "Client", tone: "violet", shape: "client", w: 100 },
      { id: "api", x: 230, y: 120, label: "API", sub: "202 in 5 ms" },
      { id: "q", x: 410, y: 120, label: "Queue", sub: "1,200 waiting", tone: "warn", shape: "queue", w: 140, h: 50 },
      { id: "w1", x: 600, y: 60, label: "Worker", sub: "send email", tone: "ok" },
      { id: "w2", x: 600, y: 180, label: "Worker", sub: "resize image", tone: "ok" },
    ],
    edges: [
      { from: "c", to: "api", flow: 3, dur: 1 },
      { from: "api", to: "c", label: "accepted", bend: 34, tone: "ok" },
      { from: "api", to: "q", flow: 3, dur: 1 },
      { from: "q", to: "w1", flow: 1, dur: 2.4 },
      { from: "q", to: "w2", flow: 1, dur: 2.4 },
    ],
    notes: [
      { x: 230, y: 240, text: "User waits only for this part", tone: "ok" },
      { x: 520, y: 248, text: "Add workers to drain faster", tone: "muted" },
    ],
  },

  "gateways-rate-limits": {
    w: W,
    h: 300,
    caption: "Every request enters through one gateway that terminates TLS, checks who is calling, applies rate limits and routes by path. Bad requests die there, cheaply, before reaching any service.",
    nodes: [
      { id: "good", x: 75, y: 95, label: "App users", tone: "violet", shape: "client", w: 110 },
      { id: "bad", x: 75, y: 215, label: "Scraper", sub: "900 req/s", tone: "crit", shape: "client", w: 110, h: 46 },
      { id: "gw", x: 300, y: 150, label: "Gateway", sub: "TLS · auth · limits", tone: "blue", solid: true, w: 150, h: 64 },
      { id: "s1", x: 560, y: 60, label: "/users", sub: "user service" },
      { id: "s2", x: 560, y: 150, label: "/orders", sub: "order service" },
      { id: "s3", x: 560, y: 240, label: "/search", sub: "search service" },
      { id: "rej", x: 300, y: 262, label: "429 Too Many Requests", tone: "crit", w: 184, h: 32 },
    ],
    edges: [
      { from: "good", to: "gw", flow: 2 },
      { from: "bad", to: "gw", flow: 3, dur: 1, tone: "crit" },
      { from: "gw", to: "rej", tone: "crit", dashed: true },
      { from: "gw", to: "s1", flow: 1 },
      { from: "gw", to: "s2", flow: 1 },
      { from: "gw", to: "s3", flow: 1 },
    ],
  },

  locks: {
    w: W,
    h: 300,
    caption: "Two servers check that seat 12A is free at the same moment, both see yes, and both book it. A lock makes check-then-write a single step: the second server waits, then sees the seat is taken.",
    zones: [
      { x: 12, y: 12, w: 340, h: 276, label: "No lock · double booking", tone: "crit" },
      { x: 368, y: 12, w: 340, h: 276, label: "With a lock", tone: "ok" },
    ],
    nodes: [
      { id: "a", x: 90, y: 75, label: "Server A", sub: "12A free? yes" },
      { id: "b", x: 90, y: 215, label: "Server B", sub: "12A free? yes" },
      { id: "db", x: 270, y: 145, label: "Seats DB", sub: "12A → A, then B", tone: "crit", shape: "db", w: 128, h: 66, emphasis: true },
      { id: "a2", x: 440, y: 75, label: "Server A", sub: "holds lock", tone: "ok" },
      { id: "b2", x: 440, y: 215, label: "Server B", sub: "waits…", tone: "warn" },
      { id: "lock", x: 560, y: 145, label: "Lock 12A", tone: "warn", solid: true, w: 96, h: 38 },
      { id: "db2", x: 640, y: 60, label: "Seats DB", sub: "12A → A", tone: "ok", shape: "db", w: 104, h: 58 },
    ],
    edges: [
      { from: "a", to: "db", label: "book", flow: 1, tone: "crit" },
      { from: "b", to: "db", label: "book", flow: 1, tone: "crit" },
      { from: "a2", to: "lock", label: "acquire", tone: "ok", flow: 1 },
      { from: "b2", to: "lock", label: "blocked", tone: "warn", dashed: true },
      { from: "a2", to: "db2", label: "book", tone: "ok", flow: 1, bend: -18 },
    ],
  },

  quorum: {
    w: W,
    h: 300,
    caption: "A five-node cluster splits 3 | 2. The side with a majority (3 of 5) keeps a leader and accepts writes; the minority side can't, so the two halves never disagree.",
    nodes: [
      { id: "n1", x: 170, y: 70, label: "N1", tone: "ok", shape: "circle", solid: true },
      { id: "n2", x: 95, y: 155, label: "N2", tone: "ok", shape: "circle" },
      { id: "n3", x: 170, y: 240, label: "N3", tone: "ok", shape: "circle" },
      { id: "n4", x: 500, y: 100, label: "N4", tone: "warn", shape: "circle" },
      { id: "n5", x: 500, y: 210, label: "N5", tone: "warn", shape: "circle" },
    ],
    edges: [
      { from: "n1", to: "n2", tone: "ok", both: true },
      { from: "n1", to: "n3", tone: "ok", both: true },
      { from: "n2", to: "n3", tone: "ok", both: true },
      { from: "n4", to: "n5", tone: "warn", both: true },
    ],
    lines: [{ x1: 345, y1: 30, x2: 345, y2: 262, label: "network split", tone: "crit" }],
    notes: [
      { x: 235, y: 75, text: "Leader", tone: "ok", anchor: "start", bold: true },
      { x: 170, y: 290, text: "3 of 5 = majority · keeps writing", tone: "ok", bold: true },
      { x: 560, y: 160, text: "2 of 5 · no majority", tone: "warn", anchor: "start", bold: true },
      { x: 560, y: 178, text: "can't elect a leader", tone: "warn", anchor: "start" },
    ],
  },

  requirements: {
    w: W,
    h: 310,
    caption: "Functional requirements say what the product does; non-functional ones put numbers on how well. Every component in the design should trace back to one of them.",
    zones: [
      { x: 12, y: 12, w: 220, h: 286, label: "Functional · what", tone: "blue" },
      { x: 250, y: 12, w: 220, h: 286, label: "Non-functional · how well", tone: "violet" },
      { x: 488, y: 12, w: 220, h: 286, label: "Drives the design", tone: "ok" },
    ],
    nodes: [
      { id: "f1", x: 122, y: 160, label: "Post a photo", w: 170 },
      { id: "f2", x: 122, y: 80, label: "See a feed", w: 170 },
      { id: "f3", x: 122, y: 240, label: "Follow people", w: 170 },
      { id: "n1", x: 360, y: 80, label: "p99 < 200 ms", tone: "violet", w: 170 },
      { id: "n2", x: 360, y: 160, label: "99.9% available", tone: "violet", w: 170 },
      { id: "n3", x: 360, y: 240, label: "≤ $2,000 / month", tone: "violet", w: 170 },
      { id: "d1", x: 598, y: 80, label: "Cache + CDN", tone: "ok", w: 170 },
      { id: "d2", x: 598, y: 160, label: "2+ of everything", tone: "ok", w: 170 },
      { id: "d3", x: 598, y: 240, label: "Right-sized replicas", tone: "ok", w: 170 },
    ],
    edges: [
      { from: "f2", to: "n1", tone: "muted" },
      { from: "f1", to: "n2", tone: "muted", dashed: true },
      { from: "n1", to: "d1", tone: "ok" },
      { from: "n2", to: "d2", tone: "ok" },
      { from: "n3", to: "d3", tone: "ok" },
    ],
  },

  "fan-out": {
    w: W,
    h: 300,
    caption: "Push builds every follower's feed when a post is written, so reads are instant. Pull assembles the feed when it's read. Big accounts break push (millions of writes per post), so mix them.",
    zones: [
      { x: 12, y: 12, w: 340, h: 276, label: "Fan-out on write · push", tone: "blue" },
      { x: 368, y: 12, w: 340, h: 276, label: "Fan-out on read · pull", tone: "violet" },
    ],
    nodes: [
      { id: "author", x: 80, y: 150, label: "Author", sub: "posts", tone: "violet", shape: "client", w: 100, h: 46 },
      { id: "fs", x: 190, y: 150, label: "Fan-out", w: 90 },
      { id: "f1", x: 300, y: 70, label: "Feed", sub: "follower 1", tone: "cyan", w: 88 },
      { id: "f2", x: 300, y: 150, label: "Feed", sub: "follower 2", tone: "cyan", w: 88 },
      { id: "f3", x: 300, y: 230, label: "Feed", sub: "follower 3", tone: "cyan", w: 88 },
      { id: "reader", x: 430, y: 150, label: "Reader", sub: "opens app", tone: "violet", shape: "client", w: 100, h: 46 },
      { id: "fs2", x: 545, y: 150, label: "Feed svc", w: 92 },
      { id: "p1", x: 655, y: 70, label: "Posts", sub: "author A", tone: "muted", w: 88 },
      { id: "p2", x: 655, y: 150, label: "Posts", sub: "author B", tone: "muted", w: 88 },
      { id: "p3", x: 655, y: 230, label: "Posts", sub: "author C", tone: "muted", w: 88 },
    ],
    edges: [
      { from: "author", to: "fs", flow: 1 },
      { from: "fs", to: "f1", flow: 1 },
      { from: "fs", to: "f2", flow: 1 },
      { from: "fs", to: "f3", flow: 1 },
      { from: "reader", to: "fs2", flow: 1 },
      { from: "fs2", to: "p1", flow: 1, tone: "violet" },
      { from: "fs2", to: "p2", flow: 1, tone: "violet" },
      { from: "fs2", to: "p3", flow: 1, tone: "violet" },
    ],
    notes: [
      { x: 182, y: 282, text: "Fast reads · slow, costly writes", tone: "blue" },
      { x: 538, y: 282, text: "Cheap writes · slower reads", tone: "violet" },
    ],
  },

  idempotency: {
    w: W,
    h: 290,
    caption: "The charge succeeds but the response is lost, so the client retries with the same idempotency key. The server recognises the key and returns the first result instead of charging again.",
    nodes: [
      { id: "c", x: 70, y: 130, label: "Client", tone: "violet", shape: "client", w: 100 },
      { id: "api", x: 400, y: 130, label: "Payments API", sub: "checks key first", w: 150, h: 54 },
      { id: "keys", x: 400, y: 250, label: "Key store", sub: "abc → charge #81", tone: "ok", shape: "db", w: 150, h: 56 },
      { id: "bank", x: 630, y: 130, label: "Card network", sub: "charged once", tone: "ok", w: 140 },
    ],
    edges: [
      { from: "c", to: "api", label: "1 · charge, key=abc", bend: -110, flow: 1 },
      { from: "api", to: "c", label: "2 · response lost", tone: "crit", dashed: true },
      { from: "c", to: "api", label: "3 · retry, key=abc", bend: 110, flow: 1, tone: "ok" },
      { from: "api", to: "bank", label: "once", flow: 1, tone: "ok" },
      { from: "api", to: "keys", both: true, tone: "ok" },
    ],
  },

  consistency: {
    w: W,
    h: 280,
    caption: "A write lands on the primary and reaches the replica a moment later. A reader on the replica during that gap sees the old value: fine for a like count, not for a bank balance.",
    nodes: [
      { id: "writer", x: 80, y: 70, label: "Writer", sub: "price = $10", tone: "violet", shape: "client", w: 120, h: 46 },
      { id: "p", x: 330, y: 70, label: "Primary", sub: "$10", tone: "ok", shape: "db", w: 120, h: 60 },
      { id: "r", x: 330, y: 210, label: "Replica", sub: "still $9", tone: "warn", shape: "db", w: 120, h: 60 },
      { id: "reader", x: 600, y: 210, label: "Reader", sub: "sees $9", tone: "warn", shape: "client", w: 120, h: 46 },
      { id: "reader2", x: 600, y: 70, label: "Strong read", sub: "sees $10", tone: "ok", shape: "client", w: 130, h: 46 },
    ],
    edges: [
      { from: "writer", to: "p", flow: 1 },
      { from: "p", to: "r", label: "replication lag · 200 ms", dashed: true, flow: 1, dur: 3.2, tone: "warn" },
      { from: "reader", to: "r", flow: 1, tone: "warn" },
      { from: "reader2", to: "p", flow: 1, tone: "ok" },
    ],
  },

  "consistent-hashing": {
    w: W,
    h: 320,
    caption: "Nodes and keys sit on a ring; each key belongs to the next node clockwise. Adding node E only moves the keys between D and E. With hash mod N, almost every key would move.",
    rings: [{ cx: 230, cy: 160, r: 110 }],
    nodes: [
      { id: "A", x: 230, y: 50, label: "A", shape: "circle", solid: true, w: 42 },
      { id: "B", x: 340, y: 160, label: "B", shape: "circle", solid: true, w: 42 },
      { id: "C", x: 230, y: 270, label: "C", shape: "circle", solid: true, w: 42 },
      { id: "D", x: 120, y: 160, label: "D", shape: "circle", solid: true, w: 42 },
      { id: "E", x: 152, y: 82, label: "E", tone: "ok", shape: "circle", solid: true, w: 42, emphasis: true },
      { id: "k1", x: 308, y: 82, label: "k1", tone: "muted", shape: "dot", w: 12 },
      { id: "k2", x: 308, y: 238, label: "k2", tone: "muted", shape: "dot", w: 12 },
      { id: "k3", x: 152, y: 238, label: "k3", tone: "muted", shape: "dot", w: 12 },
      { id: "k4", x: 135, y: 105, label: "k4", tone: "ok", shape: "dot", w: 12 },
    ],
    edges: [],
    notes: [
      { x: 430, y: 90, text: "Each key goes to the next node clockwise.", anchor: "start", tone: "muted" },
      { x: 430, y: 128, text: "New node E joins between D and A:", anchor: "start", tone: "ok", bold: true },
      { x: 430, y: 148, text: "only keys in that arc (k4) move to E.", anchor: "start", tone: "ok" },
      { x: 430, y: 196, text: "hash(key) mod N with N 4 → 5:", anchor: "start", tone: "crit", bold: true },
      { x: 430, y: 216, text: "about 80% of keys move at once.", anchor: "start", tone: "crit" },
    ],
  },

  "hot-keys": {
    w: W,
    h: 300,
    caption: "Data is spread evenly, but traffic isn't: one celebrity's key gets most of the reads, so one shard melts while the others idle. Cache hot reads, and split hot writes across sub-keys.",
    nodes: [
      { id: "r", x: 90, y: 150, label: "Router", sub: "hash(key)", w: 120 },
      { id: "s1", x: 330, y: 60, label: "Shard 1", sub: "8% busy", tone: "ok", shape: "db", w: 110, h: 56 },
      { id: "s2", x: 330, y: 160, label: "Shard 2", sub: "@celebrity · 310%", tone: "crit", shape: "db", w: 150, h: 60, emphasis: true },
      { id: "s3", x: 330, y: 255, label: "Shard 3", sub: "9% busy", tone: "ok", shape: "db", w: 110, h: 56 },
      { id: "cache", x: 590, y: 95, label: "Fix reads", sub: "cache + replicas", tone: "cyan", w: 150 },
      { id: "split", x: 590, y: 210, label: "Fix writes", sub: "key#1 … key#8", tone: "violet", w: 150 },
    ],
    edges: [
      { from: "r", to: "s1", flow: 1, dur: 3 },
      { from: "r", to: "s2", flow: 5, dur: 1, tone: "crit" },
      { from: "r", to: "s3", flow: 1, dur: 3 },
      { from: "s2", to: "cache", dashed: true, tone: "muted" },
      { from: "s2", to: "split", dashed: true, tone: "muted" },
    ],
  },

  "api-design": {
    w: W,
    h: 300,
    caption: "A predictable API: versioned paths, cursor pagination that stays stable while data changes, and an idempotency key on writes so a retried POST never creates a duplicate.",
    nodes: [
      { id: "c", x: 90, y: 150, label: "Client", sub: "retries on timeout", tone: "violet", shape: "client", w: 150, h: 46 },
      { id: "api", x: 560, y: 150, label: "API", sub: "/v1", tone: "blue", solid: true, w: 130, h: 60 },
    ],
    edges: [
      { from: "c", to: "api", label: "GET /v1/orders?cursor=abc&limit=50", bend: -150, flow: 1 },
      { from: "api", to: "c", label: "50 orders + next_cursor", bend: 50, tone: "ok" },
      { from: "c", to: "api", label: "POST /v1/orders · Idempotency-Key", bend: 50, flow: 1, tone: "warn" },
      { from: "api", to: "c", label: "201 · or the same order again", bend: -150, tone: "ok" },
    ],
  },

  realtime: {
    w: W,
    h: 300,
    caption: "Gateways hold the long-lived WebSocket connections; the chat service saves each message and publishes it; pub/sub delivers it to whichever gateways hold the recipients' connections.",
    nodes: [
      { id: "u1", x: 70, y: 60, label: "Phone", tone: "violet", shape: "client", w: 96 },
      { id: "u2", x: 70, y: 130, label: "Laptop", tone: "violet", shape: "client", w: 96 },
      { id: "u3", x: 70, y: 200, label: "Phone", tone: "violet", shape: "client", w: 96 },
      { id: "u4", x: 70, y: 270, label: "Tablet", tone: "violet", shape: "client", w: 96 },
      { id: "g1", x: 240, y: 95, label: "Gateway", sub: "50k sockets", tone: "cyan" },
      { id: "g2", x: 240, y: 235, label: "Gateway", sub: "50k sockets", tone: "cyan" },
      { id: "ps", x: 430, y: 165, label: "Pub/sub", sub: "room:42", tone: "warn", shape: "queue", w: 130, h: 50 },
      { id: "chat", x: 620, y: 95, label: "Chat service", w: 130 },
      { id: "db", x: 620, y: 240, label: "Messages", shape: "db", tone: "ok", w: 120, h: 58 },
    ],
    edges: [
      { from: "u1", to: "g1", tone: "cyan", noArrow: true },
      { from: "u2", to: "g1", tone: "cyan", noArrow: true },
      { from: "u3", to: "g2", tone: "cyan", noArrow: true },
      { from: "u4", to: "g2", tone: "cyan", noArrow: true },
      { from: "g1", to: "chat", label: "send", flow: 1, bend: -30 },
      { from: "chat", to: "db", label: "save", flow: 1 },
      { from: "chat", to: "ps", label: "publish", flow: 1 },
      { from: "ps", to: "g1", flow: 1, tone: "warn" },
      { from: "ps", to: "g2", flow: 1, tone: "warn" },
    ],
  },

  pubsub: {
    w: W,
    h: 280,
    caption: "The order service publishes one fact, 'OrderPlaced', and returns. Email, inventory and analytics each consume it independently; adding a fourth consumer needs no change to the order service.",
    nodes: [
      { id: "o", x: 90, y: 140, label: "Order service", sub: "returns at once", w: 140, h: 52 },
      { id: "t", x: 320, y: 140, label: "Topic", sub: "OrderPlaced", tone: "warn", shape: "queue", w: 140, h: 52 },
      { id: "c1", x: 590, y: 50, label: "Email", sub: "receipt", tone: "ok" },
      { id: "c2", x: 590, y: 140, label: "Inventory", sub: "reserve stock", tone: "ok" },
      { id: "c3", x: 590, y: 230, label: "Analytics", sub: "dashboards", tone: "ok" },
    ],
    edges: [
      { from: "o", to: "t", flow: 2 },
      { from: "t", to: "c1", flow: 1, tone: "ok" },
      { from: "t", to: "c2", flow: 1, tone: "ok" },
      { from: "t", to: "c3", flow: 1, tone: "ok" },
    ],
  },

  "sagas-outbox": {
    w: W,
    h: 320,
    caption: "A saga runs each service's local step in turn; if a later step fails, earlier ones are undone by compensating actions. The outbox saves the event in the same transaction as the data, so neither is lost.",
    zones: [
      { x: 12, y: 12, w: 696, h: 158, label: "Saga · local steps + compensations", tone: "blue" },
      { x: 12, y: 182, w: 696, h: 126, label: "Outbox · one transaction, then relay", tone: "ok" },
    ],
    nodes: [
      { id: "s1", x: 100, y: 68, label: "Create order", tone: "ok", w: 130 },
      { id: "s2", x: 280, y: 68, label: "Charge card", tone: "ok", w: 130 },
      { id: "s3", x: 460, y: 68, label: "Reserve stock", tone: "crit", sub: "fails", w: 130, h: 50 },
      { id: "s4", x: 630, y: 68, label: "Ship", tone: "muted", w: 110 },
      { id: "svc", x: 90, y: 250, label: "Service", w: 110 },
      { id: "tx", x: 300, y: 250, label: "One DB commit", sub: "order + outbox row", tone: "ok", shape: "db", w: 170, h: 60 },
      { id: "relay", x: 480, y: 250, label: "Relay", sub: "polls outbox", w: 120 },
      { id: "bus", x: 630, y: 250, label: "Queue", tone: "warn", shape: "queue", w: 110 },
    ],
    edges: [
      { from: "s1", to: "s2", flow: 1 },
      { from: "s2", to: "s3", flow: 1 },
      { from: "s3", to: "s4", dashed: true, tone: "muted" },
      { from: "s3", to: "s2", label: "refund", bend: -110, tone: "crit", dashed: true },
      { from: "s2", to: "s1", label: "cancel", bend: -110, tone: "crit", dashed: true },
      { from: "svc", to: "tx", flow: 1 },
      { from: "tx", to: "relay", flow: 1, tone: "ok" },
      { from: "relay", to: "bus", flow: 1, tone: "ok" },
    ],
  },

  "multi-region": {
    w: W,
    h: 300,
    caption: "Geo DNS sends each user to the nearest region. Each region serves on its own and replicates to the other asynchronously; if one region fails, DNS moves its users to the survivor.",
    nodes: [
      { id: "eu", x: 80, y: 80, label: "Users · EU", tone: "violet", shape: "client", w: 120 },
      { id: "us", x: 80, y: 220, label: "Users · US", tone: "violet", shape: "client", w: 120 },
      { id: "dns", x: 245, y: 150, label: "Geo DNS", sub: "health checks", tone: "muted", w: 120 },
      { id: "r1", x: 450, y: 80, label: "Region EU", sub: "app + database", tone: "blue", w: 150, h: 54 },
      { id: "r2", x: 450, y: 220, label: "Region US", sub: "app + database", tone: "blue", w: 150, h: 54 },
    ],
    edges: [
      { from: "eu", to: "r1", label: "~20 ms", flow: 2, bend: -20 },
      { from: "us", to: "r2", label: "~20 ms", flow: 2, bend: 20 },
      { from: "eu", to: "dns", dashed: true, tone: "muted" },
      { from: "us", to: "dns", dashed: true, tone: "muted" },
      { from: "r1", to: "r2", label: "async replication", dashed: true, both: true, tone: "warn", flow: 1, dur: 3 },
    ],
    notes: [
      { x: 560, y: 136, text: "RPO: data lost if a region dies", anchor: "start", tone: "warn", size: 11 },
      { x: 560, y: 156, text: "= replication lag (seconds)", anchor: "start", tone: "warn", size: 11 },
      { x: 560, y: 186, text: "RTO: time to fail over", anchor: "start", tone: "muted", size: 11 },
    ],
  },

  observability: {
    w: W,
    h: 300,
    caption: "The same service emits three signals. Metrics tell you something is wrong (and page you), logs tell you what happened, and traces show which hop in the request was slow.",
    nodes: [
      { id: "svc", x: 110, y: 150, label: "Service", sub: "checkout", w: 130, h: 56 },
      { id: "m", x: 360, y: 60, label: "Metrics", sub: "error rate 4% ↑", tone: "crit" },
      { id: "l", x: 360, y: 150, label: "Logs", sub: "timeout: payments", tone: "warn", w: 140 },
      { id: "t", x: 360, y: 240, label: "Traces", sub: "span: 2.1 s", tone: "violet" },
      { id: "alert", x: 600, y: 60, label: "Alert → on-call", tone: "crit", solid: true, w: 150 },
      { id: "q", x: 600, y: 150, label: "What happened?", tone: "warn", w: 150 },
      { id: "w", x: 600, y: 240, label: "Where is it slow?", tone: "violet", w: 150 },
    ],
    edges: [
      { from: "svc", to: "m", flow: 1, tone: "crit" },
      { from: "svc", to: "l", flow: 1, tone: "warn" },
      { from: "svc", to: "t", flow: 1, tone: "violet" },
      { from: "m", to: "alert", tone: "crit" },
      { from: "l", to: "q", tone: "warn" },
      { from: "t", to: "w", tone: "violet" },
    ],
  },

  security: {
    w: W,
    h: 290,
    caption: "Defence in depth: the edge drops floods and abusive clients, the gateway proves who is calling over TLS, the service checks they may do this, and data is encrypted at rest.",
    nodes: [
      { id: "user", x: 70, y: 95, label: "User", tone: "violet", shape: "client", w: 96 },
      { id: "atk", x: 70, y: 220, label: "Attacker", tone: "crit", shape: "client", w: 100 },
      { id: "waf", x: 230, y: 150, label: "WAF + limits", sub: "drop floods", tone: "warn", w: 130, h: 52 },
      { id: "gw", x: 390, y: 150, label: "Gateway", sub: "TLS · who are you?", tone: "blue", w: 140, h: 52 },
      { id: "svc", x: 545, y: 150, label: "Service", sub: "may you do this?", tone: "blue", w: 132, h: 52 },
      { id: "db", x: 660, y: 245, label: "Database", sub: "encrypted", tone: "ok", shape: "db", w: 110, h: 58 },
    ],
    edges: [
      { from: "user", to: "waf", flow: 1 },
      { from: "atk", to: "waf", flow: 2, dur: 1, tone: "crit" },
      { from: "waf", to: "gw", flow: 1 },
      { from: "gw", to: "svc", flow: 1 },
      { from: "svc", to: "db", flow: 1, tone: "ok" },
    ],
    notes: [{ x: 230, y: 205, text: "✕ blocked here", tone: "crit", bold: true }],
  },
  "blob-storage": {
    w: W,
    h: 300,
    caption: "The app only hands out a short-lived signed URL; the phone uploads the bytes straight to object storage. Storage fires an event for thumbnails, and a CDN serves the files back to everyone.",
    nodes: [
      { id: "phone", x: 70, y: 150, label: "Phone", sub: "8 MB photo", tone: "violet", shape: "client", w: 110, h: 46 },
      { id: "api", x: 270, y: 60, label: "API", sub: "metadata only" },
      { id: "db", x: 470, y: 60, label: "Database", sub: "owner, key, size", tone: "ok", shape: "db", w: 130, h: 56 },
      { id: "s3", x: 330, y: 220, label: "Object storage", sub: "the bytes", tone: "cyan", solid: true, w: 150, h: 54 },
      { id: "worker", x: 560, y: 160, label: "Thumbnailer", sub: "on upload event", tone: "warn", w: 140 },
      { id: "cdn", x: 600, y: 260, label: "CDN", sub: "serves views", tone: "cyan", w: 110 },
    ],
    edges: [
      { from: "phone", to: "api", label: "1 · ask for URL", flow: 1, bend: -20 },
      { from: "api", to: "db", flow: 1, tone: "ok" },
      { from: "phone", to: "s3", label: "2 · PUT bytes", flow: 2, dur: 1.6, tone: "cyan" },
      { from: "s3", to: "worker", label: "3 · event", dashed: true, flow: 1, tone: "warn" },
      { from: "s3", to: "cdn", flow: 1, tone: "cyan" },
    ],
  },

  "storage-engines": {
    w: W,
    h: 310,
    caption: "A B-tree finds the right page and rewrites it in place. An LSM tree appends to memory and a log, flushes sorted files, and merges them later, which turns random writes into fast sequential ones.",
    zones: [
      { x: 12, y: 12, w: 300, h: 286, label: "B-tree · update in place", tone: "blue" },
      { x: 330, y: 12, w: 378, h: 286, label: "LSM tree · append, then merge", tone: "violet" },
    ],
    nodes: [
      { id: "w1", x: 162, y: 62, label: "write k=42", tone: "muted", w: 120, h: 32 },
      { id: "root", x: 162, y: 125, label: "root page", w: 120, h: 36 },
      { id: "p1", x: 92, y: 200, label: "page", tone: "muted", w: 80, h: 34 },
      { id: "p2", x: 232, y: 200, label: "page 42 ✎", tone: "ok", w: 100, h: 34, emphasis: true },
      { id: "w2", x: 420, y: 62, label: "write k=42", tone: "muted", w: 120, h: 32 },
      { id: "mem", x: 420, y: 140, label: "Memtable", sub: "in memory", tone: "violet", w: 120 },
      { id: "wal", x: 600, y: 62, label: "Log", sub: "append-only", tone: "muted", shape: "queue", w: 120, h: 44 },
      { id: "sst1", x: 400, y: 240, label: "SST 1", tone: "violet", w: 70, h: 34 },
      { id: "sst2", x: 480, y: 240, label: "SST 2", tone: "violet", w: 70, h: 34 },
      { id: "merged", x: 630, y: 240, label: "Merged SST", tone: "ok", w: 120, h: 38 },
    ],
    edges: [
      { from: "w1", to: "root", flow: 1 },
      { from: "root", to: "p2", flow: 1, tone: "ok" },
      { from: "root", to: "p1", tone: "muted" },
      { from: "w2", to: "mem", flow: 2, dur: 1.2, tone: "violet" },
      { from: "w2", to: "wal", flow: 1, tone: "muted" },
      { from: "mem", to: "sst2", label: "flush", tone: "violet" },
      { from: "sst2", to: "merged", label: "compact", dashed: true, tone: "ok" },
    ],
    notes: [
      { x: 162, y: 270, text: "Fast reads · random writes", tone: "blue" },
      { x: 519, y: 288, text: "Very fast writes · reads check a few files", tone: "violet" },
    ],
  },

  "search-indexes": {
    w: W,
    h: 290,
    caption: "Each word points to the documents that contain it. The query 'red shoes' fetches two short lists and intersects them, instead of reading every document.",
    nodes: [
      { id: "q", x: 85, y: 145, label: "red shoes", sub: "query", tone: "violet", shape: "client", w: 130, h: 46 },
      { id: "t1", x: 300, y: 70, label: "red", sub: "→ 3, 8, 14, 21", tone: "blue", w: 150 },
      { id: "t2", x: 300, y: 145, label: "shoe", sub: "→ 8, 9, 21, 40", tone: "blue", w: 150 },
      { id: "t3", x: 300, y: 220, label: "blue", sub: "→ 2, 9, 40", tone: "muted", w: 150 },
      { id: "and", x: 490, y: 145, label: "intersect", sub: "8, 21", tone: "warn", w: 120 },
      { id: "res", x: 640, y: 145, label: "Ranked", sub: "#21, #8", tone: "ok", solid: true, w: 110 },
    ],
    edges: [
      { from: "q", to: "t1", flow: 1 },
      { from: "q", to: "t2", flow: 1 },
      { from: "t1", to: "and", flow: 1, tone: "warn" },
      { from: "t2", to: "and", flow: 1, tone: "warn" },
      { from: "and", to: "res", flow: 1, tone: "ok" },
    ],
    notes: [{ x: 300, y: 275, text: "Inverted index: word → document ids", tone: "muted" }],
  },

  backpressure: {
    w: W,
    h: 300,
    caption: "Without limits, the queue grows until every request is too slow to be useful. With a bounded queue, low-priority work is shed early and the rest stays fast.",
    zones: [
      { x: 12, y: 12, w: 340, h: 276, label: "Unbounded · everyone times out", tone: "crit" },
      { x: 368, y: 12, w: 340, h: 276, label: "Bounded + shedding", tone: "ok" },
    ],
    nodes: [
      { id: "in1", x: 100, y: 80, label: "3,000 req/s in", tone: "violet", shape: "client", w: 140 },
      { id: "q1", x: 182, y: 160, label: "Queue", sub: "200k · 70 s wait", tone: "crit", shape: "queue", w: 160, h: 50 },
      { id: "s1", x: 262, y: 245, label: "1,000 req/s", sub: "served too late", tone: "crit", w: 140, h: 46 },
      { id: "in2", x: 435, y: 100, label: "Checkout", tone: "violet", shape: "client", w: 100 },
      { id: "in3", x: 435, y: 205, label: "Recommend", tone: "muted", shape: "client", w: 110 },
      { id: "q2", x: 560, y: 100, label: "Queue", sub: "max 500", tone: "ok", shape: "queue", w: 100, h: 48 },
      { id: "s2", x: 660, y: 100, label: "Served", sub: "fast", tone: "ok", w: 72, h: 46 },
      { id: "shed", x: 590, y: 220, label: "503 · shed", tone: "warn", w: 110, h: 36 },
    ],
    edges: [
      { from: "in1", to: "q1", flow: 4, dur: 0.8, tone: "crit" },
      { from: "q1", to: "s1", flow: 1, dur: 2.4, tone: "crit" },
      { from: "in2", to: "q2", flow: 2, dur: 1.2 },
      { from: "q2", to: "s2", flow: 2, dur: 1.2, tone: "ok" },
      { from: "in3", to: "shed", flow: 2, dur: 1, tone: "warn" },
    ],
  },

  "leader-election": {
    w: W,
    h: 300,
    caption: "Schedulers race for a lease in etcd; the winner leads while it keeps renewing. When it stops, the lease expires and another takes over with a higher fencing token, so the old leader's late writes are rejected.",
    nodes: [
      { id: "a", x: 90, y: 70, label: "Scheduler A", sub: "leader · token 7", tone: "ok", solid: true, w: 150, h: 50 },
      { id: "b", x: 90, y: 160, label: "Scheduler B", sub: "standby", tone: "muted", w: 150 },
      { id: "c", x: 90, y: 250, label: "Scheduler C", sub: "standby", tone: "muted", w: 150 },
      { id: "etcd", x: 360, y: 160, label: "etcd lease", sub: "expires in 10 s", tone: "warn", w: 150, h: 56 },
      { id: "store", x: 610, y: 160, label: "Job store", sub: "accepts token ≥ 7", tone: "blue", shape: "db", w: 150, h: 60 },
    ],
    edges: [
      { from: "a", to: "etcd", label: "renew every 3 s", flow: 1, tone: "ok" },
      { from: "b", to: "etcd", label: "waiting", dashed: true, tone: "muted" },
      { from: "c", to: "etcd", dashed: true, tone: "muted" },
      { from: "a", to: "store", label: "write with token 7", bend: -60, flow: 1, tone: "ok" },
    ],
    notes: [{ x: 360, y: 280, text: "Lease lapses → B leads with token 8; A's writes are refused", tone: "warn" }],
  },

  "geo-indexing": {
    w: W,
    h: 310,
    caption: "The map is divided into cells. To find nearby drivers, look up the rider's cell and its eight neighbours, then filter those few candidates by real distance.",
    nodes: [
      ...[0, 1, 2, 3, 4].flatMap((r) =>
        [0, 1, 2, 3, 4].map((c) => {
          const near = Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1;
          return { id: `c${r}${c}`, x: 70 + c * 66, y: 40 + r * 56, label: "", tone: (near ? (r === 2 && c === 2 ? "blue" : "cyan") : "muted") as Tone, w: 62, h: 52 };
        }),
      ),
      { id: "rider", x: 202, y: 152, label: "", tone: "violet", shape: "dot", w: 14 },
      { id: "d1", x: 168, y: 120, label: "", tone: "ok", shape: "dot", w: 10 },
      { id: "d2", x: 248, y: 196, label: "", tone: "ok", shape: "dot", w: 10 },
      { id: "d3", x: 140, y: 186, label: "", tone: "ok", shape: "dot", w: 10 },
      { id: "d4", x: 320, y: 60, label: "", tone: "muted", shape: "dot", w: 10 },
      { id: "d5", x: 76, y: 270, label: "", tone: "muted", shape: "dot", w: 10 },
    ],
    edges: [],
    notes: [
      { x: 420, y: 90, text: "1 · rider's cell: 9q8yy", anchor: "start", tone: "blue", bold: true },
      { x: 420, y: 125, text: "2 · plus its 8 neighbours (a driver", anchor: "start", tone: "cyan" },
      { x: 420, y: 143, text: "    can be just across an edge)", anchor: "start", tone: "cyan" },
      { x: 420, y: 178, text: "3 · filter 3 candidates by distance", anchor: "start", tone: "ok" },
      { x: 420, y: 213, text: "Grey drivers are never even read.", anchor: "start", tone: "muted" },
    ],
  },

  "bloom-filters": {
    w: W,
    h: 290,
    caption: "Three hash functions set three bits per URL. Checking a new URL: any 0 bit means 'definitely not seen', skipping the expensive lookup; all 1s means 'probably seen'.",
    nodes: [
      { id: "u1", x: 90, y: 60, label: "a.com/x", sub: "add", tone: "blue", shape: "client", w: 120, h: 46 },
      { id: "u2", x: 90, y: 240, label: "b.com/y", sub: "check", tone: "violet", shape: "client", w: 120, h: 46 },
      ...Array.from({ length: 12 }, (_, i) => {
        const set = [1, 4, 9].includes(i);
        const probe = [4, 6, 10].includes(i);
        return { id: `b${i}`, x: 220 + i * 40, y: 150, label: set ? "1" : "0", tone: (set ? "blue" : probe ? "crit" : "muted") as Tone, w: 34, h: 38, emphasis: probe && !set };
      }),
    ],
    edges: [
      { from: "u1", to: "b1", tone: "blue", flow: 1 },
      { from: "u1", to: "b4", tone: "blue", flow: 1 },
      { from: "u1", to: "b9", tone: "blue", flow: 1 },
      { from: "u2", to: "b4", tone: "violet", dashed: true },
      { from: "u2", to: "b6", tone: "crit", dashed: true },
      { from: "u2", to: "b10", tone: "crit", dashed: true },
    ],
    notes: [
      { x: 470, y: 250, text: "Bit 6 is 0 → b.com/y was never added", tone: "crit", bold: true, anchor: "start" },
      { x: 470, y: 270, text: "skip the database lookup", tone: "crit", anchor: "start" },
    ],
  },
};
