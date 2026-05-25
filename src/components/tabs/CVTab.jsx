import { useState } from "react";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

const QA_SYSTEM = `Você é um especialista em análise de vagas de tecnologia.
Sua tarefa é gerar perguntas binárias (sim/não) para verificar a experiência real do candidato com as tecnologias e práticas exigidas pela vaga.
Retorne APENAS JSON válido, sem markdown, sem explicações adicionais.`;

const CV_SYSTEM = `Você é um especialista em currículos para tecnologia. Sua tarefa é adaptar um currículo existente para uma vaga específica.
REGRAS ABSOLUTAS:
1. Preserve a estrutura, seções e ordem exatas do currículo base — não adicione nem remova seções
2. Nunca mencione tecnologias que o candidato disse não ter experiência ou que não confirmou
3. Adapte apenas o conteúdo textual — reescreva com foco nas habilidades confirmadas relevantes para a vaga
4. Responda em português, a menos que o currículo base esteja em inglês`;

export function CVTab({ process, profile, isMobile, resumes, onManageResumes, adaptation, onSaveAdaptation, session }) {
  const [jd, setJd] = useState("");
  const [step, setStep] = useState("input"); // input | analyzing | qa | generating | result
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState("profile");

  const hasProfile = profile.stack.length > 0 || profile.summary;
  const hasResumes = resumes && resumes.length > 0;
  const selectedResume = resumes?.find(r => r.id === selectedResumeId);
  const baseCV = selectedResume ? selectedResume.content : profile.cvText;

  // Show saved adaptation banner
  const hasSavedAdaptation = !!adaptation?.content;

  const generateQuestions = async () => {
    if (!jd.trim()) return;
    setStep("analyzing");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const stackList = profile.stack.length > 0 ? profile.stack.join(", ") : "(não informada)";
      const prompt = `Analise esta vaga e gere perguntas binárias (sim/não) para verificar a experiência real do candidato.

JOB DESCRIPTION:
${jd}

STACK CONHECIDA DO CANDIDATO: ${stackList}
VAGA: ${process.role} na ${process.company}

Gere entre 5 e 10 perguntas. Foque em tecnologias, metodologias e práticas específicas da vaga que precisam de confirmação do candidato.
Priorize: (1) tecnologias não presentes na stack conhecida, (2) especificidades da vaga (cloud, infra, frameworks específicos).

Retorne EXATAMENTE este JSON:
{
  "questions": [
    { "id": "q1", "tech": "Kubernetes", "question": "Você tem experiência com Kubernetes em ambiente de produção?" },
    { "id": "q2", "tech": "AWS", "question": "Você trabalhou com AWS (ECS, Lambda, S3 ou similares)?" }
  ]
}`;

      const raw = await callAI([{ role: "user", content: prompt }], QA_SYSTEM, s?.access_token);
      const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
      const qs = parsed.questions || [];
      setQuestions(qs);
      const initialAnswers = {};
      qs.forEach(q => { initialAnswers[q.id] = null; });
      setAnswers(initialAnswers);
      setStep("qa");
    } catch {
      setStep("input");
      alert("Erro ao analisar a vaga. Verifique a conexão e tente novamente.");
    }
  };

  const generateCV = async () => {
    setStep("generating");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const confirmed = questions.filter(q => answers[q.id] === true).map(q => q.tech);
      const denied = questions.filter(q => answers[q.id] === false).map(q => q.tech);
      const skipped = questions.filter(q => answers[q.id] === null).map(q => q.tech);

      const prompt = `Adapte o currículo abaixo para a vaga especificada, com base nas respostas do candidato.

VAGA: ${process.role} na ${process.company} | ${STAGE[process.stage]?.label}

JOB DESCRIPTION:
${jd}

STACK CONFIRMADA DO CANDIDATO: ${profile.stack.join(", ") || "(não informada)"}
TECNOLOGIAS CONFIRMADAS NAS PERGUNTAS: ${confirmed.join(", ") || "nenhuma"}
TECNOLOGIAS NÃO CONFIRMADAS (NÃO INCLUIR): ${denied.join(", ") || "nenhuma"}
TECNOLOGIAS SEM RESPOSTA (use apenas se estiver na stack base): ${skipped.join(", ") || "nenhuma"}

CURRÍCULO BASE (preserve a estrutura exata — mesmas seções, mesma ordem):
${baseCV ? baseCV.slice(0, 4000) : "(não informado — use o resumo e stack como base)"}

RESUMO DO CANDIDATO: ${profile.summary || "(não informado)"}

Retorne o currículo adaptado em texto puro, mantendo a estrutura original. Não use JSON.`;

      const reply = await callAI([{ role: "user", content: prompt }], CV_SYSTEM, s?.access_token);
      setResult(reply);
      setSaved(false);
      setStep("result");
    } catch {
      setStep("qa");
      alert("Erro ao gerar o currículo. Tente novamente.");
    }
  };

  const saveAdaptation = async () => {
    if (!onSaveAdaptation || !result) return;
    const qaAnswers = questions.map(q => ({ id: q.id, tech: q.tech, question: q.question, answer: answers[q.id] }));
    await onSaveAdaptation(result, jd, qaAnswers);
    setSaved(true);
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id] !== null);

  if (!hasProfile) return (
    <div data-testid="no-profile" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 32, textAlign: "center", gap: 16 }}>
      <div style={{ opacity: 0.15 }}><Ic n="edit" s={36} c="var(--t2)" /></div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Configure seu perfil primeiro</div>
        <div style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6 }}>Para adaptar o currículo com segurança, precisamos saber quais tecnologias você realmente domina.</div>
      </div>
    </div>
  );

  if (step === "input") return (
    <div data-testid="step-input" style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px" : "20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {hasSavedAdaptation && (
          <div style={{ padding: "10px 14px", background: "rgba(34,198,122,0.08)", border: "1px solid rgba(34,198,122,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="check" s={13} c="var(--grn)" />
              <span style={{ fontSize: 12, color: "var(--grn)", fontFamily: "'Outfit',sans-serif" }}>
                Adaptação salva em {new Date(adaptation.updatedAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <button
              onClick={() => { setResult(adaptation.content); setStep("result"); }}
              style={{ fontSize: 11, color: "var(--grn)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", textDecoration: "underline" }}
            >
              Ver adaptação salva
            </button>
          </div>
        )}
        <div style={{ padding: "12px 14px", background: "var(--acc-d)", border: "1px solid var(--acc-b)", borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Ic n="info" s={14} c="var(--acc)" />
          <div style={{ fontSize: 12, color: "var(--acc)", lineHeight: 1.6 }}>
            A IA vai perguntar sobre tecnologias da vaga para garantir que o currículo inclua <strong>apenas o que você realmente domina</strong>.
          </div>
        </div>
        <div style={{ padding: "12px 14px", background: "var(--bg-o)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ ...T.label }}>Currículo base para adaptação</div>
            <button data-testid="btn-manage-resumes" onClick={onManageResumes} style={{ fontSize: 11, color: "var(--acc)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
              <Ic n="edit" s={11} c="var(--acc)" />Gerenciar
            </button>
          </div>
          <select
            data-testid="select-resume"
            value={selectedResumeId}
            onChange={e => setSelectedResumeId(e.target.value)}
            style={{ ...T.input, fontSize: 12, cursor: "pointer" }}
          >
            <option value="profile">Perfil — {profile.cvText ? "CV do perfil (texto colado)" : "resumo + stack do perfil"}</option>
            {(resumes || []).map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.language === "pt" ? "PT" : r.language === "en" ? "EN" : "ES"} · {Math.round(r.content.length / 1000)}k chars)</option>
            ))}
          </select>
          {hasResumes && selectedResume && (
            <div style={{ fontSize: 11, color: "var(--t3)" }}>
              {selectedResume.content.slice(0, 120).replace(/\s+/g, " ")}…
            </div>
          )}
          {!hasResumes && (
            <div style={{ fontSize: 11, color: "var(--t3)" }}>
              Nenhum currículo salvo ainda. <button onClick={onManageResumes} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--acc)", fontSize: 11, fontFamily: "'Outfit',sans-serif" }}>Adicionar agora →</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ ...T.label }}>Job description da vaga</label>
          <textarea data-testid="textarea-jd" value={jd} onChange={e => setJd(e.target.value)} rows={isMobile ? 8 : 11} placeholder={`Cole aqui o texto completo da vaga de ${process.role} na ${process.company}...`} style={{ ...T.input, resize: "vertical", lineHeight: 1.65, fontSize: 13 }} />
        </div>
        <div style={{ padding: "10px 12px", background: "var(--bg-o)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ ...T.label, marginBottom: 4 }}>Stack do perfil</div>
          <div data-testid="stack-preview" style={{ fontSize: 12, color: "var(--t2)" }}>{profile.stack.slice(0, 8).join(" · ")}{profile.stack.length > 8 ? ` · +${profile.stack.length - 8} mais` : ""}</div>
        </div>
      </div>
      <div style={{ padding: isMobile ? "12px 14px" : "14px 20px", borderTop: "1px solid var(--border)", paddingBottom: isMobile ? "env(safe-area-inset-bottom, 14px)" : "14px" }}>
        <Btn data-testid="btn-analyze" onClick={generateQuestions} full disabled={!jd.trim()}>Analisar job description</Btn>
      </div>
    </div>
  );

  if (step === "analyzing" || step === "generating") return (
    <div data-testid="step-analyzing" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
      <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--acc)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}</div>
      <div style={{ fontSize: 13, color: "var(--t3)" }}>
        {step === "analyzing" ? "Analisando a vaga e gerando perguntas…" : "Gerando currículo adaptado…"}
      </div>
    </div>
  );

  if (step === "qa") return (
    <div data-testid="step-qa" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px" : "20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "10px 14px", background: "var(--acc-d)", border: "1px solid var(--acc-b)", borderRadius: 10 }}>
          <span style={{ fontSize: 12, color: "var(--acc)", fontFamily: "'Outfit',sans-serif" }}>
            Responda sobre sua experiência real com cada item. O currículo adaptado vai usar <strong>apenas o que você confirmar</strong>.
          </span>
        </div>
        {questions.map((q, idx) => (
          <div key={q.id} data-testid={`qa-item-${q.id}`} style={{ padding: "14px 16px", background: "var(--bg-o)", border: `1px solid ${answers[q.id] === true ? "rgba(34,198,122,0.3)" : answers[q.id] === false ? "rgba(255,106,106,0.2)" : "var(--border)"}`, borderRadius: 12, display: "flex", flexDirection: "column", gap: 10, transition: "border-color 0.15s" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 11, color: "var(--t4)", ...T.mono, flexShrink: 0, marginTop: 2 }}>{String(idx + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: 13, color: "var(--t1)", fontFamily: "'Outfit',sans-serif", lineHeight: 1.5 }}>{q.question}</span>
            </div>
            <div style={{ display: "flex", gap: 8, paddingLeft: 22 }}>
              <button
                data-testid={`qa-yes-${q.id}`}
                onClick={() => setAnswers(a => ({ ...a, [q.id]: true }))}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${answers[q.id] === true ? "rgba(34,198,122,0.4)" : "var(--border)"}`, background: answers[q.id] === true ? "rgba(34,198,122,0.12)" : "var(--bg-s)", color: answers[q.id] === true ? "var(--grn)" : "var(--t2)", cursor: "pointer", fontSize: 13, fontFamily: "'Outfit',sans-serif", fontWeight: answers[q.id] === true ? 600 : 400, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {answers[q.id] === true && <Ic n="check" s={13} c="var(--grn)" />}
                Sim
              </button>
              <button
                data-testid={`qa-no-${q.id}`}
                onClick={() => setAnswers(a => ({ ...a, [q.id]: false }))}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${answers[q.id] === false ? "rgba(255,106,106,0.3)" : "var(--border)"}`, background: answers[q.id] === false ? "rgba(255,106,106,0.08)" : "var(--bg-s)", color: answers[q.id] === false ? "var(--red)" : "var(--t2)", cursor: "pointer", fontSize: 13, fontFamily: "'Outfit',sans-serif", fontWeight: answers[q.id] === false ? 600 : 400, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {answers[q.id] === false && <Ic n="close" s={13} c="var(--red)" />}
                Não
              </button>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "var(--t4)", textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>
          {questions.filter(q => answers[q.id] !== null).length}/{questions.length} respondidas
        </div>
      </div>
      <div style={{ padding: isMobile ? "12px 14px" : "14px 20px", borderTop: "1px solid var(--border)", paddingBottom: isMobile ? "env(safe-area-inset-bottom, 14px)" : "14px", display: "flex", gap: 8 }}>
        <Btn data-testid="btn-back-to-input" variant="ghost" onClick={() => setStep("input")} size="sm"><Ic n="back" s={13} c="var(--t2)" /></Btn>
        <Btn data-testid="btn-generate" onClick={generateCV} full disabled={!allAnswered}>
          {allAnswered ? "Gerar currículo adaptado" : `Responda todas as perguntas (${questions.filter(q => answers[q.id] !== null).length}/${questions.length})`}
        </Btn>
      </div>
    </div>
  );

  if (step === "result") return (
    <div data-testid="step-result" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px" : "20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {saved && (
          <div style={{ padding: "10px 14px", background: "rgba(34,198,122,0.08)", border: "1px solid rgba(34,198,122,0.2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <Ic n="check" s={13} c="var(--grn)" />
            <span style={{ fontSize: 12, color: "var(--grn)", fontFamily: "'Outfit',sans-serif" }}>Adaptação salva neste processo</span>
          </div>
        )}
        <div data-testid="result-text" style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--t1)", lineHeight: 1.75, padding: "16px", background: "var(--bg-o)", borderRadius: 12, border: "1px solid var(--border)" }}>
          {result}
        </div>
      </div>
      <div style={{ padding: isMobile ? "12px 14px" : "14px 20px", borderTop: "1px solid var(--border)", paddingBottom: isMobile ? "env(safe-area-inset-bottom, 14px)" : "14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn data-testid="btn-back-to-qa" variant="ghost" onClick={() => setStep("qa")} size="sm"><Ic n="back" s={13} c="var(--t2)" /></Btn>
        <Btn data-testid="btn-copy" onClick={copyResult} variant={copied ? "secondary" : "primary"}>
          <Ic n={copied ? "check" : "copy"} s={14} c={copied ? "var(--grn)" : "#fff"} />{copied ? "Copiado!" : "Copiar"}
        </Btn>
        {onSaveAdaptation && !saved && (
          <Btn data-testid="btn-save" onClick={saveAdaptation} variant="secondary">
            <Ic n="check" s={14} c="var(--t1)" />Salvar adaptação
          </Btn>
        )}
        <Btn data-testid="btn-new-analysis" variant="ghost" size="sm" onClick={() => { setStep("input"); setJd(""); setQuestions([]); setAnswers({}); setResult(""); setSaved(false); }}>Nova análise</Btn>
      </div>
    </div>
  );

  return null;
}

export default CVTab;
