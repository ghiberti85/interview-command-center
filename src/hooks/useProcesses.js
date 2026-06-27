import { useState, useEffect, useCallback } from "react";
import { supabase, rowToProcess, processToRow } from "../supabase.js";
import { DEMO_PROCESSES } from "../constants/index.js";

export function useProcesses(session, isDemo) {
  const [processes, setProcesses] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    if (isDemo) {
      setProcesses(DEMO_PROCESSES);
      setDbLoading(false);
      return;
    }
    if (!session?.user?.id) return;
    let cancelled = false;
    async function load() {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) { console.error("[ICC] DB load error:", error); setDbError(true); setDbLoading(false); return; }
      setProcesses((data || []).map(rowToProcess));
      setDbLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [isDemo, session?.user?.id]);

  const updateProcess = useCallback(async (updated) => {
    setProcesses(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (!isDemo) await supabase.from("processes").upsert({ ...processToRow(updated), user_id: session?.user?.id });
  }, [isDemo, session]);

  const deleteProcess = useCallback(async (id) => {
    if (!isDemo) await supabase.from("processes").delete().eq("id", id);
    setProcesses(prev => prev.filter(p => p.id !== id));
  }, [isDemo]);

  const addProcess = useCallback(async (p) => {
    if (isDemo) {
      setProcesses(prev => [p, ...prev]);
      return { ok: true };
    }
    const row = { ...processToRow(p), user_id: session?.user?.id };
    const { error } = await supabase.from("processes").insert(row);
    if (!error) setProcesses(prev => [p, ...prev]);
    return { ok: !error };
  }, [isDemo, session]);

  return { processes, setProcesses, dbLoading, dbError, updateProcess, deleteProcess, addProcess };
}
