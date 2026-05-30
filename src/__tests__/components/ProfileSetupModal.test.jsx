import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock extractTextFromPdf (lib/ai.js carrega pdfjs dinamicamente) ───────────
const mockExtractTextFromPdf = vi.fn();
vi.mock("../../lib/ai.js", () => ({
  extractTextFromPdf: (...args) => mockExtractTextFromPdf(...args),
  callAI: vi.fn(),
}));

// ── Mock supabase ─────────────────────────────────────────────────────────────
vi.mock("../../supabase.js", () => ({
  supabase: { auth: { updateUser: vi.fn().mockResolvedValue({ error: null }) } },
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

function makeFakeFile(name, content = "") {
  return new File([content], name, { type: "application/pdf" });
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

  it("navega para aba CV", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV" }));
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

  it("exibe área 'Importar CV em PDF' na aba CV", async () => {
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV" }));
    expect(screen.getByText("Importar CV em PDF")).toBeInTheDocument();
    expect(screen.getByText(/Arraste ou clique/i)).toBeInTheDocument();
  });

  it("extrai texto de PDF e preenche o textarea", async () => {
    mockExtractTextFromPdf.mockResolvedValue("Texto do CV extraído do PDF");
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV" }));

    const input = document.querySelector('input[type="file"][accept=".pdf"]');
    const file = makeFakeFile("meu-cv.pdf");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Cole aqui o texto/i);
      expect(textarea.value).toContain("Texto do CV extraído do PDF");
    });
  });

  it("exibe erro quando extração falha", async () => {
    mockExtractTextFromPdf.mockRejectedValue(new Error("PDF corrompido"));
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV" }));

    const input = document.querySelector('input[type="file"][accept=".pdf"]');
    const file = makeFakeFile("corrompido.pdf");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("PDF corrompido")).toBeInTheDocument();
    });
  });

  it("textarea permanece editável depois do upload", async () => {
    mockExtractTextFromPdf.mockResolvedValue("Texto extraído");
    render(<ProfileSetupModal {...defaultProps}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV" }));

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
    mockExtractTextFromPdf.mockResolvedValue("Conteúdo do CV");
    render(<ProfileSetupModal {...defaultProps} onSave={onSave}/>);
    await userEvent.click(screen.getByRole("button", { name: "CV" }));

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
