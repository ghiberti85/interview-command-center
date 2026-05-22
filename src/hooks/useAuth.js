import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [isRecovery, setIsRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => setSession(error ? null : (data?.session ?? null)))
      .catch(() => setSession(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      setSession(s ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return { session, isRecovery, clearRecovery: () => setIsRecovery(false) };
}
