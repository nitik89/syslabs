"use client";

import { useRouter } from "next/navigation";
import { WorkspaceTour, type Step } from "@/components/challenges/workspace-tour";

export const SITE_TOUR_DONE_KEY = "syslab:site-tour-done";

/** The first-visit tour of the whole site: what each section is for, then straight into the first problem. */
const SITE_STEPS: Step[] = [
  {
    target: "center",
    title: "Welcome to SysLab 👋",
    body: "Learn system design by doing it. You draw how an app is built (servers, databases, caches), send real-looking traffic through it, and watch what breaks. No sign-up needed: your progress saves in this browser.",
    example: "Most people start with a 2-minute problem: a website slowed down by its database.",
  },
  {
    target: "nav-/learn",
    title: "Learn the ideas",
    body: "30 short lessons, each with a diagram and a worked example: caching, databases, queues, load balancing and more. No prior knowledge assumed.",
  },
  {
    target: "nav-/challenges",
    title: "Fix broken systems",
    body: "A system is failing in production. Find out why and fix it by adding or changing components. The best place to start.",
  },
  {
    target: "nav-/build",
    title: "Design products from scratch",
    body: "Build a shopping app, a chat app, a video feed… from a blank canvas, with real requirements and a budget.",
  },
  {
    target: "nav-/interview",
    title: "Practise real interviews",
    body: "A timed, 45-minute mock interview: requirements, estimates, a design, and a surprise twist halfway through. You get a scorecard at the end.",
  },
  {
    target: "nav-/review",
    title: "Remember what you learn",
    body: "A few flashcards a day, timed so they come back just before you'd forget them.",
  },
  {
    target: "stats",
    title: "Track your progress",
    body: "Your daily streak, XP and problems solved. Sign in (free) to keep them across devices, get a public profile and join the leaderboard.",
  },
  {
    target: "center",
    title: "Ready?",
    body: "Start with the first problem. A short guided tour shows you every control on the canvas, and “Solve it with me” builds the answer with you step by step.",
  },
];

export function SiteTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  return (
    <WorkspaceTour
      open={open}
      onClose={onClose}
      steps={SITE_STEPS}
      doneKey={SITE_TOUR_DONE_KEY}
      endLabel="Start the first problem"
      onEnd={() => router.push("/challenges/overloaded-database")}
    />
  );
}
