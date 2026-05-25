import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CVTab from "../../components/tabs/CVTab.jsx";

// ─── Mock supabase ─────────────────────────────────────────────────────────────
vi.mock("../../supabase.js", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token" } },
      }),
    },
  },
  rowToProcess: (r) => r,
  processToRow: (p) => p,
}));

// ─── Mock callAI from lib/ai.js ───────────────────────────────────────────────
const mockCallAI = vi.fn();
vi.mock("../../lib/ai.js", () => ({
  callAI: (...args) => mockCallAI(...args),
  AI_PROXY_URL: "https://mock.proxy/",
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const mockProcess = {
  id: "p1",
  company: "Nubank",
  role: "Senior FE Engineer",
  stage: "interview",
};

const mockProfile = {
  stack: ["React", "TypeScript", "Node.js"],
  summary: "Senior Full-Stack com 10 anos de experiência.",
  cvText: "Meu currículo completo aqui.",
};

const emptyProfile = { stack: [], summary: "", cvText: "" };

const mockResumes = [
  { id: "r1", name: "CV Tech Lead PT", language: "pt", content: "Conteúdo PT", created_at: "2026-05-01T00:00:00Z" },
  { id: "r2", name: "CV Senior FE EN", language: "en", content: "Content EN", created_at: "2026-04-20T00:00:00Z" },
];

// AI returns questions on first call
const mockQuestions = {
  questions: [
    { id: "q1", tech: "React", question: "Você tem experiência com React em produção?" },
    { id: "q2", tech: "GraphQL", question: "Você trabalhou com GraphQL?" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  vi.stubGlobal("alert", vi.fn());
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("CVTab — sem perfil configurado", () => {
  it("exibe mensagem de configuração de perfil quando stack vazia e sem resumo", () => {
    render(<CVTab process={mockProcess} profile={emptyProfile} resumes={[]} />);
    expect(screen.getByTestId("no-profile")).toBeDefined();
    expect(screen.getByText("Configure seu perfil primeiro")).toBeDefined();
  });

  it("exibe step-input quando tem stack mesmo sem summary", () => {
    render(<CVTab process={mockProcess} profile={{ stack: ["React"], summary: "", cvText: "" }} resumes={[]} />);
    expect(screen.getByTestId("step-input")).toBeDefined();
  });

  it("exibe step-input quando tem summary mesmo sem stack", () => {
    render(<CVTab process={mockProcess} profile={{ stack: [], summary: "Engenheiro", cvText: "" }} resumes={[]} />);
    expect(screen.getByTestId("step-input")).toBeDefined();
  });
});

describe("CVTab — step input", () => {
  it("renderiza step input com perfil válido", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={mockResumes} />);
    expect(screen.getByTestId("step-input")).toBeDefined();
  });

  it("botão Analisar está desabilitado com JD vazia", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    expect(screen.getByTestId("btn-analyze").disabled).toBe(true);
  });

  it("botão Analisar fica habilitado quando JD tem conteúdo", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "Vaga React" } });
    expect(screen.getByTestId("btn-analyze").disabled).toBe(false);
  });

  it("dropdown inclui opção de perfil", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    expect(screen.getByText(/Perfil/)).toBeDefined();
  });

  it("dropdown inclui currículos da lista", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={mockResumes} />);
    expect(screen.getByText(/CV Tech Lead PT/)).toBeDefined();
    expect(screen.getByText(/CV Senior FE EN/)).toBeDefined();
  });

  it("exibe stack do perfil", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    expect(screen.getByTestId("stack-preview").textContent).toContain("React");
    expect(screen.getByTestId("stack-preview").textContent).toContain("TypeScript");
  });

  it("botão Gerenciar chama onManageResumes", () => {
    const onManageResumes = vi.fn();
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} onManageResumes={onManageResumes} />);
    fireEvent.click(screen.getByTestId("btn-manage-resumes"));
    expect(onManageResumes).toHaveBeenCalledOnce();
  });

  it("exibe banner de adaptação salva quando adaptation presente", () => {
    const adaptation = { content: "CV adaptado", updatedAt: "2026-05-25T10:00:00Z" };
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} adaptation={adaptation} />);
    expect(screen.getByText(/Adaptação salva em/)).toBeDefined();
  });
});

describe("CVTab — fluxo Q&A", () => {
  const setupToQA = async () => {
    mockCallAI.mockResolvedValue(JSON.stringify(mockQuestions));
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "Vaga React com GraphQL" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => screen.getByTestId("step-qa"));
  };

  it("após analisar exibe step-qa com perguntas", async () => {
    await setupToQA();
    expect(screen.getByTestId("qa-item-q1")).toBeDefined();
    expect(screen.getByTestId("qa-item-q2")).toBeDefined();
  });

  it("perguntas exibem o texto correto", async () => {
    await setupToQA();
    expect(screen.getByText("Você tem experiência com React em produção?")).toBeDefined();
    expect(screen.getByText("Você trabalhou com GraphQL?")).toBeDefined();
  });

  it("botão Gerar desabilitado quando nem todas as perguntas respondidas", async () => {
    await setupToQA();
    expect(screen.getByTestId("btn-generate").disabled).toBe(true);
  });

  it("botão Gerar habilitado após responder todas as perguntas", async () => {
    await setupToQA();
    fireEvent.click(screen.getByTestId("qa-yes-q1"));
    fireEvent.click(screen.getByTestId("qa-no-q2"));
    expect(screen.getByTestId("btn-generate").disabled).toBe(false);
  });

  it("clicar Sim destaca a pergunta com cor verde", async () => {
    await setupToQA();
    fireEvent.click(screen.getByTestId("qa-yes-q1"));
    const btn = screen.getByTestId("qa-yes-q1");
    expect(btn.style.color).toContain("grn");
  });

  it("botão Voltar no Q&A retorna para step-input", async () => {
    await setupToQA();
    fireEvent.click(screen.getByTestId("btn-back-to-input"));
    expect(screen.getByTestId("step-input")).toBeDefined();
  });

  it("erro na análise retorna ao step-input", async () => {
    mockCallAI.mockRejectedValue(new Error("API error"));
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => screen.getByTestId("step-input"));
  });
});

describe("CVTab — step result", () => {
  const setupToResult = async () => {
    mockCallAI
      .mockResolvedValueOnce(JSON.stringify(mockQuestions))
      .mockResolvedValueOnce("Currículo adaptado gerado!");

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} onSaveAdaptation={vi.fn()} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "Vaga React com GraphQL" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => screen.getByTestId("step-qa"));

    fireEvent.click(screen.getByTestId("qa-yes-q1"));
    fireEvent.click(screen.getByTestId("qa-no-q2"));
    fireEvent.click(screen.getByTestId("btn-generate"));
    await waitFor(() => screen.getByTestId("step-result"));
  };

  it("exibe o texto do currículo gerado", async () => {
    await setupToResult();
    expect(screen.getByTestId("result-text").textContent).toBe("Currículo adaptado gerado!");
  });

  it("clicar Copiar chama clipboard.writeText", async () => {
    await setupToResult();
    fireEvent.click(screen.getByTestId("btn-copy"));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Currículo adaptado gerado!");
    });
  });

  it("botão Salvar adaptação chama onSaveAdaptation", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    mockCallAI
      .mockResolvedValueOnce(JSON.stringify(mockQuestions))
      .mockResolvedValueOnce("CV gerado");

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} onSaveAdaptation={onSave} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => screen.getByTestId("step-qa"));
    fireEvent.click(screen.getByTestId("qa-yes-q1"));
    fireEvent.click(screen.getByTestId("qa-no-q2"));
    fireEvent.click(screen.getByTestId("btn-generate"));
    await waitFor(() => screen.getByTestId("step-result"));

    fireEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith("CV gerado", "JD", expect.any(Array));
  });

  it("botão Nova análise reseta para step-input", async () => {
    await setupToResult();
    fireEvent.click(screen.getByTestId("btn-new-analysis"));
    expect(screen.getByTestId("step-input")).toBeDefined();
  });

  it("botão Voltar no result vai para step-qa", async () => {
    await setupToResult();
    fireEvent.click(screen.getByTestId("btn-back-to-qa"));
    expect(screen.getByTestId("step-qa")).toBeDefined();
  });
});
