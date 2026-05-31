import { useState, useRef, useEffect } from "react";
import { CHANNELS, SCENARIOS } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import { buildPrompt } from "../../utils/buildPrompt.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

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

function fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ConversaTab({ process, isMobile, profile, adaptation, onUpdate, navH = "0px" }) {
  const sentMessages = process.sentMessages || [];
  const initialMsg = extractMsgFromNotes(process.notes);

  const [composeOpen, setComposeOpen] = useState(sentMessages.length === 0);
  const [recruiterMsg, setRecruiterMsg] = useState(initialMsg);
  const [channel, setChannel] = useState("linkedin");
  const [scenario, setScenario] = useState("reply_recruiter");
  const [extraCtx, setExtraCtx] = useState(false);
  const [extraVal, setExtraVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedTs, setCopiedTs] = useState(null);

  const threadRef = useRef(null);

  const buildThread = () => {
    const entries = [];
    [...sentMessages].sort((a, b) => a.ts - b.ts).forEach(m => {
      if (m.recruiterMsg) {
        entries.push({ type: "recruiter", text: m.recruiterMsg, channel: m.channel, ts: m.ts - 1, linked: m.ts });
      }
      entries.push({ type: "reply", ...m });
    });
    return entries;
  };

  const thread = buildThread();

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [thread.length, loading]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const cvContext = adaptation?.content || profile?.cvText || "";
      const scenLabel = SCENARIOS.find(sc => sc.id === scenario)?.label || scenario;
      const prompt = buildPrompt({ process, channel, scenario, scenLabel, recruiterMsg, extra: extraVal, cvContext });
      const raw = await callAI([{ role: "user", content: prompt }], MESSAGES_SYSTEM, s?.access_token);
      const parsed = parseAIResponse(raw);
      const entry = { ...parsed, channel, scenario: scenLabel, recruiterMsg: recruiterMsg || null, ts: Date.now() };
      persistEntry(entry);
    } catch {
      const entry = { body: "Erro ao gerar. Tente novamente.", channel, scenario: "Erro", recruiterMsg: recruiterMsg || null, ts: Date.now() };
      persistEntry(entry);
    }
    setLoading(false);
    setComposeOpen(false);
  };

  const copyText = async (text, ts) => {
    await navigator.clipboard.writeText(text);
    setCopiedTs(ts);
    setTimeout(() => setCopiedTs(null), 2000);
  };

  const persistEntry = (entry) => {
    if (!onUpdate) return;
    const toSave = {
      body: entry.body,
      subject: entry.subject || null,
      channel: entry.channel,
      scenario: entry.scenario,
      recruiterMsg: entry.recruiterMsg || null,
      ts: entry.ts,
    };
    onUpdate({ ...process, sentMessages: [...sentMessages, toSave].sort((a, b) => a.ts - b.ts) });
  };

  const deleteEntry = (ts) => {
    if (!onUpdate) return;
    onUpdate({ ...process, sentMessages: sentMessages.filter(m => m.ts !== ts) });
  };

  const ch = CHANNELS[channel];

  // ── Thread entries ──────────────────────────────────────────────────────────

  const RecruiterBubble = ({ entry }) => {
    const cfg = CHANNELS[entry.channel] || CHANNELS.linkedin;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "80%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
          <Ic n={cfg.icon} s={11} c={cfg.accent} />
          <span style={{ fontSize: 10, color: cfg.accent, ...T.mono, fontWeight: 600 }}>{process.recruiter || "Recrutador(a)"}</span>
          <span style={{ fontSize: 10, color: "var(--t4)", ...T.mono }}>{fmtTs(entry.ts + 1)}</span>
        </div>
        <div style={{ padding: "10px 14px", borderRadius: "0 12px 12px 12px", background: "var(--bg-o)", border: "1px solid var(--border)", fontSize: 13, color: "var(--t2)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {entry.text}
        </div>
      </div>
    );
  };

  const ReplyBubble = ({ entry }) => {
    const cfg = CHANNELS[entry.channel] || CHANNELS.linkedin;
    const copied = copiedTs === entry.ts;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "82%", alignSelf: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: "var(--t4)", ...T.mono }}>{fmtTs(entry.ts)}</span>
          <span style={{ fontSize: 10, color: cfg.accent, ...T.mono, fontWeight: 600 }}>{cfg.label} · {entry.scenario}</span>
          <Ic n="check" s={10} c="var(--grn)" />
        </div>
        {entry.subject && (
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 4, padding: "6px 10px", background: "var(--acc-d)", borderRadius: 8, border: "1px solid var(--acc-b)" }}>
            {entry.subject}
          </div>
        )}
        <div style={{ padding: "10px 14px", borderRadius: "12px 0 12px 12px", background: "var(--acc-d)", border: "1px solid var(--acc-b)", fontSize: 13, color: "var(--t1)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {entry.body}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
          <button onClick={() => copyText(entry.body, entry.ts)} style={{ fontSize: 11, color: copied ? "var(--grn)" : "var(--t3)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 3 }}>
            <Ic n={copied ? "check" : "copy"} s={11} c={copied ? "var(--grn)" : "var(--t3)"} />
            {copied ? "Copiado!" : "Copiar"}
          </button>
          {onUpdate && (
            <button onClick={() => deleteEntry(entry.ts)} style={{ fontSize: 11, color: "var(--t4)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 3 }}>
              <Ic n="trash" s={11} c="var(--t4)" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Compose area ─────────────────────────────────────────────────────────────

  const ComposeArea = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Recruiter msg */}
      <div>
        <div style={{ ...T.label, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <Ic n="msg" s={11} c="var(--t3)" />
          Mensagem do recrutador
          <span style={{ fontSize: 10, color: "var(--t4)", marginLeft: 2 }}>(opcional)</span>
        </div>
        <textarea
          value={recruiterMsg}
          onChange={e => setRecruiterMsg(e.target.value)}
          placeholder="Cole aqui a mensagem recebida — a IA vai gerar a melhor resposta..."
          rows={isMobile ? 3 : 4}
          style={{
            ...T.input, resize: "none", lineHeight: 1.6,
            borderColor: recruiterMsg ? "var(--acc-b)" : "var(--border)",
            background: recruiterMsg ? "rgba(124,106,255,0.04)" : "var(--bg-o)",
          }}
        />
      </div>

      {/* Channel */}
      <div>
        <div style={{ ...T.label, marginBottom: 8 }}>Canal</div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(CHANNELS).map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => setChannel(k)}
              style={{
                flex: 1, padding: "9px 10px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${channel === k ? cfg.border : "var(--border)"}`,
                background: channel === k ? cfg.bg : "var(--bg-o)",
                color: channel === k ? cfg.accent : "var(--t3)",
                transition: "all 0.15s", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4,
              }}
            >
              <Ic n={cfg.icon} s={16} c={channel === k ? cfg.accent : "var(--t3)"} />
              <span style={{ fontSize: 11, fontWeight: channel === k ? 700 : 400, fontFamily: "'Outfit',sans-serif" }}>{cfg.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scenario */}
      <div>
        <div style={{ ...T.label, marginBottom: 8 }}>Objetivo</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              style={{
                padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left",
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

      {/* Extra context */}
      <div>
        <button
          onClick={() => setExtraCtx(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: extraCtx ? "var(--acc-text)" : "var(--t3)", fontSize: 11, ...T.mono, padding: 0, marginBottom: extraCtx ? 8 : 0 }}
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
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const emptyThread = thread.length === 0 && !loading;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Thread */}
      <div
        ref={threadRef}
        style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 14px 8px" : "16px 20px 8px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        {emptyThread && !composeOpen && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", gap: 12, textAlign: "center" }}>
            <div style={{ opacity: 0.2 }}><Ic n="msg" s={32} c="var(--t2)" /></div>
            <div style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.65 }}>
              Nenhuma conversa ainda.<br />Clique em <strong style={{ color: "var(--t2)" }}>Nova mensagem</strong> para começar.
            </div>
          </div>
        )}
        {thread.map((entry, i) => (
          <div key={`${entry.type}-${entry.ts}-${i}`} style={{ display: "flex", flexDirection: "column" }}>
            {entry.type === "recruiter" ? (
              <RecruiterBubble entry={entry} />
            ) : (
              <ReplyBubble entry={entry} />
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ padding: "10px 16px", borderRadius: "12px 0 12px 12px", background: "var(--acc-d)", border: "1px solid var(--acc-b)", display: "flex", alignItems: "center", gap: 6 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--acc)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, display: "inline-block" }} />
              ))}
            </div>
          </div>
        )}

        {/* Compose area (inline, at end of thread) */}
        {composeOpen && (
          <div style={{ padding: "14px", background: "var(--bg-o)", borderRadius: 14, border: "1px solid var(--border)", marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", fontFamily: "'Outfit',sans-serif" }}>Nova mensagem</div>
              {thread.length > 0 && (
                <button onClick={() => setComposeOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <Ic n="close" s={14} c="var(--t3)" />
                </button>
              )}
            </div>
            <ComposeArea />
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{ flexShrink: 0, padding: isMobile ? "10px 14px" : "10px 20px", paddingBottom: isMobile ? `calc(10px + ${navH})` : "12px", borderTop: "1px solid var(--border)", background: "var(--bg-r)", display: "flex", gap: 8 }}>
        {!composeOpen ? (
          <button
            onClick={() => setComposeOpen(true)}
            style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1.5px dashed var(--acc-b)", background: "transparent", color: "var(--acc)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            <Ic n="plus" s={14} c="var(--acc)" />Nova mensagem
          </button>
        ) : (
          <button
            onClick={generate}
            disabled={loading}
            style={{
              flex: 1, padding: 13, borderRadius: 12,
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
              : <><Ic n={ch.icon} s={16} c={ch.accent} />Gerar resposta</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

export default ConversaTab;
