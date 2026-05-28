import { useState } from "react";
import { STAGE, CHANNELS, SCENARIOS } from "../../utils/constants.js";
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

export function MessagesTab({ process, isMobile, autoFocus, navH = "0px" }) {
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

  const ch = CHANNELS[channel];
  const scenLabel = SCENARIOS.find(s => s.id === scenario)?.label || scenario;
  const canGen = scenario !== "reply_recruiter" || recruiterMsg.trim().length > 0;

  const generate = async () => {
    setLoading(true);
    setGenerated(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const prompt = buildPrompt({ process, channel, scenario, scenLabel, recruiterMsg, extra: extraVal });
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

  // ── Shared sub-components ────────────────────────────────────────────────────

  const RecruiterInput = () => (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Ic n="msg" s={12} c="var(--acc)" />
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
    <div style={{ display: "flex", gap: 14, flexWrap: isMobile ? "wrap" : "nowrap" }}>
      <div style={{ flex: 1, minWidth: isMobile ? "100%" : 0 }}>
        <div style={{ ...T.label, marginBottom: 8 }}>Canal</div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(CHANNELS).map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => setChannel(k)}
              style={{
                flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${channel === k ? cfg.border : "var(--border)"}`,
                background: channel === k ? cfg.bg : "var(--bg-o)",
                color: channel === k ? cfg.accent : "var(--t3)",
                transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              }}
            >
              <Ic n={cfg.icon} s={17} c={channel === k ? cfg.accent : "var(--t3)"} />
              <span style={{ fontSize: 11, fontWeight: channel === k ? 700 : 400, fontFamily: "'Outfit',sans-serif" }}>{cfg.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 2, minWidth: isMobile ? "100%" : 0 }}>
        <div style={{ ...T.label, marginBottom: 8 }}>Objetivo</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              style={{
                padding: "7px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                border: `1px solid ${scenario === s.id ? "var(--acc-b)" : "var(--border)"}`,
                background: scenario === s.id ? "var(--acc-d)" : "var(--bg-o)",
                color: scenario === s.id ? "var(--acc)" : "var(--t2)",
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
          cursor: "pointer", color: extraCtx ? "var(--acc)" : "var(--t3)",
          fontSize: 11, ...T.mono, padding: 0, marginBottom: extraCtx ? 8 : 0, transition: "color 0.15s",
        }}
      >
        <Ic n="info" s={12} c={extraCtx ? "var(--acc)" : "var(--t3)"} />
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
      disabled={loading || !canGen}
      style={{
        width: full ? "100%" : undefined,
        padding: 13, borderRadius: 12,
        border: `1px solid ${!canGen ? "var(--border)" : ch.border}`,
        background: loading ? "var(--bg-o)" : !canGen ? "var(--bg-o)" : ch.bg,
        color: loading ? "var(--t3)" : !canGen ? "var(--t4)" : ch.accent,
        cursor: loading || !canGen ? "not-allowed" : "pointer",
        fontSize: 14, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
        transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}
    >
      {loading
        ? <><div style={{ display: "flex", gap: 5 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--t3)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}</div>Gerando...</>
        : <><Ic n={ch.icon} s={16} c={!canGen ? "var(--t4)" : ch.accent} />{canGen ? `Gerar para ${ch.label}` : "Cole a mensagem ou escolha um objetivo"}</>
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

  // ── Mobile layout: sticky generate button at bottom ─────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 8px" }}>
          {generated && <ResultCard />}
          {!generated && !loading && <EmptyPlaceholder />}
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

  // ── Desktop layout: history sidebar ─────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, padding: "20px 20px 24px" }}>
        <RecruiterInput />
        <ChannelScenario />
        <ExtraCtxToggle />
        <GenerateBtn />
        {!generated && !loading && <EmptyPlaceholder />}
        {generated && <ResultCard />}
      </div>
      <div style={{ width: 210, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
          <Ic n="cal" s={12} c="var(--t4)" />
          <span style={{ ...T.label }}>Histórico</span>
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
                onClick={() => setGenerated(h)}
                style={{
                  padding: 10, borderRadius: 10, marginBottom: 6, cursor: "pointer",
                  border: `1px solid ${act ? cfg?.border || "var(--border)" : "var(--border)"}`,
                  background: act ? cfg?.bg || "var(--bg-o)" : "var(--bg-r)",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <Ic n={cfg?.icon || "msg"} s={12} c={cfg?.accent || "var(--t2)"} />
                  <span style={{ fontSize: 11, color: cfg?.accent, ...T.mono, fontWeight: 600 }}>{cfg?.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.4, marginBottom: 3 }}>{h.scenario}</div>
                {h.recruiterMsg && (
                  <div style={{ fontSize: 10, color: "var(--t4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    "{h.recruiterMsg.slice(0, 35)}{h.recruiterMsg.length > 35 ? "…" : ""}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MessagesTab;
