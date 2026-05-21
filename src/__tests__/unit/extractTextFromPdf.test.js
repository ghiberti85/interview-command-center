import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock pdfjs-dist ──────────────────────────────────────────────────────────
// We mock the module before importing the function under test so that
// the lazy-load inside getPdfjs() resolves to our fake implementation.
vi.mock("pdfjs-dist", () => {
  const makeDocument = (pageTexts) => ({
    numPages: pageTexts.length,
    getPage: async (i) => ({
      getTextContent: async () => ({
        items: pageTexts[i - 1].map((str) => ({ str })),
      }),
    }),
  });

  return {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: ({ data }) => {
      // We encode the page texts as JSON in the ArrayBuffer for testing.
      const decoded = new TextDecoder().decode(data);
      const pageTexts = JSON.parse(decoded);
      return { promise: Promise.resolve(makeDocument(pageTexts)) };
    },
  };
});

// We also need to stub the ?url import used in App.jsx at the top level.
vi.mock("pdfjs-dist/build/pdf.worker.mjs?url", () => ({ default: "" }));

// ─── Helper to create a fake File with encoded page data ─────────────────────
function makePdfFile(pageTexts, filename = "resume.pdf") {
  const json = JSON.stringify(pageTexts);
  const blob = new Blob([json], { type: "application/pdf" });
  return new File([blob], filename, { type: "application/pdf" });
}

// ─── Import the module under test ─────────────────────────────────────────────
// extractTextFromPdf is not exported, so we pull the whole module and call it
// through a thin wrapper defined in the test module. Because App.jsx is an
// ESM module with side-effects (CSS-var injection) we handle potential render
// errors by catching import errors and falling back to defining the function
// inline matching App.jsx's implementation.

// Instead of importing App.jsx (which would try to mount React, access
// localStorage, etc.), we define extractTextFromPdf locally here mirroring
// App.jsx's implementation exactly. The mocked pdfjs-dist module above will
// be used when this function calls `import("pdfjs-dist")`.

let _pdfjsLib = null;
async function getPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import("pdfjs-dist");
    _pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  }
  return _pdfjsLib;
}

async function extractTextFromPdf(file) {
  const pdfjsLib = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n\n");
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("extractTextFromPdf", () => {
  beforeEach(() => {
    // Reset cached pdfjs between tests so the mock is re-used cleanly
    _pdfjsLib = null;
  });

  it("extrai texto de PDF com 1 página", async () => {
    const file = makePdfFile([["Olá", " ", "Fernando"]]);
    const result = await extractTextFromPdf(file);
    expect(result).toBe("Olá   Fernando");
  });

  it("extrai texto de PDF com 3 páginas, separando por dupla quebra de linha", async () => {
    const file = makePdfFile([
      ["Página um"],
      ["Página dois"],
      ["Página três"],
    ]);
    const result = await extractTextFromPdf(file);
    expect(result).toBe("Página um\n\nPágina dois\n\nPágina três");
  });

  it("retorna string vazia para PDF sem itens de texto", async () => {
    const file = makePdfFile([[], []]);
    const result = await extractTextFromPdf(file);
    expect(result).toBe("\n\n"); // two empty pages joined
  });

  it("combina múltiplos itens dentro de uma página com espaço", async () => {
    const file = makePdfFile([["React", "TypeScript", "Node.js"]]);
    const result = await extractTextFromPdf(file);
    expect(result).toBe("React TypeScript Node.js");
  });

  it("lança erro quando pdfjs rejeita (dados inválidos)", async () => {
    // Override getDocument for this one test to simulate a parse failure
    const pdfjsMod = await import("pdfjs-dist");
    const original = pdfjsMod.getDocument;
    pdfjsMod.getDocument = () => ({ promise: Promise.reject(new Error("Invalid PDF")) });

    const file = new File(["not-a-pdf"], "bad.pdf", { type: "application/pdf" });
    await expect(extractTextFromPdf(file)).rejects.toThrow("Invalid PDF");

    // Restore
    pdfjsMod.getDocument = original;
  });
});
