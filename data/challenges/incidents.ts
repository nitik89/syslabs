/**
 * On-call framing for "fix" challenges: the page you get, and a root-cause question to answer before fixing.
 * `options[0]` is always the correct answer; the UI shuffles them deterministically.
 */
export interface Incident {
  page: string;
  options: [string, string, string, string];
  why: string;
}

export const INCIDENTS: Record<string, Incident> = {
  "overloaded-database": {
    page: "PAGE: error rate > 75% on /products for 5 minutes",
    options: [
      "The SQL database is overloaded by repeated reads of the same hot items",
      "The app servers are out of capacity",
      "The load balancer is dropping connections",
      "Writes are racing without a lock",
    ],
    why: "5,000 reads/s hit a database that handles about 1,000. Most of them are for a few hot items, so a cache in front of it absorbs the bulk of that load.",
  },
  "single-point-of-failure": {
    page: "PAGE: app down for 4 minutes during a kernel patch",
    options: [
      "There is only one app server, so restarting it takes the whole product down",
      "The database ran out of capacity during the patch",
      "Traffic spiked past capacity after the reboot",
      "The cache was cold after the reboot",
    ],
    why: "Utilization was fine; redundancy wasn't. With one app server, any restart is an outage. Two or more behind a load balancer survive losing one.",
  },
  "cloud-bill-shock": {
    page: "ALERT: monthly spend $3,800 for ~1,200 req/s",
    options: [
      "Components are heavily over-provisioned, and some carry no traffic at all",
      "Traffic grew 3× and genuinely needs the capacity",
      "The database needs more replicas to stay up",
      "The cloud provider raised its prices",
    ],
    why: "Every incident was 'fixed' by adding more of everything. Size each tier to its real load with headroom, keep two of anything critical, and delete what serves nothing.",
  },
  "flash-sale-checkout": {
    page: "PAGE: checkout error rate > 50% since the midnight drop",
    options: [
      "Every write lands on the single Postgres primary, which commits ~1,000 writes/s",
      "The read replicas are overwhelmed by browsing traffic",
      "The load balancer can't handle 8,000 req/s",
      "The CDN is serving stale product pages",
    ],
    why: "Read replicas only help reads. 3,200 writes/s need to be absorbed by a queue and processed by workers (or a database built for writes), not sent straight to one primary.",
  },
  "image-heavy-homepage": {
    page: "PAGE: p99 latency > 2s on the homepage; search and bookings failing",
    options: [
      "Static images and assets are served by the app servers instead of a CDN",
      "The database is overloaded by search queries",
      "There are too few load balancers",
      "The search index is missing",
    ],
    why: "70% of requests are static files. A CDN serves them from the edge, freeing the app tier for the dynamic requests that matter.",
  },
  "double-booked-seats": {
    page: "TICKET: two customers hold tickets for the same seat (×37 tonight)",
    options: [
      "Concurrent bookings race between 'is it free?' and the write: there is no lock",
      "The database is overloaded and loses writes",
      "The cache serves stale seat maps",
      "The load balancer sends duplicate requests",
    ],
    why: "Nothing errors; it's a race. Take a lock (Redis lock or ZooKeeper) around check-then-write, and run the lock service redundantly so it isn't a new single point of failure.",
  },
  "lost-quorum": {
    page: "PAGE: 100% of trip assignments failing after zk-2 restarted",
    options: [
      "A 2-node ZooKeeper ensemble loses its majority when one node goes down",
      "The app servers are out of capacity",
      "The database ran out of connections",
      "Drivers' phones lost connectivity",
    ],
    why: "ZooKeeper needs a majority to grant locks. With 2 nodes, losing one leaves 1 of 2: no majority. Three nodes tolerate one failure.",
  },
  "write-storm": {
    page: "PAGE: ingest error rate high despite 3 new read replicas",
    options: [
      "90% of traffic is writes, and they all land on one primary; replicas only serve reads",
      "Reads are overloading the replicas",
      "The app servers can't parse device payloads",
      "The cache is too small",
    ],
    why: "Replicas copy the primary; they don't take writes. Use a write-optimized store or buffer writes through a queue, and drop the replicas you don't need.",
  },
  "choked-front-door": {
    page: "PAGE: ~30% of API calls rejected at the edge (HTTP 503)",
    options: [
      "The single API Gateway tops out at 10,000 req/s and is a single point of failure",
      "The database is overloaded",
      "The app servers are under-provisioned",
      "The cache hit ratio is too low",
    ],
    why: "Everything behind it was scaled; the front door wasn't. Run several gateway replicas (or a bigger gateway) so it carries 14,000 req/s and survives losing one.",
  },
  "cache-that-didnt-help": {
    page: "PAGE: database overloaded; cache hit ratio 33% after adding Redis",
    options: [
      "Reads have no hot keys, so a cache can't absorb them; the database needs read capacity",
      "The cache is too small; it needs more memory",
      "The app servers bypass the cache",
      "Writes invalidate the cache constantly",
    ],
    why: "Caches work when many reads share a few keys. Here every read is for a different document, so most miss. Read replicas add capacity that actually helps, and removing the useless cache pays for them.",
  },
  "inbox-never-drains": {
    page: "PAGE: message delivery lag growing; queue backlog +2,800 msg/s",
    options: [
      "One worker processes 2,000 msg/s but about 4,800 msg/s arrive",
      "The API can't enqueue fast enough",
      "The database is out of disk",
      "The queue is dropping messages",
    ],
    why: "Consumers must outrun producers, or lag grows forever. Add workers until they process more than the arrival rate, with headroom.",
  },
  "photo-sharing-launch": {
    page: "PAGE: p99 > 3s and error rate 40% after launch",
    options: [
      "Images flow through the app tier, and every read and upload hits one SQL database",
      "Only the database is too small",
      "DNS is misconfigured",
      "There are too many load balancers",
    ],
    why: "Serve images from a CDN backed by object storage, cache feed reads, and move uploads onto a queue. Each tier then carries only the work it's good at.",
  },
  "concert-ticket-drop": {
    page: "PAGE: oversold seats and 40% of fans dropped at on-sale",
    options: [
      "Undersized stack, no lock on contended purchases, and every purchase hits one SQL primary",
      "The CDN can't serve the seat map",
      "The payment provider is down",
      "There are too many cache replicas",
    ],
    why: "Three problems at once: scale the stateless tiers, cache availability reads, lock contended purchases with a fast lock service, and keep writes off a single primary.",
  },
  "missing-index": {
    page: "PAGE: p99 > 4s on 'My orders'; database CPU at 100%",
    options: [
      "The query scans all 80M rows: there is no index on customer_id",
      "There are too few read replicas",
      "The app servers are slow",
      "The cache is too small",
    ],
    why: "Adding replicas copies a slow query. An index on customer_id turns a full scan into a lookup; often you can then drop the extra replicas.",
  },
};

/** Options in a stable, per-challenge order (so the right answer isn't always first). Returns [options, correctIndex]. */
export function shuffledOptions(id: string, inc: Incident): [string[], number] {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const shift = h % 4;
  const opts = inc.options.map((_, i) => inc.options[(i + shift) % 4]);
  return [opts, opts.indexOf(inc.options[0])];
}
