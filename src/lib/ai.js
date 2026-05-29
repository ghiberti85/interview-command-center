// Worker URL resolved at build-time by Vite — required for Vercel
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

// ── PDF extraction ────────────────────────────────────────────────────────────
// Uses pdfjs-dist v4 (no Promise.try dependency) which handles font encoding
// (ToUnicode CMap), compressed streams, and all modern PDF layouts.
// On iOS Safari PWA where Worker() may fail, pdfjs falls back automatically
// to FakeWorker (dynamic import() of the worker in the main thread).

let _pdfjsLib = null;

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();

  if (!_pdfjsLib) _pdfjsLib = await import("pdfjs-dist");
  const lib = _pdfjsLib;
  const GWO = lib.GlobalWorkerOptions ?? lib.default?.GlobalWorkerOptions;
  if (GWO && !GWO.workerSrc) GWO.workerSrc = pdfWorkerUrl;

  const getDocument = lib.getDocument ?? lib.default?.getDocument;
  if (!getDocument) throw new Error("pdfjs não disponível");

  let pdf;
  try {
    pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch (e) {
    throw new Error("Não foi possível abrir este PDF. Se for escaneado (imagem), cole o texto manualmente.");
  }

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.filter(x => typeof x.str === "string").map(x => x.str).join(" "));
  }

  const text = pages.join("\n\n").replace(/[ \t]{2,}/g, " ").trim();
  if (text.length < 50) {
    throw new Error("Este PDF parece conter apenas imagens (escaneado). Cole o texto do currículo manualmente.");
  }
  return text;
}
