export const fmtDate = d =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

export const daysDiff = d =>
  d ? Math.ceil((new Date(d + "T12:00:00") - new Date()) / 86400000) : null;
