import { useState } from "react";

const PROFILE_KEY = "icc-user-profile";
const DEFAULT_PROFILE = { stack: [], summary: "", cvText: "" };

export function useUserProfile() {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch { return DEFAULT_PROFILE; }
  });
  const saveProfile = (p) => {
    setProfile(p);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
  };
  return { profile, saveProfile };
}
