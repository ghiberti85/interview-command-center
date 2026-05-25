import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock pdfjs-dist e worker ──────────────────────────────────────────────────
vi.mock("pdfjs-dist/build/pdf.worker.mjs?url", () => ({ default: "mock-worker.mjs" }));

const mockGetDocument = vi.fn();
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: (...args) => mockGetDocument(...args),
}));

// ── Import após mocks ─────────────────────────────────────────────────────────
import { ProfileSetupModal } from "../../components/modals/ProfileSetupModal.jsx";

// ── Helpers ───────────────────────────────────────────────────────────────────
const defaultProps = {
  onClose: vi.fn(),
  onSave: vi.fn(),
  isMobile: false,
  initial: { stack: ["React", "TypeScript"], summary: "Dev senior", cvText: "" },
};

function makePdfDocument(pages) {
  return {
    promise: Promise.resolve({
      numPages: pages.length,
      getPage: vi.fn(async (n) => ({
        getTextContent: async () => ({ items: pages[n - 1].map(str => ({ str })) }),
      })),
    }),
  };
}

function makeFakeFile(name, content = "") {
  return new File([content], name, { type: name.endsWith(".pdf") ? "application/pdf" : "text/plain" });
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe("ProfileSetupModal — abas", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renderiza com aba Stack ativa por padrão", () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    expect(screen.getByPlaceholderText(/React, Next\.js, TypeScript/i)).toBeInTheDocument();
  });

  it("pré-preenche stack com valor inicial", () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    const textarea = screen.getByPlaceholderText(/React, Next\.js, TypeScript/i);
    expect(textarea.value).toBe("React, TypeScript");
  });

  it("navega para aba Resumo", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "Resumo" }));
    expect(screen.getByPlaceholderText(/Senior Full-Stack/i)).toBeInTheDocument();
  });

  it("pré-preenche resumo com valor inicial", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "Resumo" }));
    expect(screen.getByPlaceholderText(/Senior Full-Stack/i).value).toBe("Dev senior");
  });

  it("navega para aba CV Completo", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV Completo" }));
    expect(screen.getByText("Importar CV em PDF")).toBeInTheDocument();
  });
});

describe("ProfileSetupModal — salvar", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("chama onSave com stack como array ao clicar Salvar", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: /Salvar perfil/i }));
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ stack: ["React", "TypeScript"] })
    );
  });

  it("chama onClose após salvar", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: /Salvar perfil/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("chama onClose ao clicar Cancelar", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("stack com vírgulas e espaços é split corretamente", async () => {
    const onSave = vi.fn();
    render(<ProfileSetupModal {...defaultProps} onSave={onSave} initial={{ stack: [], summary: "", cvText: "" }}/>);
    const textarea = screen.getByPlaceholderText(/React, Next\.js, TypeScript/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "React, Node.js, TypeScript");
    await userEvent.click(screen.getByRole("button", { name: /Salvar perfil/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ stack: ["React", "Node.js", "TypeScript"] })
    );
  });
});

describe("ProfileSetupModal — upload de PDF no cvText", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("exibe área 'Importar CV em PDF' na aba CV Completo", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV Completo" }));
    expect(screen.getByText("Importar CV em PDF")).toBeInTheDocument();
    expect(screen.getByText(/Arraste ou clique/i)).toBeInTheDocument();
  });

  it("extrai texto de PDF e preenche o textarea", async () => {
    mockGetDocument.mockReturnValue(makePdfDocument([["Texto do CV extraído do PDF"]]));
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV Completo" }));

    const input = document.querySelector('input[type="file"][accept=".pdf"]');
    const file = makeFakeFile("meu-cv.pdf");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(mockGetDocument).toHaveBeenCalled();
    });
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Cole aqui o texto/i);
      expect(textarea.value).toContain("Texto do CV extraído do PDF");
    });
  });

  it("exibe erro quando pdfjs rejeita", async () => {
    // getDocument rejeita → handlePdf captura e exibe e.message no estado de erro
    mockGetDocument.mockImplementation(() => ({ promise: Promise.reject(new Error("PDF corrompido")) }));
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV Completo" }));

    const input = document.querySelector('input[type="file"][accept=".pdf"]');
    const file = makeFakeFile("corrompido.pdf");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("PDF corrompido")).toBeInTheDocument();
    });
  });

  it("textarea permanece editável depois do upload", async () => {
    mockGetDocument.mockReturnValue(makePdfDocument([["Texto extraído"]]));
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV Completo" }));

    const input = document.querySelector('input[type="file"][accept=".pdf"]');
    const file = makeFakeFile("cv.pdf");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Cole aqui o texto/i);
      expect(textarea.value).toContain("Texto extraído");
    });

    const textarea = screen.getByPlaceholderText(/Cole aqui o texto/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Texto editado manualmente");
    expect(textarea.value).toBe("Texto editado manualmente");
  });

  it("salva cvText extraído do PDF no onSave", async () => {
    const onSave = vi.fn();
    mockGetDocument.mockReturnValue(makePdfDocument([["Conteúdo do CV"]]));
    render(<ProfileSetupModal {...defaultProps} onSave={onSave}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV Completo" }));

    const input = document.querySelector('input[type="file"][accept=".pdf"]');
    const file = makeFakeFile("cv.pdf");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Cole aqui o texto/i);
      expect(textarea.value).toContain("Conteúdo do CV");
    });

    await userEvent.click(screen.getByRole("button", { name: /Salvar perfil/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ cvText: expect.stringContaining("Conteúdo do CV") })
    );
  });
});
