import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, rowToProcess, processToRow } from "./supabase";

// ─── Responsive hook ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

// ─── Theme hook ──────────────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("icc-theme") !== "light"; } catch { return true; }
  });
  const toggle = () => setDark(d => {
    const next = !d;
    try { localStorage.setItem("icc-theme", next ? "dark" : "light"); } catch {}
    return next;
  });
  return { dark, toggle };
}
