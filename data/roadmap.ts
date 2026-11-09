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
    problems: ["overloaded-database", "single-point-of-failure", "product-catalog", "search-autocomplete", "pastebin", "url-shortener"],
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
    tags: ["API gateways", "Rate limiting", "CDN", "Queues & workers", "Pub/sub", "Real-time"],
    color: "var(--status-ok)",
    problems: ["choked-front-door", "api-rate-limiter", "image-heavy-homepage", "inbox-never-drains", "job-scheduler", "email-newsletter", "web-crawler", "live-comments", "log-pipeline", "photo-sharing-launch", "flash-sale-checkout"],
  },
  {
    id: "coordination",
    title: "Coordination",
    blurb: "Correctness under contention: locks, quorums and extreme hot keys.",
    tags: ["Locks", "Consensus & quorum", "Hot keys", "Sagas", "Failure drills"],
    color: "var(--status-warn)",
    problems: ["double-booked-seats", "meeting-scheduler", "lost-quorum", "like-counter", "order-saga", "digital-wallet", "live-scoreboard", "concert-ticket-drop"],
  },
  {
    id: "products",
    title: "Case studies",
    blurb: "Design real products from a blank canvas, from requirements to a scored architecture.",
    tags: ["E-commerce", "Leaderboards", "Chat", "Notifications", "Streaming", "Booking", "Geo search", "Code judging"],
    color: "var(--brand-violet)",
    problems: ["shopping-app", "leaderboard", "chat-app", "notification-system", "video-streaming", "metrics-dashboard", "hotel-booking", "nearby-places", "image-hosting", "news-aggregator", "food-delivery", "online-judge"],
  },
  {
    id: "advanced",
    title: "Advanced",
    blurb: "The hard ones: fan-out at scale, realtime collaboration, geo matching, money and AI.",
    tags: ["Feed fan-out", "Stream processing", "File sync", "Geo matching", "Partitioning", "Market data", "Payments", "AI"],
    color: "var(--status-crit)",
    problems: ["social-feed", "short-video-feed", "top-k-trending", "file-storage", "collaborative-docs", "ride-hailing", "ad-click-aggregator", "key-value-store", "stock-ticker", "payments", "ai-chatbot"],
  },
];
