import { useState } from "react";
import { CHANNELS, SCENARIOS } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";
import { buildPrompt } from "../../utils/buildPrompt.js";

const MESSAGES_SYSTEM = "Responda SOMENTE com o JSON solicitado. Sem texto extra, sem markdown, sem introdução.";

function parseAIResponse(raw) {
  const text = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(text); } catch {}
  const greedy = text.match(/\{[\s\S]*\}/);
  if (greedy) { try { return JSON.parse(greedy[0]); } catch {} }
  return { body: text };
}

function extractMsgFromNotes(notes) {
  if (!notes) return "";
  const prefix = "Mensagem original:\n";
  if (notes.startsWith(prefix)) return notes.slice(prefix.length).trim();
  return "";
}

export function MessagesTab({ process, isMobile, autoFocus, navH = "0px", profile, adaptation, onUpdate }) {
  const [channel, setChannel] = useState("linkedin");
  const [scenario, setScenario] = useState("reply_recruiter");
  const [recruiterMsg, setRecruiterMsg] = useState(() => extractMsgFromNotes(process.notes));
  const [extraCtx, setExtraCtx] = useState(false);
  const [extraVal, setExtraVal] = useState("");
  const [generated, setGenerated] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSub, setCopiedSub] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSent, setShowSent] = useState(true);

  const ch = CHANNELS[channel];
  const scenLabel = SCENARIOS.find(s => s.id === scenario)?.label || scenario;
  const sentMessages = process.sentMessages || [];

  const generate = async () => {
    setLoading(true);
    setGenerated(null);
    setSaved(false);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const cvContext = adaptation?.content || profile?.cvText || "";
      const prompt = buildPrompt({ process, channel, scenario, scenLabel, recruiterMsg, extra: extraVal, cvContext });
      const raw = await callAI([{ role: "user", content: prompt }], MESSAGES_SYSTEM, s?.access_token);
      const parsed = parseAIResponse(raw);
      const entry = { ...parsed, channel, scenario: scenLabel, recruiterMsg, ts: Date.now() };
      setGenerated(entry);
      setHistory(prev => [entry, ...prev].slice(0, 20));
    } catch {
      setGenerated({ body: "Erro ao gerar. Tente novamente.", channel, scenario: scenLabel, ts: Date.now() });
    }
    setLoading(false);
  };

  const copy = async (text, setter) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const saveToProcess = () => {
    if (!generated || !onUpdate) return;
    const entry = {
      body: generated.body,
      subject: generated.subject || null,
      channel: generated.channel,
      scenario: generated.scenario,
      recruiterMsg: generated.recruiterMsg || null,
      ts: generated.ts,
    };
    const updated = { ...process, sentMessages: [entry, ...sentMessages] };
    onUpdate(updated);
    setSaved(true);
  };

  const deleteSent = (ts) => {
    if (!onUpdate) return;
    onUpdate({ ...process, sentMessages: sentMessages.filter(m => m.ts !== ts) });
  };

  // ── Shared sub-components ────────────────────────────────────────────────────

  const RecruiterInput = () => (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Ic n="msg" s={12} c="var(--acc-text)" />
        <span style={{ ...T.label, color: "var(--t2)" }}>Mensagem do recrutador</span>
        <span style={{ fontSize: 10, color: "var(--t4)", ...T.mono, marginLeft: 2 }}>(opcional)</span>
      </div>
      <textarea
        autoFocus={autoFocus}
        value={recruiterMsg}
        onChange={e => setRecruiterMsg(e.target.value)}
        placeholder="Cole aqui a mensagem recebida — a IA vai analisar e gerar a melhor resposta..."
        rows={isMobile ? 3 : 4}
        style={{
          ...T.input, resize: "none", lineHeight: 1.6,
          borderColor: recruiterMsg ? "var(--acc-b)" : "var(--border)",
          background: recruiterMsg ? "rgba(124,106,255,0.04)" : "var(--bg-o)",
        }}
      />
      {recruiterMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
          <Ic n="check" s={11} c="var(--grn)" />
          <span style={{ fontSize: 11, color: "var(--grn)", ...T.mono }}>
            {recruiterMsg.split(/\s+/).filter(Boolean).length} palavras
          </span>
        </div>
      )}
    </div>
  );

  const ChannelScenario = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ ...T.label, marginBottom: 8 }}>Canal</div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(CHANNELS).map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => setChannel(k)}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${channel === k ? cfg.border : "var(--border)"}`,
                background: channel === k ? cfg.bg : "var(--bg-o)",
                color: channel === k ? cfg.accent : "var(--t3)",
                transition: "all 0.15s", display: "flex", flexDirection: isMobile ? "column" : "row",
                alignItems: "center", justifyContent: "center", gap: isMobile ? 4 : 8,
              }}
            >
              <Ic n={cfg.icon} s={17} c={channel === k ? cfg.accent : "var(--t3)"} />
              <span style={{ fontSize: 12, fontWeight: channel === k ? 700 : 400, fontFamily: "'Outfit',sans-serif" }}>{cfg.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ ...T.label, marginBottom: 8 }}>Objetivo</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              style={{
                padding: "8px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                border: `1px solid ${scenario === s.id ? "var(--acc-b)" : "var(--border)"}`,
                background: scenario === s.id ? "var(--acc-d)" : "var(--bg-o)",
                color: scenario === s.id ? "var(--acc-text)" : "var(--t2)",
                fontSize: 12, fontFamily: "'Outfit',sans-serif", transition: "all 0.15s",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const ExtraCtxToggle = () => (
    <div>
      <button
        onClick={() => setExtraCtx(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
          cursor: "pointer", color: extraCtx ? "var(--acc-text)" : "var(--t3)",
          fontSize: 11, ...T.mono, padding: 0, marginBottom: extraCtx ? 8 : 0, transition: "color 0.15s",
        }}
      >
        <Ic n="info" s={12} c={extraCtx ? "var(--acc-text)" : "var(--t3)"} />
        Contexto adicional {extraCtx ? "▲" : "▼"}
      </button>
      {extraCtx && (
        <textarea
          value={extraVal}
          onChange={e => setExtraVal(e.target.value)}
          rows={2}
          placeholder="Ex: a entrevista foi ótima — ou — preciso remarcar para depois das 18h"
          style={{ ...T.input, resize: "vertical" }}
        />
      )}
    </div>
  );

  const GenerateBtn = ({ full }) => (
    <button
      onClick={generate}
      disabled={loading}
      style={{
        width: full ? "100%" : undefined,
        padding: 13, borderRadius: 12,
        border: `1px solid ${ch.border}`,
        background: loading ? "var(--bg-o)" : ch.bg,
        color: loading ? "var(--t3)" : ch.accent,
        cursor: loading ? "not-allowed" : "pointer",
        fontSize: 14, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
        transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}
    >
      {loading
        ? <><div style={{ display: "flex", gap: 5 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--t3)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}</div>Gerando...</>
        : <><Ic n={ch.icon} s={16} c={ch.accent} />Gerar para {ch.label}</>
      }
    </button>
  );

  const ResultCard = () => !generated ? null : (
    <div style={{ borderRadius: 12, border: `1px solid ${CHANNELS[generated.channel]?.border || "var(--border)"}`, background: "var(--bg-r)", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Ic n={CHANNELS[generated.channel]?.icon || "msg"} s={13} c={CHANNELS[generated.channel]?.accent || "var(--t2)"} />
          <span style={{ fontSize: 11, color: CHANNELS[generated.channel]?.accent, ...T.mono, fontWeight: 600 }}>
            {CHANNELS[generated.channel]?.label} · {generated.scenario}
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--t4)", ...T.mono }}>
          {new Date(generated.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      {generated.subject && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "var(--bg-o)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...T.label, marginBottom: 3 }}>Assunto</div>
            <div style={{ fontSize: 14, color: "var(--t1)", fontWeight: 600 }}>{generated.subject}</div>
          </div>
          <Btn variant="ghost" size="sm" onClick={() => copy(generated.subject, setCopiedSub)}>
            <Ic n={copiedSub ? "check" : "copy"} s={12} c={copiedSub ? "var(--grn)" : "var(--t2)"} />
            {copiedSub ? "copiado" : "copiar"}
          </Btn>
        </div>
      )}
      <div style={{ padding: "18px 16px" }}>
        <div style={{ fontSize: 14, color: "var(--t1)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{generated.body}</div>
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--t4)", ...T.mono }}>
          {generated.body.split(/\s+/).filter(Boolean).length} palavras
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={generate} disabled={loading}>
            <Ic n="refresh" s={13} c="var(--t2)" />Regerar
          </Btn>
          {onUpdate && (
            <Btn variant="ghost" size="sm" onClick={saveToProcess} disabled={saved}>
              <Ic n={saved ? "check" : "star"} s={13} c={saved ? "var(--grn)" : "var(--t2)"} />
              {saved ? "Salvo" : "Salvar"}
            </Btn>
          )}
          <Btn
            size="sm"
            onClick={() => copy(generated.body, setCopied)}
            style={{ background: copied ? "var(--grn)" : CHANNELS[generated.channel]?.color, color: "#fff" }}
          >
            <Ic n={copied ? "check" : "copy"} s={13} c="#fff" />
            {copied ? "Copiado!" : CHANNELS[generated.channel]?.label}
          </Btn>
        </div>
      </div>
    </div>
  );

  const EmptyPlaceholder = () => (
    <div style={{ padding: "28px 20px", borderRadius: 12, border: "1px dashed var(--border)", background: "var(--bg-o)", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, opacity: 0.25 }}>
        <Ic n="send" s={26} c="var(--t2)" />
      </div>
      <div style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.65 }}>
        Cole a mensagem do recrutador<br />e clique em <strong style={{ color: "var(--t2)" }}>Gerar resposta</strong>
      </div>
    </div>
  );

  const SentMessagesSection = ({ compact }) => sentMessages.length === 0 ? null : (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
      <button
        onClick={() => setShowSent(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: compact ? "9px 12px" : "10px 16px", background: "var(--bg-o)", border: "none",
          cursor: "pointer", borderBottom: showSent ? "1px solid var(--border)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Ic n="send" s={12} c="var(--grn)" />
          <span style={{ ...T.label, color: "var(--grn)" }}>Respostas enviadas</span>
          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(34,198,122,0.12)", color: "var(--grn)", ...T.mono }}>{sentMessages.length}</span>
        </div>
        <span style={{ fontSize: 10, color: "var(--t4)" }}>{showSent ? "▲" : "▼"}</span>
      </button>
      {showSent && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {sentMessages.map((m, i) => {
            const cfg = CHANNELS[m.channel];
            return (
              <div key={m.ts} style={{ padding: compact ? "10px 12px" : "14px 16px", borderBottom: i < sentMessages.length - 1 ? "1px solid var(--border)" : "none", background: "var(--bg-r)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Ic n={cfg?.icon || "msg"} s={11} c={cfg?.accent || "var(--t3)"} />
                    <span style={{ fontSize: 10, color: cfg?.accent || "var(--t3)", ...T.mono, fontWeight: 600 }}>{cfg?.label}</span>
                    <span style={{ fontSize: 10, color: "var(--t4)", ...T.mono }}>· {m.scenario}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--t4)", ...T.mono }}>
                      {new Date(m.ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <button onClick={() => copy(m.body, () => {})} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                      <Ic n="copy" s={12} c="var(--t3)" />
                    </button>
                    {onUpdate && (
                      <button onClick={() => deleteSent(m.ts)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                        <Ic n="trash" s={12} c="var(--red)" />
                      </button>
                    )}
                  </div>
                </div>
                {m.recruiterMsg && (
                  <div style={{ fontSize: 11, color: "var(--t4)", fontStyle: "italic", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    ↳ "{m.recruiterMsg.slice(0, 60)}{m.recruiterMsg.length > 60 ? "…" : ""}"
                  </div>
                )}
                {m.subject && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 4 }}>{m.subject}</div>
                )}
                <div style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Mobile layout ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 8px" }}>
          <SentMessagesSection compact />
          {generated && <ResultCard />}
          {!generated && !loading && sentMessages.length === 0 && <EmptyPlaceholder />}
          <RecruiterInput />
          <ChannelScenario />
          <ExtraCtxToggle />
        </div>
        <div style={{ flexShrink: 0, padding: "12px 16px", paddingBottom: `calc(16px + ${navH})`, borderTop: "1px solid var(--border)", background: "var(--bg-r)" }}>
          <GenerateBtn full />
        </div>
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Main column: scrollable form + sticky generate btn */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, padding: "20px 20px 8px" }}>
          <SentMessagesSection />
          <RecruiterInput />
          <ChannelScenario />
          <ExtraCtxToggle />
          {!generated && !loading && sentMessages.length === 0 && <EmptyPlaceholder />}
          {generated && <ResultCard />}
        </div>
        <div style={{ flexShrink: 0, padding: "12px 20px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-r)" }}>
          <GenerateBtn full />
        </div>
      </div>
      {/* History sidebar */}
      <div style={{ width: 220, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
          <Ic n="cal" s={12} c="var(--t4)" />
          <span style={{ ...T.label }}>Histórico da sessão</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {history.length === 0 && (
            <div style={{ color: "var(--t4)", fontSize: 11, textAlign: "center", padding: "20px 8px", lineHeight: 1.6 }}>
              Respostas geradas<br />aparecerão aqui
            </div>
          )}
          {history.map((h, i) => {
            const cfg = CHANNELS[h.channel];
            const act = generated?.ts === h.ts;
            return (
              <div
                key={i}
                onClick={() => { setGenerated(h); setSaved(false); }}
                style={{
                  padding: "10px 10px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                  border: `1px solid ${act ? cfg?.border || "var(--border)" : "var(--border)"}`,
                  background: act ? cfg?.bg || "var(--bg-o)" : "var(--bg-r)",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Ic n={cfg?.icon || "msg"} s={11} c={cfg?.accent || "var(--t2)"} />
                    <span style={{ fontSize: 10, color: cfg?.accent, ...T.mono, fontWeight: 600 }}>{cfg?.label}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--t4)", ...T.mono }}>
                    {new Date(h.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--t3)", ...T.mono, marginBottom: 5 }}>{h.scenario}</div>
                <div style={{ fontSize: 12, color: "var(--t1)", lineHeight: 1.45,
                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {h.body}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MessagesTab;
