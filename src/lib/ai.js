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

// ── Attempt 1: pdfjs (handles everything — needs worker) ─────────────────────

let _pdfjsLib = null;

async function extractWithPdfjs(buffer) {
  if (!_pdfjsLib) _pdfjsLib = await import("pdfjs-dist");
  const lib = _pdfjsLib;
  const GWO = lib.GlobalWorkerOptions ?? lib.default?.GlobalWorkerOptions;
  if (GWO && !GWO.workerSrc) GWO.workerSrc = pdfWorkerUrl;
  const getDocument = lib.getDocument ?? lib.default?.getDocument;
  if (!getDocument) throw new Error("pdfjs getDocument not found");
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.filter(x => typeof x.str === "string").map(x => x.str).join(" "));
  }
  return pages.join("\n\n").replace(/\s+/g, " ").trim();
}

// ── Attempt 2: native DecompressionStream + BT/ET parser ─────────────────────
// Works on iOS Safari 16.4+ (and all modern browsers) with no workers.
// PDF FlateDecode streams use zlib format (RFC 1950) → "deflate" in the API.

async function zlibDecompress(bytes) {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    // Fire-and-forget write; close signals end-of-input
    writer.write(bytes).catch(() => {});
    writer.close().catch(() => {});
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } catch { /* partial output is still usable */ }
    if (!chunks.length) return null;
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  } catch { return null; }
}

function parseBtEtBlocks(latin1) {
  const strings = [];
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
  return strings;
}

async function extractWithDecompression(buffer) {
  const bytes = new Uint8Array(buffer);
  const dec = new TextDecoder("latin-1");
  const latin1 = dec.decode(bytes);
  const allStrings = [];

  // Iterate over every stream...endstream block in the PDF
  const streamStartRe = /stream\r?\n/g;
  let sm;
  while ((sm = streamStartRe.exec(latin1)) !== null) {
    const dataStart = sm.index + sm[0].length;
    const endIdx = latin1.indexOf("\nendstream", dataStart);
    if (endIdx === -1) continue;

    // Check the dictionary preceding this stream for /FlateDecode
    const dictSlice = latin1.slice(Math.max(0, sm.index - 512), sm.index);
    const isFlate = /\/FlateDecode|\/Fl(?:\s|\/|>)/.test(dictSlice);

    if (isFlate) {
      const compressed = bytes.slice(dataStart, endIdx);
      const decompressed = await zlibDecompress(compressed);
      if (!decompressed) continue;
      const content = dec.decode(decompressed);
      allStrings.push(...parseBtEtBlocks(content));
    } else {
      // Uncompressed stream — parse directly
      const content = latin1.slice(dataStart, endIdx);
      allStrings.push(...parseBtEtBlocks(content));
    }
  }

  if (allStrings.length > 0) {
    return allStrings
      .join(" ")
      .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\\/g, "\\")
      .replace(/\\([()])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

// ── Attempt 3: ASCII run extraction (last resort) ────────────────────────────

function extractAsciiRuns(buffer) {
  const bytes = new Uint8Array(buffer);
  let ascii = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    ascii += (b >= 32 && b < 127) || b === 10 ? String.fromCharCode(b) : " ";
  }
  const runs = ascii.match(/[A-Za-z][A-Za-z0-9 .,;:@()\-+#/'"!?]{7,}/g) || [];
  return runs
    .filter(r => !/^(stream|endstream|obj|endobj|xref|trailer|startxref|Width|Height|Filter|Length|Subtype|Resources|BitsPerComponent|ColorSpace)/.test(r.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();

  // 1. pdfjs — best quality, handles all layouts (requires worker)
  try {
    const text = await extractWithPdfjs(buffer);
    if (text.length > 50) { console.log("[PDF] extracted via pdfjs"); return text; }
    if (text.length > 0) throw new Error("PDF escaneado");
  } catch (e) {
    if (e.message === "PDF escaneado") {
      throw new Error("Este PDF parece conter apenas imagens (escaneado). Cole o texto manualmente.");
    }
    console.warn("[PDF] pdfjs failed:", e?.message);
  }

  // 2. DecompressionStream + BT/ET parser — handles modern compressed PDFs natively
  try {
    const text = await extractWithDecompression(buffer);
    if (text.length > 50) { console.log("[PDF] extracted via DecompressionStream"); return text; }
  } catch (e) {
    console.warn("[PDF] DecompressionStream failed:", e?.message);
  }

  // 3. Plain ASCII run extraction — last resort for old/simple PDFs
  const text = extractAsciiRuns(buffer);
  if (text.length >= 50) { console.log("[PDF] extracted via ASCII runs"); return text; }

  throw new Error("Não foi possível extrair texto deste PDF. Se for um arquivo escaneado (imagem), cole o conteúdo manualmente.");
}
