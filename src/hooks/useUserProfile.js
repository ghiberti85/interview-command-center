import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

const PROFILE_KEY = "icc-user-profile";
const DEFAULT_PROFILE = { stack: [], summary: "", cvText: "" };

function fromRow(row) {
  return { stack: row.stack || [], summary: row.summary || "", cvText: row.cv_text || "" };
}

function toRow(p, userId) {
  return { user_id: userId, stack: p.stack || [], summary: p.summary || "", cv_text: p.cvText || "" };
}

function readCache() {
  try { const s = localStorage.getItem(PROFILE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

function writeCache(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

export function useUserProfile(session) {
  const [profile, setProfile] = useState(() => readCache() || DEFAULT_PROFILE);
  const [syncing, setSyncing] = useState(false);

  // Load from Supabase on session start, merge with localStorage cache
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      setSyncing(true);
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();
      if (data) {
        const remote = fromRow(data);
        setProfile(remote);
        writeCache(remote);
      }
      setSyncing(false);
    })();
  }, [session?.user?.id]);

  const saveProfile = useCallback(async (p) => {
    setProfile(p);
    writeCache(p);
    if (!session?.user?.id) return;
    await supabase
      .from("user_profiles")
      .upsert({ ...toRow(p, session.user.id), updated_at: new Date().toISOString() });
  }, [session?.user?.id]);

  return { profile, saveProfile, syncing };
}
