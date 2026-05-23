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
  getPdfjs: vi.fn(),
  extractTextFromPdf: vi.fn(),
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

const emptyProfile = {
  stack: [],
  summary: "",
  cvText: "",
};

const mockResumes = [
  { id: "r1", name: "CV Tech Lead PT", language: "pt", content: "Conteúdo PT", created_at: "2026-05-01T00:00:00Z" },
  { id: "r2", name: "CV Senior FE EN", language: "en", content: "Content EN", created_at: "2026-04-20T00:00:00Z" },
];

const mockAnalysis = {
  jd_keywords: ["React", "GraphQL"],
  matched: ["React", "TypeScript"],
  unauthorized: ["GraphQL"],
  highlights: ["10 anos de experiência", "Liderança de times"],
  adapted_summary: "Resumo adaptado para Nubank",
  adapted_highlights: "Bullet points adaptados",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default clipboard mock
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  // Suppress alert calls
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
    const profileWithStack = { stack: ["React"], summary: "", cvText: "" };
    render(<CVTab process={mockProcess} profile={profileWithStack} resumes={[]} />);
    expect(screen.getByTestId("step-input")).toBeDefined();
  });

  it("exibe step-input quando tem summary mesmo sem stack", () => {
    const profileWithSummary = { stack: [], summary: "Engenheiro senior", cvText: "" };
    render(<CVTab process={mockProcess} profile={profileWithSummary} resumes={[]} />);
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
    const btn = screen.getByTestId("btn-analyze");
    expect(btn.disabled).toBe(true);
  });

  it("botão Analisar fica habilitado quando JD tem conteúdo", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "Vaga de React Developer" } });
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

  it("não chama callAI com JD vazia ao clicar Analisar", async () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    // Button is disabled so click won't fire analyze
    const btn = screen.getByTestId("btn-analyze");
    expect(btn.disabled).toBe(true);
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it("botão Gerenciar chama onManageResumes", () => {
    const onManageResumes = vi.fn();
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} onManageResumes={onManageResumes} />);
    fireEvent.click(screen.getByTestId("btn-manage-resumes"));
    expect(onManageResumes).toHaveBeenCalledOnce();
  });
});

describe("CVTab — análise via IA e step review", () => {
  it("clicando Analisar exibe step analyzing e depois review", async () => {
    mockCallAI.mockResolvedValue(JSON.stringify(mockAnalysis));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "Vaga de React Developer com TypeScript" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => {
      expect(screen.getByTestId("step-review")).toBeDefined();
    });
  });

  it("items matched aparecem pré-checados no review", async () => {
    mockCallAI.mockResolvedValue(JSON.stringify(mockAnalysis));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => screen.getByTestId("step-review"));

    expect(screen.getByTestId("check-matched-React").checked).toBe(true);
    expect(screen.getByTestId("check-matched-TypeScript").checked).toBe(true);
  });

  it("items unauthorized aparecem desmarcados no review", async () => {
    mockCallAI.mockResolvedValue(JSON.stringify(mockAnalysis));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => screen.getByTestId("step-review"));

    expect(screen.getByTestId("check-unauthorized-GraphQL").checked).toBe(false);
  });

  it("botão Gerar desabilitado quando nenhum item aprovado", async () => {
    const emptyAnalysis = { matched: [], unauthorized: ["GraphQL"], highlights: [] };
    mockCallAI.mockResolvedValue(JSON.stringify(emptyAnalysis));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => screen.getByTestId("step-review"));

    expect(screen.getByTestId("btn-generate").disabled).toBe(true);
  });

  it("erro na análise volta para step input", async () => {
    mockCallAI.mockRejectedValue(new Error("API error"));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => screen.getByTestId("step-input"));
  });
});

describe("CVTab — step result e copiar", () => {
  const setupToReview = async () => {
    mockCallAI.mockResolvedValue(JSON.stringify(mockAnalysis));
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => screen.getByTestId("step-review"));
  };

  it("clicar Gerar currículo leva ao step result com texto", async () => {
    await setupToReview();

    const generatedText = "Currículo adaptado gerado com sucesso!";
    mockCallAI.mockResolvedValue(generatedText);

    fireEvent.click(screen.getByTestId("btn-generate"));

    await waitFor(() => screen.getByTestId("step-result"));
    expect(screen.getByTestId("result-text").textContent).toBe(generatedText);
  });

  it("clicar Copiar chama clipboard.writeText com o texto do resultado", async () => {
    await setupToReview();

    const generatedText = "Texto do currículo gerado";
    mockCallAI.mockResolvedValue(generatedText);

    fireEvent.click(screen.getByTestId("btn-generate"));
    await waitFor(() => screen.getByTestId("step-result"));

    fireEvent.click(screen.getByTestId("btn-copy"));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(generatedText);
    });
  });

  it("botão Nova análise reseta para step input", async () => {
    await setupToReview();
    mockCallAI.mockResolvedValue("Resultado gerado");
    fireEvent.click(screen.getByTestId("btn-generate"));
    await waitFor(() => screen.getByTestId("step-result"));

    fireEvent.click(screen.getByTestId("btn-new-analysis"));
    expect(screen.getByTestId("step-input")).toBeDefined();
  });

  it("botão Voltar no result vai para step review", async () => {
    await setupToReview();
    mockCallAI.mockResolvedValue("Resultado gerado");
    fireEvent.click(screen.getByTestId("btn-generate"));
    await waitFor(() => screen.getByTestId("step-result"));

    fireEvent.click(screen.getByTestId("btn-back-to-review"));
    expect(screen.getByTestId("step-review")).toBeDefined();
  });
});
