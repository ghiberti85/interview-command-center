import { useState } from "react";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import { T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

const EXTRACTION_SYSTEM = `Você é um assistente especializado em analisar mensagens de recrutadores de tecnologia.
Extraia as informações estruturadas da mensagem e retorne EXATAMENTE este JSON (sem markdown, sem explicações):
{
  "recruiter": "nome do recrutador ou vazio",
  "recruiterRole": "cargo do recrutador ou vazio",
  "company": "nome da empresa ou vazio",
  "role": "título do cargo da vaga ou vazio",
  "stack": "tecnologias mencionadas, separadas por vírgula, ou vazio",
  "regime": "remoto/híbrido/presencial ou vazio",
  "salary": "faixa salarial mencionada ou vazio",
  "nextStep": "próximo passo sugerido pelo recrutador ou vazio",
  "location": "cidade/estado ou vazio"
}
Se a mensagem estiver em inglês, preencha os campos em inglês. Se estiver em português, preencha em português.`;

function buildDraftPrompt(extracted, msg) {
  return `Você é um assistente de comunicação profissional para processos seletivos de tecnologia.
Candidato: Fernando, Senior Full-Stack Engineer / Front-End Tech Lead (React, Next.js, Node.js, TypeScript, Supabase, liderança técnica). Perfil predominantemente inbound — é contactado por recrutadores.
Recrutador: ${extracted.recruiter || "recrutador"}${extracted.recruiterRole ? ` (${extracted.recruiterRole})` : ""}
Empresa: ${extracted.company || "empresa"} | Cargo: ${extracted.role || "cargo"} | Regime: ${extracted.regime || "—"} | Salário: ${extracted.salary || "—"}
Mensagem original do recrutador:
"""${msg}"""
Objetivo: Resposta inicial ao recrutador demonstrando interesse, pedindo mais detalhes e propondo próximo passo.
Canal: LinkedIn | Tom: profissional, direto, humano — sem exageros. Em português.
Responda EXATAMENTE neste JSON (sem markdown): {"body":"mensagem completa"}`;
}

export function RecruiterMessageModal({ onClose, onProcessCreated }) {
  const [step, setStep] = useState("paste"); // paste | extracting | review | draft
  const [msg, setMsg] = useState("");
  const [extracted, setExtracted] = useState(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [createdProcess, setCreatedProcess] = useState(null);

  const extract = async () => {
    if (!msg.trim()) return;
    setStep("extracting");
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const raw = await callAI(
        [{ role: "user", content: msg }],
        EXTRACTION_SYSTEM,
        session?.access_token
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setExtracted({
        recruiter: parsed.recruiter || "",
        recruiterRole: parsed.recruiterRole || "",
        company: parsed.company || "",
        role: parsed.role || "",
        stack: parsed.stack || "",
        regime: parsed.regime || "",
        salary: parsed.salary || "",
        nextStep: parsed.nextStep || "",
        location: parsed.location || "",
      });
      setStep("review");
    } catch (e) {
      setError("Não foi possível extrair as informações. Verifique a mensagem e tente novamente.");
      setStep("paste");
    }
  };

  const createProcess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const today = new Date().toISOString().slice(0, 10);
    const tags = extracted.stack
      ? extracted.stack.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const process = {
      id: crypto.randomUUID(),
      company: extracted.company || "Empresa?",
      role: extracted.role || "Cargo?",
      stage: "contacted",
      origin: "inbound",
      channel: "linkedin",
      location: extracted.location || "",
      salary: extracted.salary || "",
      recruiter: extracted.recruiter || "",
      recruiterEmail: "",
      contactedDate: today,
      nextStepDate: null,
      nextStepNote: extracted.nextStep || "",
      jobUrl: "",
      tags,
      notes: `Mensagem original:\n${msg}`,
      steps: [{ date: today, type: "contacted", note: "Contactado via LinkedIn" }],
      aiContext: "",
      starred: false,
    };
    setCreatedProcess(process);

    // Generate draft response
    try {
      const draftRaw = await callAI(
        [{ role: "user", content: buildDraftPrompt(extracted, msg) }],
        undefined,
        session?.access_token
      );
      const parsed = JSON.parse(draftRaw.replace(/```json|```/g, "").trim());
      setDraft(parsed.body || "");
    } catch {
      setDraft("");
    }

    onProcessCreated(process);
    setStep("draft");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 16,
  };
  const modal = {
    background: "var(--bg-r)", borderRadius: 16,
    border: "1px solid var(--border-md)", width: "100%", maxWidth: 560,
    maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
  };
  const header = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "20px 24px 16px", borderBottom: "1px solid var(--border)",
  };
  const body = { flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 };
  const footer = { padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" };

  const fieldStyle = {
    display: "flex", flexDirection: "column", gap: 6,
  };
  const labelStyle = { ...T.label, color: "var(--t2)" };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Ic n="linkedin" s={18} c="var(--acc)" />
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 16, color: "var(--t1)" }}>
              {step === "paste" && "Nova mensagem de recrutador"}
              {step === "extracting" && "Analisando mensagem…"}
              {step === "review" && "Revisar informações extraídas"}
              {step === "draft" && "Processo criado"}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
            <Ic n="close" s={18} c="var(--t3)" />
          </button>
        </div>

        {/* STEP: paste */}
        {step === "paste" && (
          <>
            <div style={body}>
              <p style={{ fontSize: 13, color: "var(--t2)", fontFamily: "'Outfit',sans-serif", margin: 0 }}>
                Cole a mensagem do recrutador recebida no LinkedIn. A IA vai extrair automaticamente empresa, cargo, stack e outras informações para criar o processo.
              </p>
              <div style={fieldStyle}>
                <span style={labelStyle}>Mensagem do recrutador</span>
                <textarea
                  autoFocus
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  placeholder="Cole aqui a mensagem completa recebida no LinkedIn…"
                  rows={10}
                  style={{ ...T.input, resize: "vertical", lineHeight: 1.6 }}
                />
                {msg.trim() && (
                  <span style={{ fontSize: 11, color: "var(--t3)", ...T.mono }}>
                    {msg.trim().split(/\s+/).length} palavras
                  </span>
                )}
              </div>
              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,106,106,0.08)", border: "1px solid rgba(255,106,106,0.2)", color: "var(--red)", fontSize: 13, fontFamily: "'Outfit',sans-serif" }}>
                  {error}
                </div>
              )}
            </div>
            <div style={footer}>
              <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
              <Btn variant="primary" onClick={extract} disabled={!msg.trim()}>
                <Ic n="ai" s={14} c="#fff" /> Extrair informações
              </Btn>
            </div>
          </>
        )}

        {/* STEP: extracting */}
        {step === "extracting" && (
          <div style={{ ...body, alignItems: "center", justifyContent: "center", minHeight: 220 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--acc-b)", borderTopColor: "var(--acc)", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 14, color: "var(--t2)", fontFamily: "'Outfit',sans-serif" }}>Analisando mensagem com IA…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        )}

        {/* STEP: review */}
        {step === "review" && extracted && (
          <>
            <div style={body}>
              <p style={{ fontSize: 13, color: "var(--t2)", fontFamily: "'Outfit',sans-serif", margin: 0 }}>
                Revise as informações extraídas e corrija o que for necessário antes de criar o processo.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { key: "company", label: "Empresa" },
                  { key: "role", label: "Cargo" },
                  { key: "recruiter", label: "Nome do recrutador" },
                  { key: "recruiterRole", label: "Cargo do recrutador" },
                  { key: "salary", label: "Salário" },
                  { key: "regime", label: "Regime" },
                  { key: "location", label: "Localização" },
                  { key: "stack", label: "Stack (separada por vírgula)" },
                ].map(({ key, label }) => (
                  <div key={key} style={fieldStyle}>
                    <span style={labelStyle}>{label}</span>
                    <input
                      value={extracted[key]}
                      onChange={e => setExtracted(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ ...T.input }}
                      placeholder={`${label}…`}
                    />
                  </div>
                ))}
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Próximo passo</span>
                <input
                  value={extracted.nextStep}
                  onChange={e => setExtracted(prev => ({ ...prev, nextStep: e.target.value }))}
                  style={{ ...T.input }}
                  placeholder="Ex: Agendar call de 30min"
                />
              </div>
            </div>
            <div style={footer}>
              <Btn variant="secondary" onClick={() => setStep("paste")}>Voltar</Btn>
              <Btn variant="primary" onClick={createProcess}>
                <Ic n="plus" s={14} c="#fff" /> Criar processo
              </Btn>
            </div>
          </>
        )}

        {/* STEP: draft */}
        {step === "draft" && (
          <>
            <div style={body}>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(34,198,122,0.08)", border: "1px solid rgba(34,198,122,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                <Ic n="check" s={14} c="var(--grn)" />
                <span style={{ fontSize: 13, color: "var(--grn)", fontFamily: "'Outfit',sans-serif" }}>
                  Processo <strong>{extracted?.company}</strong> criado com sucesso
                </span>
              </div>
              {draft ? (
                <div style={fieldStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={labelStyle}>Rascunho de resposta (LinkedIn)</span>
                    <button
                      onClick={copy}
                      style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: copied ? "var(--grn)" : "var(--acc)", fontSize: 12, fontFamily: "'Outfit',sans-serif", padding: "2px 0" }}
                    >
                      <Ic n={copied ? "check" : "copy"} s={12} c={copied ? "var(--grn)" : "var(--acc)"} />
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={draft}
                    rows={10}
                    style={{ ...T.input, resize: "vertical", lineHeight: 1.6, background: "var(--bg-o)", color: "var(--t1)", cursor: "text" }}
                  />
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--t3)", fontFamily: "'Outfit',sans-serif" }}>
                  Não foi possível gerar o rascunho. Você pode gerar um na aba Mensagens do processo.
                </p>
              )}
            </div>
            <div style={footer}>
              <Btn variant="primary" onClick={onClose}>
                <Ic n="check" s={14} c="#fff" /> Abrir processo
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
