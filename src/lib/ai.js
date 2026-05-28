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

// ── PDF extraction ────────────────────────────────────────────────────────────

// Pure-JS fallback: parses text from PDF binary without any library or worker.
// Works on all browsers including iOS Safari PWA. Handles BT/ET text blocks
// (uncompressed streams) which covers virtually all text-based CVs/resumes.
function extractPdfTextPureJS(buffer) {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder("latin-1").decode(bytes);

  const strings = [];

  // Strategy 1: BT ... ET text blocks (standard uncompressed PDF text)
  const btEtRe = /BT\s([\s\S]+?)\sET/g;
  let m;
  while ((m = btEtRe.exec(latin1)) !== null) {
    const block = m[1];
    // (string) Tj  /  (string) '  /  (string) "
    const tjRe = /\(([^)]*)\)\s*(?:Tj|'|")/g;
    let t;
    while ((t = tjRe.exec(block)) !== null) strings.push(t[1]);
    // [(string1) num (string2) ...] TJ
    const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
    while ((t = tjArrRe.exec(block)) !== null) {
      const inner = /\(([^)]*)\)/g;
      let s;
      while ((s = inner.exec(t[1])) !== null) strings.push(s[1]);
    }
  }

  if (strings.length > 0) {
    return strings
      .join(" ")
      .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\\/g, "\\")
      .replace(/\\([()])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Strategy 2: extract readable ASCII runs (last resort, handles some encodings)
  let ascii = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    ascii += (b >= 32 && b < 127) || b === 10 ? String.fromCharCode(b) : " ";
  }
  const words = ascii.match(/[A-Za-z][A-Za-z0-9 .,;:@()\-+#]{4,}/g) || [];
  return words.join(" ").replace(/\s+/g, " ").trim();
}

// pdfjs carregado sob demanda — tenta extrair com qualidade superior
let _pdfjsLib = null;
let _workerSrc = null;

async function resolveWorkerSrc() {
  if (_workerSrc) return _workerSrc;
  try {
    const resp = await fetch(pdfWorkerUrl);
    const blob = await resp.blob();
    _workerSrc = URL.createObjectURL(blob);
  } catch {
    _workerSrc = pdfWorkerUrl;
  }
  return _workerSrc;
}

async function extractWithPdfjs(buffer) {
  if (!_pdfjsLib) {
    const lib = await import("pdfjs-dist");
    const GWO = lib.GlobalWorkerOptions ?? lib.default?.GlobalWorkerOptions;
    if (GWO) GWO.workerSrc = await resolveWorkerSrc();
    _pdfjsLib = lib;
  }
  const getDocument = _pdfjsLib.getDocument ?? _pdfjsLib.default?.getDocument;
  if (!getDocument) throw new Error("pdfjs getDocument not found");
  const pdf = await getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items.filter(x => typeof x.str === "string").map(x => x.str).join(" ")
    );
  }
  return pages.join("\n\n");
}

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();

  // Try pdfjs first (better quality for complex layouts)
  try {
    const text = await extractWithPdfjs(buffer);
    if (text.trim().length > 30) return text;
  } catch (e) {
    console.warn("[PDF] pdfjs failed, using pure-JS fallback:", e?.message || e);
  }

  // Fallback: pure-JS extraction — no worker, no library, works everywhere
  const text = extractPdfTextPureJS(buffer);
  if (text.length < 30) throw new Error("Não foi possível extrair texto deste PDF. Por favor, cole o conteúdo manualmente.");
  return text;
}
