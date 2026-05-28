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

// pdfjs lazy-loaded — reused across calls
let _pdfjsLib = null;

async function extractWithPdfjs(buffer) {
  if (!_pdfjsLib) {
    _pdfjsLib = await import("pdfjs-dist");
  }
  const lib = _pdfjsLib;
  const GWO = lib.GlobalWorkerOptions ?? lib.default?.GlobalWorkerOptions;

  // Use the static URL resolved by Vite at build time.
  // pdfjs will:
  //   1. Try to spin up a real Worker with this URL (works on desktop/Android)
  //   2. If Worker() construction fails, auto-fallback to FakeWorker which
  //      does dynamic import() of the same URL in the main thread —
  //      this is what makes it work on iOS Safari PWA where Worker is blocked.
  if (GWO && !GWO.workerSrc) {
    GWO.workerSrc = pdfWorkerUrl;
  }

  const getDocument = lib.getDocument ?? lib.default?.getDocument;
  if (!getDocument) throw new Error("pdfjs getDocument not found");

  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter(x => typeof x.str === "string")
      .map(x => x.str)
      .join(" ");
    pages.push(text);
  }
  return pages.join("\n\n").replace(/\s+/g, " ").trim();
}

// Pure-JS fallback — no library, no worker.
// Handles uncompressed PDFs (BT/ET text blocks) and extracts long readable
// ASCII sequences as a last resort. Most modern PDFs (from Word/Google Docs)
// use zlib-compressed streams, so this is only a safety net.
function extractPdfTextPureJS(buffer) {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder("latin-1").decode(bytes);
  const strings = [];

  // Strategy 1: BT...ET blocks (uncompressed content streams)
  const btEtRe = /BT\s([\s\S]+?)\sET/g;
  let m;
  while ((m = btEtRe.exec(latin1)) !== null) {
    const block = m[1];
    const tjRe = /\(([^)]*)\)\s*(?:Tj|'|")/g;
    let t;
    while ((t = tjRe.exec(block)) !== null) strings.push(t[1]);
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

  // Strategy 2: long ASCII runs — catches text in uncompressed metadata/annotations
  let ascii = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    ascii += (b >= 32 && b < 127) || b === 10 ? String.fromCharCode(b) : " ";
  }
  const runs = ascii.match(/[A-Za-z][A-Za-z0-9 .,;:@()\-+#/'"!?]{5,}/g) || [];
  const filtered = runs.filter(r =>
    r.trim().length >= 8 &&
    !/^(stream|endstream|obj|endobj|xref|trailer|startxref|Width|Height|Filter|Length|Subtype|Resources)/.test(r.trim())
  );
  return filtered.join(" ").replace(/\s+/g, " ").trim();
}

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();

  // pdfjs handles compressed streams, complex layouts — works on all modern PDFs
  try {
    const text = await extractWithPdfjs(buffer);
    if (text.length > 50) return text;
    if (text.length > 0) {
      throw new Error("Este PDF parece ser escaneado (só imagens). Cole o texto do currículo manualmente.");
    }
  } catch (e) {
    if (e.message.includes("escaneado")) throw e;
    console.warn("[PDF] pdfjs failed, trying pure-JS fallback:", e?.message || e);
  }

  // Fallback: pure-JS — works for older/uncompressed PDFs
  const text = extractPdfTextPureJS(buffer);
  if (text.length >= 50) return text;

  throw new Error("Não foi possível extrair texto deste PDF. Se for um PDF escaneado (imagem), cole o conteúdo manualmente.");
}
