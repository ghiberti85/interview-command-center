// URL do worker resolvida em build-time pelo Vite (necessário para Vercel)
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

export const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;
if (!AI_PROXY_URL) console.error("[ICC] VITE_AI_PROXY_URL não configurada — chamadas de IA vão falhar.");

export async function callAI(messages, system, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system, messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const d = await res.json();
  return d.content?.find(b=>b.type==="text")?.text || "Erro.";
}

// pdfjs é carregado sob demanda para não penalizar o bundle inicial
let _pdfjsLib = null;
export async function getPdfjs() {
  if (!_pdfjsLib) {
    const lib = await import("pdfjs-dist");
    // pdfjs v5: named exports ou via .default — tratar ambos
    const GWO = lib.GlobalWorkerOptions ?? lib.default?.GlobalWorkerOptions;
    if (GWO) GWO.workerSrc = pdfWorkerUrl;
    _pdfjsLib = lib;
  }
  return _pdfjsLib;
}

export async function extractTextFromPdf(file) {
  const lib = await getPdfjs();
  const getDocument = lib.getDocument ?? lib.default?.getDocument;
  if (!getDocument) throw new Error("PDF library unavailable.");
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // filtrar TextMarkedContent (sem .str) que existe no pdfjs v5
    pages.push(
      content.items
        .filter(item => typeof item.str === "string")
        .map(item => item.str)
        .join(" ")
    );
  }
  return pages.join("\n\n");
}
