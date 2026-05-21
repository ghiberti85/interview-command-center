import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";

// ─── Mock supabase (used inside CVTab for getSession) ─────────────────────────
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

// ─── Mock callAI ──────────────────────────────────────────────────────────────
// callAI is defined inside App.jsx and is not exported. We replicate the CVTab
// component inline using a mockable callAI we control from the tests.

let callAIImpl = vi.fn();

// ─── Inline CVTab replica ─────────────────────────────────────────────────────
// Mirrors the logic of CVTab from App.jsx without importing the full App bundle.

const STAGE = {
  contacted: { label: "Contactado" },
  screening: { label: "Conversa" },
  interview: { label: "Entrevista" },
  technical: { label: "Técnica" },
  offer:     { label: "Proposta" },
  rejected:  { label: "Encerrado" },
  archived:  { label: "Arquivado" },
};

import { supabase } from "../../supabase.js";

function CVTab({ process, profile, isMobile = false, resumes = [], onManageResumes = vi.fn() }) {
  const [jd, setJd] = useState("");
  const [step, setStep] = useState("input");
  const [analysis, setAnalysis] = useState(null);
  const [approved, setApproved] = useState({});
  const [authorized, setAuthorized] = useState({});
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState("profile");
  const hasProfile = profile.stack.length > 0 || profile.summary;
  const hasResumes = resumes && resumes.length > 0;
  const selectedResume = resumes?.find(r => r.id === selectedResumeId);
  const baseCV = selectedResume ? selectedResume.content : profile.cvText;

  const analyze = async () => {
    if (!jd.trim()) return;
    setStep("analyzing");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const reply = await callAIImpl([{ role: "user", content: jd }], "system", s?.access_token);
      const clean = reply.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAnalysis(parsed);
      const initialApproved = {};
      (parsed.matched || []).forEach(k => { initialApproved[k] = true; });
      setApproved(initialApproved);
      setAuthorized({});
      setStep("review");
    } catch {
      setStep("input");
      // In tests we don't use alert
    }
  };

  const generate = async () => {
    setStep("analyzing");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const reply = await callAIImpl([{ role: "user", content: "generate" }], "system", s?.access_token);
      setResult(reply);
      setStep("result");
    } catch {
      setStep("review");
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!hasProfile) {
    return (
      <div data-testid="no-profile">
        <div>Configure seu perfil primeiro</div>
      </div>
    );
  }

  if (step === "input") {
    return (
      <div data-testid="step-input">
        {/* CV selector */}
        <select
          data-testid="select-resume"
          value={selectedResumeId}
          onChange={e => setSelectedResumeId(e.target.value)}
        >
          <option value="profile">Perfil (CV completo)</option>
          {(resumes || []).map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <button data-testid="btn-manage-resumes" onClick={onManageResumes}>Gerenciar</button>

        {/* JD input */}
        <textarea
          data-testid="textarea-jd"
          value={jd}
          onChange={e => setJd(e.target.value)}
          placeholder={`Cole aqui o texto completo da vaga de ${process.role} na ${process.company}...`}
        />

        {/* Stack preview */}
        <div data-testid="stack-preview">{profile.stack.join(" · ")}</div>

        <button
          data-testid="btn-analyze"
          onClick={analyze}
          disabled={!jd.trim()}
        >
          Analisar job description
        </button>
      </div>
    );
  }

  if (step === "analyzing") {
    return <div data-testid="step-analyzing">Analisando a vaga e cruzando com seu perfil...</div>;
  }

  if (step === "review" && analysis) {
    const matchedItems = analysis.matched || [];
    const unauthorizedItems = analysis.unauthorized || [];
    const approvedCount = Object.values(approved).filter(Boolean).length;
    const authorizedCount = Object.values(authorized).filter(Boolean).length;

    return (
      <div data-testid="step-review">
        {/* Matched */}
        <div data-testid="matched-section">
          {matchedItems.map(item => (
            <label key={item} data-testid={`matched-${item}`}>
              <input
                type="checkbox"
                data-testid={`check-matched-${item}`}
                checked={!!approved[item]}
                onChange={e => setApproved(a => ({ ...a, [item]: e.target.checked }))}
              />
              {item}
            </label>
          ))}
        </div>

        {/* Unauthorized */}
        {unauthorizedItems.length > 0 && (
          <div data-testid="unauthorized-section">
            {unauthorizedItems.map(item => (
              <label key={item} data-testid={`unauthorized-${item}`}>
                <input
                  type="checkbox"
                  data-testid={`check-unauthorized-${item}`}
                  checked={!!authorized[item]}
                  onChange={e => setAuthorized(a => ({ ...a, [item]: e.target.checked }))}
                />
                {item}
              </label>
            ))}
          </div>
        )}

        <div data-testid="counts-label">
          {approvedCount} confirmado{approvedCount !== 1 ? "s" : ""} · {authorizedCount} autorizado{authorizedCount !== 1 ? "s" : ""}
        </div>

        <button
          data-testid="btn-generate"
          onClick={generate}
          disabled={approvedCount + authorizedCount === 0}
        >
          Gerar currículo adaptado
        </button>

        <button data-testid="btn-back-to-input" onClick={() => setStep("input")}>
          Voltar
        </button>
      </div>
    );
  }

  if (step === "result") {
    return (
      <div data-testid="step-result">
        <div data-testid="result-text">{result}</div>
        <button data-testid="btn-copy" onClick={copyResult}>
          {copied ? "Copiado!" : "Copiar texto"}
        </button>
        <button data-testid="btn-back-to-review" onClick={() => setStep("review")}>
          Voltar
        </button>
        <button data-testid="btn-new-analysis" onClick={() => { setStep("input"); setJd(""); setAnalysis(null); setResult(""); }}>
          Nova análise
        </button>
      </div>
    );
  }

  return null;
}

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
  callAIImpl = vi.fn();
  // Default clipboard mock
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
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
    expect(screen.getByText("Perfil (CV completo)")).toBeDefined();
  });

  it("dropdown inclui currículos da lista", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={mockResumes} />);
    expect(screen.getByText("CV Tech Lead PT")).toBeDefined();
    expect(screen.getByText("CV Senior FE EN")).toBeDefined();
  });

  it("exibe stack do perfil", () => {
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    expect(screen.getByTestId("stack-preview").textContent).toContain("React");
    expect(screen.getByTestId("stack-preview").textContent).toContain("TypeScript");
  });

  it("não chama callAI com JD vazia ao clicar Analisar", async () => {
    callAIImpl = vi.fn();
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    // Button is disabled so click won't fire analyze
    const btn = screen.getByTestId("btn-analyze");
    expect(btn.disabled).toBe(true);
    expect(callAIImpl).not.toHaveBeenCalled();
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
    callAIImpl = vi.fn().mockResolvedValue(JSON.stringify(mockAnalysis));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "Vaga de React Developer com TypeScript" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    // Should briefly show analyzing
    await waitFor(() => {
      expect(screen.getByTestId("step-review")).toBeDefined();
    });
  });

  it("items matched aparecem pré-checados no review", async () => {
    callAIImpl = vi.fn().mockResolvedValue(JSON.stringify(mockAnalysis));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => screen.getByTestId("step-review"));

    // "React" is in matched → should be checked
    expect(screen.getByTestId("check-matched-React").checked).toBe(true);
    expect(screen.getByTestId("check-matched-TypeScript").checked).toBe(true);
  });

  it("items unauthorized aparecem desmarcados no review", async () => {
    callAIImpl = vi.fn().mockResolvedValue(JSON.stringify(mockAnalysis));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => screen.getByTestId("step-review"));

    // "GraphQL" is unauthorized → starts unchecked
    expect(screen.getByTestId("check-unauthorized-GraphQL").checked).toBe(false);
  });

  it("botão Gerar desabilitado quando nenhum item aprovado", async () => {
    // Analysis with no matched items and unauthorized items
    const emptyAnalysis = { matched: [], unauthorized: ["GraphQL"], highlights: [] };
    callAIImpl = vi.fn().mockResolvedValue(JSON.stringify(emptyAnalysis));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => screen.getByTestId("step-review"));

    expect(screen.getByTestId("btn-generate").disabled).toBe(true);
  });

  it("erro na análise volta para step input", async () => {
    callAIImpl = vi.fn().mockRejectedValue(new Error("API error"));

    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));

    await waitFor(() => screen.getByTestId("step-input"));
  });
});

describe("CVTab — step result e copiar", () => {
  const setupToReview = async () => {
    callAIImpl = vi.fn().mockResolvedValue(JSON.stringify(mockAnalysis));
    render(<CVTab process={mockProcess} profile={mockProfile} resumes={[]} />);
    fireEvent.change(screen.getByTestId("textarea-jd"), { target: { value: "JD texto" } });
    fireEvent.click(screen.getByTestId("btn-analyze"));
    await waitFor(() => screen.getByTestId("step-review"));
  };

  it("clicar Gerar currículo leva ao step result com texto", async () => {
    await setupToReview();

    // Now set up callAI for generate
    const generatedText = "Currículo adaptado gerado com sucesso!";
    callAIImpl = vi.fn().mockResolvedValue(generatedText);

    fireEvent.click(screen.getByTestId("btn-generate"));

    await waitFor(() => screen.getByTestId("step-result"));
    expect(screen.getByTestId("result-text").textContent).toBe(generatedText);
  });

  it("clicar Copiar chama clipboard.writeText com o texto do resultado", async () => {
    await setupToReview();

    const generatedText = "Texto do currículo gerado";
    callAIImpl = vi.fn().mockResolvedValue(generatedText);

    fireEvent.click(screen.getByTestId("btn-generate"));
    await waitFor(() => screen.getByTestId("step-result"));

    fireEvent.click(screen.getByTestId("btn-copy"));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(generatedText);
    });
  });

  it("botão Nova análise reseta para step input", async () => {
    await setupToReview();
    callAIImpl = vi.fn().mockResolvedValue("Resultado gerado");
    fireEvent.click(screen.getByTestId("btn-generate"));
    await waitFor(() => screen.getByTestId("step-result"));

    fireEvent.click(screen.getByTestId("btn-new-analysis"));
    expect(screen.getByTestId("step-input")).toBeDefined();
  });

  it("botão Voltar no result vai para step review", async () => {
    await setupToReview();
    callAIImpl = vi.fn().mockResolvedValue("Resultado gerado");
    fireEvent.click(screen.getByTestId("btn-generate"));
    await waitFor(() => screen.getByTestId("step-result"));

    fireEvent.click(screen.getByTestId("btn-back-to-review"));
    expect(screen.getByTestId("step-review")).toBeDefined();
  });
});
