/**
 * The learning path: every challenge and build problem, in six stages that build on each other.
 * The last problem in each stage is its checkpoint.
 */
export interface Stage {
  id: string;
  title: string;
  blurb: string;
  tags: string[];
  /** CSS colour token for the stage. */
  color: string;
  /** Problem ids (challenges or build problems), in order. */
  problems: string[];
}

export const ROADMAP: Stage[] = [
  {
    id: "foundations",
    title: "Foundations",
    blurb: "Read-heavy systems: take load off the database and survive a server going away.",
    tags: ["Request path", "Estimation", "Caching", "Redundancy", "Blob storage"],
    color: "var(--brand-blue)",
    problems: ["overloaded-database", "single-point-of-failure", "search-autocomplete", "pastebin", "url-shortener"],
  },
  {
    id: "data",
    title: "Scaling data",
    blurb: "When the database is the bottleneck: indexes, write scaling, and spending on what actually helps.",
    tags: ["Indexes", "Write scaling", "Replication", "Right-sizing"],
    color: "var(--brand-cyan)",
    problems: ["missing-index", "write-storm", "cache-that-didnt-help", "cloud-bill-shock"],
  },
  {
    id: "traffic",
    title: "Traffic & async",
    blurb: "Front doors, edges and queues: absorb spikes and move slow work off the request path.",
    tags: ["API gateways", "Rate limiting", "CDN", "Queues & workers", "Crawling"],
    color: "var(--status-ok)",
    problems: ["choked-front-door", "api-rate-limiter", "image-heavy-homepage", "inbox-never-drains", "web-crawler", "photo-sharing-launch", "flash-sale-checkout"],
  },
  {
    id: "coordination",
    title: "Coordination",
    blurb: "Correctness under contention: locks, quorums and extreme hot keys.",
    tags: ["Locks", "Consensus & quorum", "Hot keys", "Failure drills"],
    color: "var(--status-warn)",
    problems: ["double-booked-seats", "lost-quorum", "live-scoreboard", "concert-ticket-drop"],
  },
  {
    id: "products",
    title: "Case studies",
    blurb: "Design real products from a blank canvas, from requirements to a scored architecture.",
    tags: ["E-commerce", "Leaderboards", "Chat", "Notifications", "Streaming", "Booking", "Geo search", "Code judging"],
    color: "var(--brand-violet)",
    problems: ["shopping-app", "leaderboard", "chat-app", "notification-system", "video-streaming", "metrics-dashboard", "hotel-booking", "nearby-places", "online-judge"],
  },
  {
    id: "advanced",
    title: "Advanced",
    blurb: "The hard ones: fan-out at scale, realtime collaboration, geo matching, money and AI.",
    tags: ["Feed fan-out", "File sync", "Realtime collab", "Geo matching", "Partitioning", "Payments", "AI systems"],
    color: "var(--status-crit)",
    problems: ["social-feed", "file-storage", "collaborative-docs", "ride-hailing", "key-value-store", "payments", "ai-chatbot"],
  },
];
