"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { SimGraph } from "@/lib/sim";

/** What happened to the server-side check of a submission. */
export type Verification = "verified" | "guest" | "unavailable" | "failed";

/**
 * Sends a submitted design to /api/grade so the result counts on the leaderboard. Guests and setups without
 * server grading simply skip it; local progress is unaffected either way.
 */
export async function verifySubmission(problemId: string, graph: SimGraph): Promise<Verification> {
  const sb = getSupabase();
  if (!sb) return "guest";
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return "guest";
  try {
    const res = await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ problemId, graph: { nodes: graph.nodes, edges: graph.edges } }),
    });
    if (res.status === 503 || res.status === 404) return "unavailable";
    return res.ok ? "verified" : "failed";
  } catch {
    return "failed";
  }
}
