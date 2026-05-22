import { STAGE_ORDER } from "../constants/index.js";

export function sortProcesses(list, sortBy) {
  const arr = [...list];
  if (sortBy === "urgencia") {
    return arr.sort((a, b) => {
      const da = a.nextStepDate ? new Date(a.nextStepDate + "T12:00:00").getTime() : Infinity;
      const db = b.nextStepDate ? new Date(b.nextStepDate + "T12:00:00").getTime() : Infinity;
      return da - db;
    });
  }
  if (sortBy === "empresa") {
    return arr.sort((a, b) => a.company.toLowerCase().localeCompare(b.company.toLowerCase(), "pt-BR"));
  }
  if (sortBy === "stage") {
    return arr.sort((a, b) => (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99));
  }
  if (sortBy === "recente") {
    return arr.sort((a, b) => {
      const da = a.contactedDate ? new Date(a.contactedDate + "T12:00:00").getTime() : 0;
      const db = b.contactedDate ? new Date(b.contactedDate + "T12:00:00").getTime() : 0;
      return db - da;
    });
  }
  return arr;
}
