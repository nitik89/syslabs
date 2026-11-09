"use client";

import type { DesignDoc } from "@/lib/storage";
import { getSupabase } from "./client";

export interface SharedDesign {
  id: string;
  name: string;
  design: DesignDoc;
  challenge_id: string | null;
  created_at: string;
  owner: { username: string; display_name: string; avatar_url: string | null } | null;
}

export interface LeaderRow {
  username: string;
  display_name: string;
  avatar_url: string | null;
  xp: number;
  solved: number;
  active_days: number;
}

export interface PublicProfile extends LeaderRow {
  created_at: string;
  solved_ids: string[];
  days: string[];
}

const need = () => {
  const sb = getSupabase();
  if (!sb) throw new Error("Accounts aren't configured on this deployment.");
  return sb;
};

/** Snapshot a design as a public, read-only link. Returns the share id. */
export async function shareDesign(name: string, design: DesignDoc, challengeId?: string): Promise<string> {
  const sb = need();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Sign in to share designs.");
  const { data, error } = await sb
    .from("shared_designs")
    .insert({ owner_id: auth.user.id, name: name.slice(0, 80) || "Untitled design", design, challenge_id: challengeId ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function getSharedDesign(id: string): Promise<SharedDesign | null> {
  const sb = need();
  const { data, error } = await sb.from("shared_designs").select("id, name, design, challenge_id, created_at, owner_id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: owner } = await sb.from("profiles").select("username, display_name, avatar_url").eq("id", data.owner_id).maybeSingle();
  return { ...(data as Omit<SharedDesign, "owner">), owner: (owner as SharedDesign["owner"]) ?? null };
}

export async function getLeaderboard(limit = 100): Promise<LeaderRow[]> {
  const { data, error } = await need().rpc("leaderboard", { limit_count: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderRow[];
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data, error } = await need().rpc("public_profile", { p_username: username });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PublicProfile[])[0] ?? null;
}
