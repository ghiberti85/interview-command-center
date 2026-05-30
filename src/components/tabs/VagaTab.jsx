import { useState, useEffect } from "react";
import { CONTACT_CHANNELS, T } from "../../constants/index.js";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";
import InlineTags from "../process/InlineTags.jsx";

const MEETING_TYPES = [
  { id: "triagem",    label: "Triagem",    stage: "screening"  },
  { id: "entrevista", label: "Entrevista", stage: "interview"  },
  { id: "tecnica",    label: "Técnica",    stage: "technical"  },
  { id: "proposta",   label: "Proposta",   stage: "offer"      },
  { id: "outro",      label: "Outro",      stage: null         },
];

function buildDILUrl(process) {
  const base = "https://devinterviewlab.vercel.app/interview";
  const params = new URLSearchParams();
  if (process.role) params.set("role", process.role);
  if (process.company) params.set("company", process.company);
  const stack = (process.tags || []).filter(Boolean);
  if (stack.length) params.set("stack", stack.join(","));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : null;
}

function extractContextNote(notes) {
  if (!notes) return { contextMsg: "", freeNotes: "" };
  const prefix = "Mensagem original:\n";
  if (notes.startsWith(prefix)) {
    return { contextMsg: notes.slice(prefix.length).trim(), freeNotes: "" };
  }
  return { contextMsg: "", freeNotes: notes };
}

export function VagaTab({ process, onUpdate, onDelete, isMobile }) {
  const [editingField, setEditingField] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [meetingType, setMeetingType] = useState(() => {
    // Infer meeting type from current stage
    const mt = MEETING_TYPES.find(m => m.stage === process.stage);
    return mt ? mt.id : "";
  });

  useEffect(() => {
    const mt = MEETING_TYPES.find(m => m.stage === process.stage);
    setMeetingType(mt ? mt.id : "");
    setDrafts({});
    setEditingField(null);
  }, [process.id]);

  const diff = daysDiff(process.nextStepDate);
  const urgent = diff !== null && diff >= 0 && diff <= 2;
  const soon = diff !== null && diff >= 0 && diff <= 7 && !urgent;

  const saveField = (field, value) => {
    setEditingField(null);
    setDrafts(prev => { const n = {...prev}; delete n[field]; return n; });
    onUpdate({ ...process, [field]: value });
  };

  const handleMeetingType = (typeId) => {
    setMeetingType(typeId);
    const mt = MEETING_TYPES.find(m => m.id === typeId);
    if (mt && mt.stage) {
      onUpdate({ ...process, stage: mt.stage });
    }
  };

  const EditableText = ({ field, value, placeholder, multiline, label }) => {
    const isEditing = editingField === field;
    const draftVal = drafts[field] !== undefined ? drafts[field] : value || "";

    if (isEditing) {
      return (
        <div>
          {label && <div style={{ ...T.label, marginBottom: 5 }}>{label}</div>}
          {multiline ? (
            <textarea
              autoFocus
              value={draftVal}
              rows={3}
              onChange={e => setDrafts(prev => ({ ...prev, [field]: e.target.value }))}
              onBlur={() => saveField(field, draftVal)}
              style={{ ...T.input, resize: "vertical", lineHeight: 1.6 }}
            />
          ) : (
            <input
              autoFocus
              value={draftVal}
              placeholder={placeholder}
              onChange={e => setDrafts(prev => ({ ...prev, [field]: e.target.value }))}
              onBlur={() => saveField(field, draftVal)}
              onKeyDown={e => { if (e.key === "Enter") saveField(field, draftVal); if (e.key === "Escape") { setEditingField(null); setDrafts(prev => { const n={...prev}; delete n[field]; return n; }); }}}
              style={{ ...T.input }}
            />
          )}
        </div>
      );
    }

    return (
      <button
        onClick={() => { setEditingField(field); setDrafts(prev => ({ ...prev, [field]: value || "" })); }}
        style={{ background: "none", border: "none", cursor: "text", textAlign: "left", padding: 0, width: "100%", display: "block" }}
      >
        {label && <div style={{ ...T.label, marginBottom: 4 }}>{label}</div>}
        <div style={{ fontSize: 13, color: value ? "var(--t1)" : "var(--t4)", lineHeight: 1.6 }}>
          {value || placeholder || "—"}
        </div>
      </button>
    );
  };

  const { contextMsg, freeNotes } = extractContextNote(process.notes);
  const [localNotes, setLocalNotes] = useState(freeNotes);
  useEffect(() => {
    const { freeNotes: fn } = extractContextNote(process.notes);
    setLocalNotes(fn);
  }, [process.id]);

  const saveNotes = () => {
    let newNotes = localNotes;
    if (contextMsg) newNotes = `Mensagem original:\n${contextMsg}${localNotes ? "\n\n" + localNotes : ""}`;
    onUpdate({ ...process, notes: newNotes });
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: isMobile ? "14px" : "20px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Section A: Próxima etapa ─────────────────────────── */}
      <div style={{ padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${process.nextStepDate ? (urgent ? "var(--red-b)" : "var(--amb-b)") : "var(--border)"}`, background: process.nextStepDate ? (urgent ? "var(--red-d)" : "var(--amb-d)") : "var(--bg-o)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
          <Ic n={urgent ? "alert" : "cal"} s={13} c={urgent ? "var(--red)" : process.nextStepDate ? "var(--amb)" : "var(--t3)"} />
          <span style={{ fontSize: 13, fontWeight: 700, color: urgent ? "var(--red)" : process.nextStepDate ? "var(--amb)" : "var(--t2)", fontFamily: "'Outfit',sans-serif" }}>
            Próxima etapa
          </span>
          {urgent && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--red)", color: "#fff", ...T.mono, fontWeight: 700 }}>URGENTE</span>}
          {soon && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--amb)", color: "#fff", ...T.mono, fontWeight: 700 }}>EM BREVE</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ ...T.label, marginBottom: 5 }}>Data</div>
            <input
              type="date"
              value={process.nextStepDate || ""}
              onChange={e => onUpdate({ ...process, nextStepDate: e.target.value || null })}
              style={{ ...T.input, filter: "var(--date-picker-filter)" }}
            />
            {process.nextStepDate && diff !== null && (
              <div style={{ fontSize: 11, color: urgent ? "var(--red)" : soon ? "var(--amb)" : "var(--t3)", marginTop: 4, ...T.mono }}>
                {diff === 0 ? "Hoje" : diff < 0 ? `${Math.abs(diff)} dias atrás` : `Em ${diff} dias`} — {fmtDate(process.nextStepDate)}
              </div>
            )}
          </div>
          <div>
            <div style={{ ...T.label, marginBottom: 6 }}>Tipo de etapa</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {MEETING_TYPES.map(mt => {
                const on = meetingType === mt.id;
                return (
                  <button key={mt.id} onClick={() => handleMeetingType(mt.id)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${on ? "var(--acc-b)" : "var(--border)"}`, background: on ? "var(--acc-d)" : "transparent", color: on ? "var(--acc-text)" : "var(--t3)", fontSize: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: on ? 600 : 400, transition: "all 0.15s" }}>
                    {mt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ ...T.label, marginBottom: 5 }}>Descrição / instrução</div>
            <input
              value={process.nextStepNote || ""}
              onChange={e => onUpdate({ ...process, nextStepNote: e.target.value })}
              placeholder="Ex: Entrevista técnica com o time de plataforma"
              style={{ ...T.input }}
            />
          </div>
        </div>
      </div>

      {/* ── Section B: Dados da vaga ─────────────────────────── */}
      <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-o)", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
          <Ic n="pipeline" s={12} c="var(--t3)" />
          <span style={{ ...T.label }}>Dados da vaga</span>
        </div>
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <EditableText field="company" value={process.company} label="Empresa" placeholder="Nome da empresa" />
            <EditableText field="role" value={process.role} label="Cargo" placeholder="Título da vaga" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <EditableText field="location" value={process.location} label="Local" placeholder="Remoto / SP" />
            <EditableText field="salary" value={process.salary} label="Salário" placeholder="—" />
            <div>
              <div style={{ ...T.label, marginBottom: 6 }}>Origem</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[{ value: "inbound", label: "Inbound" }, { value: "outbound", label: "Outbound" }].map(opt => (
                  <button key={opt.value} onClick={() => onUpdate({ ...process, origin: opt.value })} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, border: `1px solid ${(process.origin || "inbound") === opt.value ? "var(--acc-b)" : "var(--border)"}`, background: (process.origin || "inbound") === opt.value ? "var(--acc-d)" : "transparent", color: (process.origin || "inbound") === opt.value ? "var(--acc-text)" : "var(--t3)", fontSize: 11, cursor: "pointer", fontFamily: "'Outfit',sans-serif", transition: "all 0.15s" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(process.origin || "inbound") === "inbound" && (
            <div>
              <div style={{ ...T.label, marginBottom: 6 }}>Canal</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CONTACT_CHANNELS.map(ch => {
                  const on = (process.channel || "") === ch.value;
                  return (
                    <button key={ch.value} onClick={() => onUpdate({ ...process, channel: on ? "" : ch.value })} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, border: `1px solid ${on ? "var(--acc-b)" : "var(--border)"}`, background: on ? "var(--acc-d)" : "transparent", color: on ? "var(--acc-text)" : "var(--t3)", fontSize: 11, cursor: "pointer", fontFamily: "'Outfit',sans-serif", transition: "all 0.15s" }}>
                      <Ic n={ch.icon} s={11} c={on ? "var(--acc)" : "var(--t3)"} />{ch.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <EditableText field="recruiter" value={process.recruiter} label="Recrutador(a)" placeholder="Nome" />
              <EditableText field="recruiterEmail" value={process.recruiterEmail} label="E-mail" placeholder="email@empresa.com" />
            </div>
            <EditableText field="jobUrl" value={process.jobUrl} label="Link da vaga" placeholder="https://..." />
            {process.jobUrl && /^https?:\/\//i.test(process.jobUrl) && (
              <a href={process.jobUrl} target="_blank" rel="noreferrer noopener" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--acc-text)", textDecoration: "none" }}>
                <Ic n="send" s={11} c="var(--acc)" />Abrir vaga →
              </a>
            )}
          </div>
          <div>
            <div style={{ ...T.label, marginBottom: 6 }}>Tags</div>
            <InlineTags process={process} onUpdate={onUpdate} />
          </div>
        </div>
      </div>

      {/* ── Section C: Anotações ─────────────────────────────── */}
      <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-o)", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
          <Ic n="edit" s={12} c="var(--t3)" />
          <span style={{ ...T.label }}>Anotações</span>
        </div>
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {contextMsg && (
            <div>
              <div style={{ ...T.label, marginBottom: 5, color: "var(--t3)" }}>Contexto inicial</div>
              <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6, padding: "8px 12px", background: "var(--bg-s)", borderRadius: 8, border: "1px solid var(--border)" }}>{contextMsg.slice(0, 200)}{contextMsg.length > 200 ? "…" : ""}</div>
            </div>
          )}
          <textarea
            value={localNotes}
            onChange={e => setLocalNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Anotações livres sobre este processo..."
            rows={4}
            style={{ ...T.input, resize: "vertical", lineHeight: 1.65 }}
          />
        </div>
      </div>

      {/* ── DIL Link ───────────────────────────────────────────── */}
      {buildDILUrl(process) && (
        <a href={buildDILUrl(process)} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--acc-b)", background: "var(--acc-d)", color: "var(--acc-text)", textDecoration: "none", fontSize: 13, fontWeight: 500, fontFamily: "'Outfit',sans-serif" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <Ic n="ai" s={14} c="var(--acc)" />Praticar para esta vaga
        </a>
      )}

      {/* ── Actions ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingBottom: 8, flexWrap: "wrap" }}>
        {!["rejected","archived"].includes(process.stage) && (
          <Btn variant="secondary" size="sm" onClick={() => onUpdate({ ...process, stage: "rejected" })}>
            <Ic n="close" s={12} c="var(--t2)" />Encerrar processo
          </Btn>
        )}
        {confirmDelete ? (
          <>
            <Btn variant="danger" size="sm" onClick={onDelete}>
              <Ic n="trash" s={12} c="var(--red)" />Confirmar exclusão
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancelar</Btn>
          </>
        ) : (
          <Btn variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Ic n="trash" s={12} c="var(--red)" />Excluir processo
          </Btn>
        )}
      </div>
    </div>
  );
}

export default VagaTab;
