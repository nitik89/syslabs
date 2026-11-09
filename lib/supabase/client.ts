"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase's newer "publishable" key and the legacy "anon" key both work here; both are safe to expose.
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the app is configured with a Supabase project. Without it, SysLab runs in guest mode only. */
export const cloudEnabled = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

/** The browser Supabase client (PKCE auth, session kept in localStorage). Null when not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!cloudEnabled || typeof window === "undefined") return null;
  client ??= createClient(URL!, KEY!, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
