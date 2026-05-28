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
// pdfjs v5 requires Promise.try (Chrome 136+/Safari 18.4+ only) — too new.
// Instead we use two pure-JS strategies that work on all modern browsers:
//   1. DecompressionStream (Safari 16.4+) — handles modern zlib-compressed PDFs
//   2. ASCII run extraction — last resort for older/simple PDFs

// ── Strategy 1: DecompressionStream + BT/ET block parser ─────────────────────
// PDFs exported from Word, Google Docs, etc. use FlateDecode (zlib/RFC 1950).
// The browser's native DecompressionStream("deflate") handles this directly.

async function zlibDecompress(bytes) {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
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

  const streamStartRe = /stream\r?\n/g;
  let sm;
  while ((sm = streamStartRe.exec(latin1)) !== null) {
    const dataStart = sm.index + sm[0].length;
    const endIdx = latin1.indexOf("\nendstream", dataStart);
    if (endIdx === -1) continue;

    const dictSlice = latin1.slice(Math.max(0, sm.index - 512), sm.index);
    const isFlate = /\/FlateDecode|\/Fl(?:\s|\/|>)/.test(dictSlice);

    if (isFlate) {
      const compressed = bytes.slice(dataStart, endIdx);
      const decompressed = await zlibDecompress(compressed);
      if (!decompressed) continue;
      allStrings.push(...parseBtEtBlocks(dec.decode(decompressed)));
    } else {
      allStrings.push(...parseBtEtBlocks(latin1.slice(dataStart, endIdx)));
    }
  }

  if (!allStrings.length) return "";
  return allStrings
    .join(" ")
    .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\\/g, "\\")
    .replace(/\\([()])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Strategy 2: ASCII run extraction ─────────────────────────────────────────

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

  // Strategy 1: DecompressionStream — handles all modern compressed PDFs
  try {
    const text = await extractWithDecompression(buffer);
    if (text.length > 50) return text;
  } catch (e) {
    console.warn("[PDF] DecompressionStream failed:", e?.message);
  }

  // Strategy 2: ASCII runs — works for older uncompressed PDFs
  const text = extractAsciiRuns(buffer);
  if (text.length >= 50) return text;

  throw new Error("Não foi possível extrair texto deste PDF. Se for um arquivo escaneado (imagem), cole o conteúdo manualmente.");
}
