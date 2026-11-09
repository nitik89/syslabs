import type { Challenge } from "@/lib/challenges/types";
import { CATALOG, type SimGraph } from "@/lib/sim";
import shoppingApp from "./shopping-app.json";
import chatApp from "./chat-app.json";
import socialFeed from "./social-feed.json";
import videoStreaming from "./video-streaming.json";
import rideHailing from "./ride-hailing.json";
import payments from "./payments.json";
import aiChatbot from "./ai-chatbot.json";
import notificationSystem from "./notification-system.json";
import collaborativeDocs from "./collaborative-docs.json";
import hotelBooking from "./hotel-booking.json";
import metricsDashboard from "./metrics-dashboard.json";
import searchAutocomplete from "./search-autocomplete.json";
import pastebin from "./pastebin.json";
import apiRateLimiter from "./api-rate-limiter.json";
import webCrawler from "./web-crawler.json";
import leaderboard from "./leaderboard.json";
import onlineJudge from "./online-judge.json";
import fileStorage from "./file-storage.json";
import nearbyPlaces from "./nearby-places.json";
import keyValueStore from "./key-value-store.json";
import liveComments from "./live-comments.json";
import topKTrending from "./top-k-trending.json";
import adClickAggregator from "./ad-click-aggregator.json";
import jobScheduler from "./job-scheduler.json";
import emailNewsletter from "./email-newsletter.json";
import orderSaga from "./order-saga.json";
import logPipeline from "./log-pipeline.json";
import imageHosting from "./image-hosting.json";
import stockTicker from "./stock-ticker.json";
import newsAggregator from "./news-aggregator.json";
import likeCounter from "./like-counter.json";

/**
 * "Build" problems: design a product from a blank canvas. Same shape as challenges (so scoring, progress and
 * the challenge page are shared), with mode "build", requirements and a reference architecture.
 * Node configs in the JSON list only what differs from the component's defaults; they're filled in here.
 */
function withDefaults(g: SimGraph): SimGraph {
  return { ...g, nodes: g.nodes.map((n) => ({ ...n, config: { ...CATALOG[n.kind].defaults, ...n.config } })) };
}

function normalize(raw: unknown): Challenge {
  const c = raw as Challenge;
  return {
    ...c,
    startingDesign: { ...c.startingDesign, graph: withDefaults(c.startingDesign.graph) },
    ...(c.reference ? { reference: { ...c.reference, graph: withDefaults(c.reference.graph) } } : {}),
  };
}

export const DESIGNS: Challenge[] = [
  shoppingApp,
  chatApp,
  socialFeed,
  videoStreaming,
  rideHailing,
  payments,
  aiChatbot,
  notificationSystem,
  collaborativeDocs,
  hotelBooking,
  metricsDashboard,
  searchAutocomplete,
  pastebin,
  apiRateLimiter,
  webCrawler,
  leaderboard,
  onlineJudge,
  fileStorage,
  nearbyPlaces,
  keyValueStore,
  liveComments,
  topKTrending,
  adClickAggregator,
  jobScheduler,
  emailNewsletter,
  orderSaga,
  logPipeline,
  imageHosting,
  stockTicker,
  newsAggregator,
  likeCounter,
]
  .map(normalize)
  .sort((a, b) => a.order - b.order);

export function getDesign(id: string): Challenge | undefined {
  return DESIGNS.find((d) => d.id === id);
}

/** Product areas, in the order they first appear. */
export const DESIGN_CATEGORIES: string[] = [...new Set(DESIGNS.map((d) => d.category ?? "Other"))];
