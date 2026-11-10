import { createClient } from "@supabase/supabase-js";
import { grade } from "@/lib/grading/grade";

/**
 * POST /api/grade — server-side grading for signed-in users.
 *
 * Body: { problemId: string, graph: SimGraph }, header: Authorization: Bearer <Supabase access token>.
 * Re-runs the simulation and hidden tests on the server and records the result in verified_scores,
 * which is what the leaderboard and public profiles count. Browsers can't write that table.
 *
 * Needs SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY) in the server environment.
 * Without it the endpoint answers 503 and the app keeps working with local scores only.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_BODY_BYTES = 200_000;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!URL || !PUBLIC_KEY || !SECRET_KEY) return json({ error: "Server grading isn't configured." }, 503);

  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in to record verified scores." }, 401);

  // Who is calling: Supabase verifies the access token.
  const auth = createClient(URL, PUBLIC_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: authError } = await auth.auth.getUser(token);
  if (authError || !userData.user) return json({ error: "Your session has expired. Sign in again." }, 401);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Design is too large." }, 413);
  let body: { problemId?: unknown; graph?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  const result = grade(body.problemId, body.graph);
  if (!result.ok) return json({ error: result.error }, result.status);

  // The unchanged reference solution is graded but never recorded.
  if (!result.reference) {
    const admin = createClient(URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.rpc("record_verified_score", {
      p_user: userData.user.id,
      p_problem: result.problemId,
      p_score: result.score,
      p_passed: result.passed,
    });
    // PGRST202: the record_verified_score function doesn't exist yet (migration 0002 not run): not configured.
    if (error?.code === "PGRST202") return json({ error: "Server grading isn't set up yet." }, 503);
    if (error) return json({ error: "Couldn't save the verified score." }, 500);
  }

  return json({ verified: !result.reference, ...result });
}
