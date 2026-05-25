import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecruiterMessageModal } from "../../components/modals/RecruiterMessageModal.jsx";

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("../../supabase.js", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token" } },
      }),
    },
  },
}));

const mockCallAI = vi.fn();
vi.mock("../../lib/ai.js", () => ({
  callAI: (...args) => mockCallAI(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const mockExtracted = JSON.stringify({
  recruiter: "Ana Lima",
  recruiterRole: "Tech Recruiter",
  company: "Nubank",
  role: "Senior Frontend Engineer",
  stack: "React, TypeScript, GraphQL",
  regime: "remoto",
  salary: "R$ 25k-30k",
  nextStep: "Call de 30min",
  location: "São Paulo, SP",
});

const mockDraft = JSON.stringify({ body: "Olá Ana! Obrigado pelo contato…" });

const defaultProps = {
  onClose: vi.fn(),
  onProcessCreated: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("RecruiterMessageModal — step paste", () => {
  it("renderiza com textarea para colar mensagem", () => {
    render(<RecruiterMessageModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Cole aqui a mensagem completa/i)).toBeDefined();
  });

  it("botão Extrair desabilitado quando mensagem vazia", () => {
    render(<RecruiterMessageModal {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /Extrair informações/i });
    expect(btn.disabled).toBe(true);
  });

  it("botão Extrair habilitado após digitar mensagem", async () => {
    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/Cole aqui a mensagem completa/i), "Olá Fernando");
    expect(screen.getByRole("button", { name: /Extrair informações/i }).disabled).toBe(false);
  });

  it("clicar Cancelar chama onClose", async () => {
    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });
});

describe("RecruiterMessageModal — extração via IA", () => {
  it("após extração bem-sucedida exibe step review com campos preenchidos", async () => {
    mockCallAI.mockResolvedValueOnce(mockExtracted);
    render(<RecruiterMessageModal {...defaultProps} />);

    await userEvent.type(screen.getByPlaceholderText(/Cole aqui a mensagem completa/i), "Mensagem do recrutador da Nubank");
    await userEvent.click(screen.getByRole("button", { name: /Extrair informações/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Nubank")).toBeDefined();
    });
    expect(screen.getByDisplayValue("Ana Lima")).toBeDefined();
    expect(screen.getByDisplayValue("Senior Frontend Engineer")).toBeDefined();
  });

  it("exibe erro quando extração falha", async () => {
    mockCallAI.mockRejectedValue(new Error("API error"));
    render(<RecruiterMessageModal {...defaultProps} />);

    await userEvent.type(screen.getByPlaceholderText(/Cole aqui a mensagem completa/i), "Mensagem");
    await userEvent.click(screen.getByRole("button", { name: /Extrair informações/i }));

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível extrair/i)).toBeDefined();
    });
  });

  it("campos do review são editáveis", async () => {
    mockCallAI.mockResolvedValueOnce(mockExtracted);
    render(<RecruiterMessageModal {...defaultProps} />);

    await userEvent.type(screen.getByPlaceholderText(/Cole aqui a mensagem completa/i), "Mensagem");
    await userEvent.click(screen.getByRole("button", { name: /Extrair informações/i }));

    await waitFor(() => screen.getByDisplayValue("Nubank"));

    const companyInput = screen.getByDisplayValue("Nubank");
    await userEvent.clear(companyInput);
    await userEvent.type(companyInput, "Stone");
    expect(screen.getByDisplayValue("Stone")).toBeDefined();
  });
});

describe("RecruiterMessageModal — criação do processo e draft", () => {
  const setupToDraft = async () => {
    mockCallAI
      .mockResolvedValueOnce(mockExtracted)
      .mockResolvedValueOnce(mockDraft);

    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/Cole aqui a mensagem completa/i), "Mensagem de recrutador");
    await userEvent.click(screen.getByRole("button", { name: /Extrair informações/i }));
    await waitFor(() => screen.getByDisplayValue("Nubank"));
    await userEvent.click(screen.getByRole("button", { name: /Criar processo/i }));
    await waitFor(() => screen.getByText(/criado com sucesso/i));
  };

  it("clicar Criar processo chama onProcessCreated com dados corretos", async () => {
    await setupToDraft();
    expect(defaultProps.onProcessCreated).toHaveBeenCalledOnce();
    const created = defaultProps.onProcessCreated.mock.calls[0][0];
    expect(created.company).toBe("Nubank");
    expect(created.stage).toBe("contacted");
    expect(created.origin).toBe("inbound");
    expect(created.channel).toBe("linkedin");
  });

  it("exibe rascunho de resposta após criação", async () => {
    await setupToDraft();
    expect(screen.getByDisplayValue(/Olá Ana! Obrigado pelo contato/i)).toBeDefined();
  });

  it("botão Copiar chama clipboard.writeText com o draft", async () => {
    await setupToDraft();
    await userEvent.click(screen.getByRole("button", { name: /Copiar/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Olá Ana! Obrigado pelo contato…");
    });
  });

  it("tags criadas a partir da stack extraída", async () => {
    await setupToDraft();
    const created = defaultProps.onProcessCreated.mock.calls[0][0];
    expect(created.tags).toContain("React");
    expect(created.tags).toContain("TypeScript");
  });

  it("notas incluem mensagem original", async () => {
    await setupToDraft();
    const created = defaultProps.onProcessCreated.mock.calls[0][0];
    expect(created.notes).toContain("Mensagem de recrutador");
  });

  it("botão Abrir processo chama onClose", async () => {
    await setupToDraft();
    await userEvent.click(screen.getByRole("button", { name: /Abrir processo/i }));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });
});

describe("RecruiterMessageModal — navegação", () => {
  it("botão Voltar no review retorna ao step paste", async () => {
    mockCallAI.mockResolvedValueOnce(mockExtracted);
    render(<RecruiterMessageModal {...defaultProps} />);

    await userEvent.type(screen.getByPlaceholderText(/Cole aqui a mensagem completa/i), "Mensagem");
    await userEvent.click(screen.getByRole("button", { name: /Extrair informações/i }));
    await waitFor(() => screen.getByDisplayValue("Nubank"));

    await userEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(screen.getByPlaceholderText(/Cole aqui a mensagem completa/i)).toBeDefined();
  });
});
