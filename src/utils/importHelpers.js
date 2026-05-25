import { STAGE } from "./constants.js";

/** Detecta se `data` é um array de conversas do ChatGPT (campo `mapping` na primeira entrada). */
export function isChatGPTFormat(data) {
  return Array.isArray(data) && data.length > 0 && "mapping" in (data[0] || {});
}

/** Detecta se `data` é um array de processos no formato ICC (campo `company` na primeira entrada). */
export function isICCFormat(data) {
  return Array.isArray(data) && data.length > 0 && "company" in (data[0] || {});
}

/** Retorna true se o título da conversa contiver palavras-chave de recrutamento. */
export function looksLikeRecruitment(conv) {
  const kw = [
    "recrutador","recruiter","vaga","job","oportunidade","entrevista","interview",
    "empresa","company","tech lead","engineer","developer","desenvolvedor",
    "linkedin","headhunter","processo seletivo",
  ];
  return kw.some(k => (conv.title || "").toLowerCase().includes(k));
}

/**
 * Parseia texto CSV simples (primeira linha = cabeçalhos, separador vírgula).
 * Retorna array de objetos com chaves em minúsculas.
 * Filtra linhas sem company/empresa.
 */
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1)
    .map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cols[i] || ""; });
      return obj;
    })
    .filter(r => r.company || r.empresa);
}

/**
 * Normaliza um objeto bruto (de qualquer origem: ICC JSON, CSV, IA, ChatGPT)
 * para o formato interno de processo.
 */
export function normalizeProcess(r) {
  const now = new Date().toISOString().split("T")[0];
  return {
    id: r.id || crypto.randomUUID(),
    company: r.company || r.empresa || "Empresa?",
    role: r.role || r.cargo || "Cargo?",
    stage: Object.keys(STAGE).includes(r.stage) ? r.stage : "contacted",
    origin: r.origin === "outbound" ? "outbound" : "inbound",
    location: r.location || r.localização || "",
    salary: r.salary || r.salário || "",
    recruiter: r.recruiter || r.recrutador || "",
    recruiterEmail: r.recruiterEmail || r.recruiteremail || r.email || "",
    contactedDate: r.contactedDate || r.data || now,
    notes: r.notes || r.notas || "",
    tags: Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(";").map(t => t.trim()) : []),
    convTitle: r.convTitle || null,
  };
}
