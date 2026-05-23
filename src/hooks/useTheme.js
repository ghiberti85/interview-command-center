import { useState } from "react";

export function useTheme() {
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
