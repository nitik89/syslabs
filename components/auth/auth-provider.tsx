"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { cloudEnabled, getSupabase } from "@/lib/supabase/client";
import { PROGRESS_EVENT, createSupabaseDriver, holdStorageUntil, localDriver, migrateGuestData, setStorageTarget } from "@/lib/storage";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_public: boolean;
}

interface AuthState {
  /** The app is connected to a Supabase project (accounts are available). */
  enabled: boolean;
  /** True until the initial session has been restored. */
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  enabled: false,
  loading: false,
  user: null,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const migratedKey = (uid: string) => `syslab:migrated:${uid}`;

/** Point storage at the user's cloud data, copying this browser's guest data in the first time they sign in here. */
async function switchToAccountStorage(user: User): Promise<void> {
  const sb = getSupabase()!;
  const cloud = createSupabaseDriver(sb, user.id);
  if (localStorage.getItem(migratedKey(user.id)) !== "1") {
    await migrateGuestData(localDriver(), cloud);
    localStorage.setItem(migratedKey(user.id), "1");
  }
  setStorageTarget(cloud);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(cloudEnabled);

  const loadProfile = useCallback(async (u: User | null) => {
    const sb = getSupabase();
    if (!sb || !u) return setProfile(null);
    const { data } = await sb.from("profiles").select("id, username, display_name, avatar_url, is_public").eq("id", u.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;

    // Restore the session (this also completes an OAuth / magic-link redirect) before any storage call runs.
    const restore = sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      if (u) {
        try {
          await switchToAccountStorage(u);
        } catch (e) {
          setStorageTarget(null);
          toast.error(e instanceof Error ? e.message : "Couldn't load your cloud data. Using this browser's data for now.");
        }
      }
      if (!active) return;
      setUser(u);
      setLoading(false);
      void loadProfile(u);
    });
    holdStorageUntil(restore);

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      if (event === "SIGNED_IN" && u) {
        const switching = switchToAccountStorage(u).catch((e: unknown) => {
          setStorageTarget(null);
          toast.error(e instanceof Error ? e.message : "Couldn't sync your progress.");
        });
        holdStorageUntil(switching);
        void switching.then(() => {
          if (!active) return;
          setUser(u);
          void loadProfile(u);
          window.dispatchEvent(new Event(PROGRESS_EVENT));
        });
      } else if (event === "SIGNED_OUT") {
        setStorageTarget(null);
        setUser(null);
        setProfile(null);
        window.dispatchEvent(new Event(PROGRESS_EVENT));
      } else if (event === "USER_UPDATED" && u) {
        setUser(u);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      enabled: cloudEnabled,
      loading,
      user,
      profile,
      refreshProfile: () => loadProfile(user),
      signOut: async () => {
        await getSupabase()?.auth.signOut();
        // A full reload: pages hold the account's data in state; start clean on this browser's guest data.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      },
    }),
    [loading, user, profile, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
