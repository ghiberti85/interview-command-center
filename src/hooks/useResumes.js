import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

export function useResumes(session) {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .order("created_at", { ascending: false });
    setResumes(data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => { refetch(); }, [refetch]);

  const add = useCallback(async (resume) => {
    const row = { ...resume, user_id: session?.user?.id };
    const { data, error } = await supabase.from("resumes").insert(row).select().single();
    if (!error && data) setResumes(prev => [data, ...prev]);
    return { data, error };
  }, [session]);

  const update = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from("resumes").update(patch).eq("id", id).select().single();
    if (!error && data) setResumes(prev => prev.map(r => r.id === id ? data : r));
    return { data, error };
  }, []);

  const remove = useCallback(async (id) => {
    const { error } = await supabase.from("resumes").delete().eq("id", id);
    if (!error) setResumes(prev => prev.filter(r => r.id !== id));
    return { error };
  }, []);

  return { resumes, loading, add, update, remove, refetch };
}
