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
}`;

const DRAFT_SYSTEM = `Você é Fernando, Senior Full-Stack Engineer / Front-End Tech Lead com 10+ anos de experiência (React, Next.js, Node.js, TypeScript, Supabase). Você foi contactado por um recrutador no LinkedIn.
Escreva UMA resposta inicial na primeira pessoa, como se fosse você mesmo digitando agora.
Regras:
- Confirme o interesse de forma direta (não exagerada)
- Faça UMA pergunta estratégica sobre a vaga (stack, modelo de trabalho ou próximo passo)
- Máximo 3 parágrafos curtos, tom profissional mas humano
- Sem saudações genéricas ("Espero que esteja bem"), sem "Atenciosamente"
- Não mencione IA
- Responda SEMPRE no mesmo idioma da mensagem do recrutador
Responda SOMENTE com o texto da mensagem, sem introdução, sem aspas, sem explicações.`;

export function RecruiterMessageModal({ onClose, onProcessCreated, initialMsg = "" }) {
  const [step, setStep] = useState("paste"); // paste | working | result
  const [msg, setMsg] = useState(initialMsg);
  const [extracted, setExtracted] = useState(null);
  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const run = async () => {
    if (!msg.trim()) return;
    setStep("working");
    setError("");

    let token;
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token;
    } catch {
      setError("Erro de autenticação. Recarregue a página.");
      setStep("paste");
      return;
    }

    // Extract structured info from the message
    let ext;
    try {
      const raw = await callAI(
        [{ role: "user", content: msg }],
        EXTRACTION_SYSTEM,
        token
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      ext = {
        recruiter: parsed.recruiter || "",
        recruiterRole: parsed.recruiterRole || "",
        company: parsed.company || "",
        role: parsed.role || "",
        stack: parsed.stack || "",
        regime: parsed.regime || "",
        salary: parsed.salary || "",
        nextStep: parsed.nextStep || "",
        location: parsed.location || "",
      };
      setExtracted(ext);
    } catch {
      setError("Não foi possível extrair as informações. Verifique a mensagem e tente novamente.");
      setStep("paste");
      return;
    }

    // Show result immediately, generate draft in parallel
    setStep("result");
    setDraftLoading(true);
    try {
      const userMsg = `Recrutador: ${ext.recruiter || "recrutador"}${ext.recruiterRole ? ` (${ext.recruiterRole})` : ""}
Empresa: ${ext.company || "empresa"} | Cargo: ${ext.role || "cargo"} | Regime: ${ext.regime || "—"} | Salário: ${ext.salary || "—"}
Mensagem do recrutador:
"${msg}"`;
      const draftText = await callAI(
        [{ role: "user", content: userMsg }],
        DRAFT_SYSTEM,
        token
      );
      setDraft(draftText.trim());
    } catch {
      setDraft("");
    } finally {
      setDraftLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && msg.trim()) run();
  };

  const save = () => {
    if (saved) { onClose(); return; }
    const today = new Date().toISOString().slice(0, 10);
    const tags = extracted?.stack
      ? extracted.stack.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const process = {
      id: crypto.randomUUID(),
      company: extracted?.company || "Empresa?",
      role: extracted?.role || "Cargo?",
      stage: "contacted",
      origin: "inbound",
      channel: "linkedin",
      location: extracted?.location || "",
      salary: extracted?.salary || "",
      recruiter: extracted?.recruiter || "",
      recruiterEmail: "",
      contactedDate: today,
      nextStepDate: null,
      nextStepNote: extracted?.nextStep || "",
      jobUrl: "",
      tags,
      notes: `Mensagem original:\n${msg}`,
      steps: [{ date: today, type: "contacted", note: "Contactado via LinkedIn" }],
      aiContext: "",
      starred: false,
    };
    onProcessCreated(process);
    setSaved(true);
  };

  const copy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 16,
  };
  const modal = {
    background: "var(--bg-r)", borderRadius: 16,
    border: "1px solid var(--border-md)", width: "100%", maxWidth: 520,
    maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
  };
  const hdr = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0,
  };
  const body = {
    flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14,
  };
  const ftr = {
    padding: "14px 20px", borderTop: "1px solid var(--border)",
    display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexShrink: 0,
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={hdr}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(10,102,194,0.12)", border: "1px solid rgba(10,102,194,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ic n="linkedin" s={14} c="#0A66C2" />
            </div>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>
              {step === "paste"   && "Mensagem do LinkedIn"}
              {step === "working" && "Analisando…"}
              {step === "result"  && "Pronto para responder"}
            </span>
          </div>
          <button onClick={onClose} aria-label="Fechar" data-testid="btn-close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
            <Ic n="close" s={16} c="var(--t3)" />
          </button>
        </div>

        {/* ── STEP: paste ────────────────────────────────────────── */}
        {step === "paste" && (
          <>
            <div style={body}>
              <p style={{ fontSize: 13, color: "var(--t3)", fontFamily: "'Outfit',sans-serif", margin: 0, lineHeight: 1.6 }}>
                Cole a mensagem recebida no LinkedIn. A IA extrai empresa, cargo e stack — e gera uma resposta pronta para copiar.
              </p>
              <textarea
                data-testid="msg-input"
                autoFocus
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Cole a mensagem aqui…"
                style={{ ...T.input, resize: "none", lineHeight: 1.65, height: 200, fontSize: 13 }}
              />
              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,106,106,0.08)", border: "1px solid rgba(255,106,106,0.2)", color: "var(--red)", fontSize: 13, fontFamily: "'Outfit',sans-serif" }}>
                  {error}
                </div>
              )}
            </div>
            <div style={ftr}>
              <span style={{ fontSize: 11, color: "var(--t4)", fontFamily: "'JetBrains Mono',monospace" }}>
                {msg.trim() ? `${msg.trim().split(/\s+/).length} palavras` : "Ctrl+Enter para analisar"}
              </span>
              <Btn variant="primary" onClick={run} disabled={!msg.trim()} data-testid="btn-analyze">
                <Ic n="ai" s={14} c="#fff" /> Analisar mensagem
              </Btn>
            </div>
          </>
        )}

        {/* ── STEP: working ──────────────────────────────────────── */}
        {step === "working" && (
          <div style={{ ...body, alignItems: "center", justifyContent: "center", minHeight: 200 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--acc-b)", borderTopColor: "var(--acc)", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, color: "var(--t3)", fontFamily: "'Outfit',sans-serif" }}>Extraindo informações…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        )}

        {/* ── STEP: result ───────────────────────────────────────── */}
        {step === "result" && extracted && (
          <>
            <div style={body}>
              {/* 4 key fields — 2×2 grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { key: "company", label: "Empresa" },
                  { key: "role",    label: "Cargo" },
                  { key: "salary",  label: "Salário" },
                  { key: "regime",  label: "Regime" },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ ...T.label }}>{label}</span>
                    <input
                      value={extracted[key]}
                      onChange={e => setExtracted(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`${label}…`}
                      style={{ ...T.input, fontSize: 13 }}
                      data-testid={`field-${key}`}
                    />
                  </div>
                ))}
              </div>

              {/* Draft */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...T.label }}>Resposta para o LinkedIn</span>
                  {draftLoading && (
                    <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--acc)", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
                  )}
                </div>
                {draftLoading ? (
                  <div style={{ height: 130, borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-o)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--t4)", fontFamily: "'Outfit',sans-serif" }}>Gerando resposta…</span>
                  </div>
                ) : draft ? (
                  <textarea
                    data-testid="draft-output"
                    readOnly
                    value={draft}
                    style={{ ...T.input, resize: "none", height: 130, lineHeight: 1.65, background: "var(--bg-o)", cursor: "text", fontSize: 13, overflowY: "auto" }}
                  />
                ) : (
                  <div style={{ padding: "14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-o)" }}>
                    <span style={{ fontSize: 12, color: "var(--t3)", fontFamily: "'Outfit',sans-serif" }}>Não foi possível gerar a resposta. Use a aba Mensagens no processo.</span>
                  </div>
                )}
              </div>
            </div>

            <div style={ftr}>
              <button
                data-testid="btn-back"
                onClick={() => { setStep("paste"); setDraft(""); setExtracted(null); setSaved(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 12, fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", borderRadius: 8 }}
              >
                <Ic n="back" s={12} c="var(--t3)" /> Voltar
              </button>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {draft && !draftLoading && (
                  <button
                    data-testid="btn-copy"
                    onClick={copy}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: copied ? "rgba(34,198,122,0.1)" : "var(--bg-o)", border: `1px solid ${copied ? "rgba(34,198,122,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", color: copied ? "var(--grn)" : "var(--t2)", fontSize: 13, fontFamily: "'Outfit',sans-serif", padding: "8px 14px", transition: "all 0.15s", fontWeight: 500 }}
                  >
                    <Ic n={copied ? "check" : "copy"} s={13} c={copied ? "var(--grn)" : "var(--t2)"} />
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                )}
                <Btn variant="primary" onClick={save} data-testid="btn-save">
                  <Ic n={saved ? "check" : "plus"} s={14} c="#fff" />
                  {saved ? "Abrir processo" : "Salvar"}
                </Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
