import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase.js";
import { rowToCVAdaptation, cvAdaptationToRow } from "../supabase.js";

export function useCVAdaptations(session, processId) {
  const [adaptation, setAdaptation] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!session || !processId) return;
    setLoading(true);
    const { data } = await supabase
      .from("cv_adaptations")
      .select("*")
      .eq("process_id", processId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAdaptation(data ? rowToCVAdaptation(data) : null);
    setLoading(false);
  }, [session, processId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = useCallback(async (content, jdSnapshot, qaAnswers) => {
    if (!session || !processId) return;
    const row = cvAdaptationToRow({
      userId: session.user.id,
      processId,
      content,
      jdSnapshot: jdSnapshot || null,
      qaAnswers: qaAnswers || null,
    });
    if (adaptation?.id) {
      const { data, error } = await supabase
        .from("cv_adaptations")
        .update(row)
        .eq("id", adaptation.id)
        .select()
        .single();
      if (!error && data) setAdaptation(rowToCVAdaptation(data));
    } else {
      const { data, error } = await supabase
        .from("cv_adaptations")
        .insert({ ...row })
        .select()
        .single();
      if (!error && data) setAdaptation(rowToCVAdaptation(data));
    }
  }, [session, processId, adaptation]);

  const clear = useCallback(async () => {
    if (!adaptation?.id) return;
    await supabase.from("cv_adaptations").delete().eq("id", adaptation.id);
    setAdaptation(null);
  }, [adaptation]);

  return { adaptation, loading, save, clear, refetch: fetch };
}
