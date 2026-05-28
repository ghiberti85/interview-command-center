import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const mockDraftText = "Olá Ana, obrigado pelo contato! Tenho interesse em conhecer melhor a oportunidade na Nubank.";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const setupToResult = async () => {
  mockCallAI
    .mockResolvedValueOnce(mockExtracted)   // extraction call
    .mockResolvedValueOnce(mockDraftText);  // draft call (plain text)

  render(<RecruiterMessageModal {...defaultProps} />);
  await userEvent.type(screen.getByTestId("msg-input"), "Mensagem de recrutador da Nubank");
  await userEvent.click(screen.getByTestId("btn-analyze"));

  // Wait for result step to appear (extraction done)
  await waitFor(() => screen.getByDisplayValue("Nubank"));
  // Wait for draft to finish loading
  await waitFor(() => screen.getByTestId("draft-output"));
};

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("RecruiterMessageModal — step paste", () => {
  it("renderiza textarea para colar mensagem", () => {
    render(<RecruiterMessageModal {...defaultProps} />);
    expect(screen.getByTestId("msg-input")).toBeDefined();
    expect(screen.getByPlaceholderText(/Cole a mensagem aqui/i)).toBeDefined();
  });

  it("botão Analisar desabilitado quando mensagem vazia", () => {
    render(<RecruiterMessageModal {...defaultProps} />);
    expect(screen.getByTestId("btn-analyze").disabled).toBe(true);
  });

  it("botão Analisar habilitado após digitar mensagem", async () => {
    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.type(screen.getByTestId("msg-input"), "Olá Fernando");
    expect(screen.getByTestId("btn-analyze").disabled).toBe(false);
  });

  it("initialMsg pré-preenche o textarea", () => {
    render(<RecruiterMessageModal {...defaultProps} initialMsg="Mensagem pré-preenchida" />);
    expect(screen.getByDisplayValue("Mensagem pré-preenchida")).toBeDefined();
  });

  it("botão Analisar habilitado quando initialMsg presente", () => {
    render(<RecruiterMessageModal {...defaultProps} initialMsg="Mensagem pré-preenchida" />);
    expect(screen.getByTestId("btn-analyze").disabled).toBe(false);
  });

  it("clicar no X chama onClose", async () => {
    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.click(screen.getByTestId("btn-close"));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });
});

describe("RecruiterMessageModal — extração via IA", () => {
  it("exibe spinner no step working", async () => {
    // Mock that never resolves so we can check the working state
    mockCallAI.mockImplementation(() => new Promise(() => {}));
    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.type(screen.getByTestId("msg-input"), "Mensagem");
    await userEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => {
      expect(screen.getByText(/Extraindo informações/i)).toBeDefined();
    });
  });

  it("após extração exibe campos company e role preenchidos", async () => {
    mockCallAI
      .mockResolvedValueOnce(mockExtracted)
      .mockResolvedValue(mockDraftText);
    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.type(screen.getByTestId("msg-input"), "Mensagem");
    await userEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => screen.getByDisplayValue("Nubank"));
    expect(screen.getByDisplayValue("Senior Frontend Engineer")).toBeDefined();
  });

  it("exibe erro quando extração falha e volta ao paste", async () => {
    mockCallAI.mockRejectedValue(new Error("API error"));
    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.type(screen.getByTestId("msg-input"), "Mensagem");
    await userEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => {
      expect(screen.getByText(/Não foi possível extrair/i)).toBeDefined();
    });
    // Should be back on paste step
    expect(screen.getByTestId("msg-input")).toBeDefined();
  });
});

describe("RecruiterMessageModal — step result", () => {
  it("campos extraídos são editáveis", async () => {
    await setupToResult();
    const companyInput = screen.getByTestId("field-company");
    await userEvent.clear(companyInput);
    await userEvent.type(companyInput, "Stone");
    expect(screen.getByDisplayValue("Stone")).toBeDefined();
  });

  it("exibe rascunho de resposta em plain text", async () => {
    await setupToResult();
    expect(screen.getByDisplayValue(mockDraftText)).toBeDefined();
  });

  it("botão Copiar chama clipboard com texto do draft", async () => {
    await setupToResult();
    await userEvent.click(screen.getByTestId("btn-copy"));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockDraftText);
    });
  });

  it("botão Salvar chama onProcessCreated com dados corretos", async () => {
    await setupToResult();
    await userEvent.click(screen.getByTestId("btn-save"));
    expect(defaultProps.onProcessCreated).toHaveBeenCalledOnce();
    const created = defaultProps.onProcessCreated.mock.calls[0][0];
    expect(created.company).toBe("Nubank");
    expect(created.stage).toBe("contacted");
    expect(created.origin).toBe("inbound");
    expect(created.channel).toBe("linkedin");
  });

  it("tags criadas a partir da stack extraída", async () => {
    await setupToResult();
    await userEvent.click(screen.getByTestId("btn-save"));
    const created = defaultProps.onProcessCreated.mock.calls[0][0];
    expect(created.tags).toContain("React");
    expect(created.tags).toContain("TypeScript");
  });

  it("notas incluem mensagem original", async () => {
    await setupToResult();
    await userEvent.click(screen.getByTestId("btn-save"));
    const created = defaultProps.onProcessCreated.mock.calls[0][0];
    expect(created.notes).toContain("Mensagem de recrutador da Nubank");
  });

  it("após salvar botão muda para 'Abrir processo' e chama onClose ao clicar", async () => {
    await setupToResult();
    await userEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => {
      expect(screen.getByText(/Abrir processo/i)).toBeDefined();
    });
    await userEvent.click(screen.getByTestId("btn-save"));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it("botão Voltar retorna ao step paste", async () => {
    await setupToResult();
    await userEvent.click(screen.getByTestId("btn-back"));
    expect(screen.getByTestId("msg-input")).toBeDefined();
  });
});

describe("RecruiterMessageModal — sem draft", () => {
  it("exibe mensagem de fallback quando draft falha", async () => {
    mockCallAI
      .mockResolvedValueOnce(mockExtracted) // extraction ok
      .mockRejectedValueOnce(new Error("draft error")); // draft fails

    render(<RecruiterMessageModal {...defaultProps} />);
    await userEvent.type(screen.getByTestId("msg-input"), "Mensagem");
    await userEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => screen.getByDisplayValue("Nubank"));
    await waitFor(() => {
      expect(screen.getByText(/Não foi possível gerar a resposta/i)).toBeDefined();
    });
    // Save button still appears
    expect(screen.getByTestId("btn-save")).toBeDefined();
  });
});
