import { useState, useEffect, useRef } from "react";
import { CONTACT_CHANNELS, T } from "../../constants/index.js";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";
import { t, meetingTypeLabel } from "../../utils/i18n.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";
import InlineTags from "../process/InlineTags.jsx";

const MEETING_TYPES = [
  { id: "triagem",    stage: "screening"  },
  { id: "entrevista", stage: "interview"  },
  { id: "tecnica",    stage: "technical"  },
  { id: "proposta",   stage: "offer"      },
  { id: "outro",      stage: null         },
];

const sanitizeUrl = (url) => (url && /^https?:\/\//i.test(url.trim()) ? url.trim() : "");

function buildDILUrl(process) {
  const base = "https://devinterviewlab.vercel.app/roadmap";
  const params = new URLSearchParams();
  if (process.role)    params.set("role",    process.role);
  if (process.company) params.set("company", process.company);
  const stack = (process.tags || []).filter(Boolean);
  if (stack.length)    params.set("stack",   stack.join(","));
  if (process.notes)   params.set("context", process.notes.slice(0, 400));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function extractContextNote(notes) {
  if (!notes) return { contextMsg: "", freeNotes: "" };
  const prefix = "Mensagem original:\n";
  if (notes.startsWith(prefix)) {
    return { contextMsg: notes.slice(prefix.length).trim(), freeNotes: "" };
  }
  return { contextMsg: "", freeNotes: notes };
}

function DatePicker({ value, onChange, diff, urgent, soon, lang = "pt" }) {
  const inputRef = useRef(null);
  const statusColor = urgent ? "var(--red)" : soon ? "var(--amb)" : "var(--t2)";
  const statusText = diff === null ? null
    : diff === 0 ? t(lang, "today")
    : diff < 0 ? t(lang, "daysAgo")(Math.abs(diff))
    : t(lang, "inDays")(diff);

  return (
    <div>
      <div style={{ ...T.label, marginBottom: 5 }}>{t(lang, "dateLabel")}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => inputRef.current?.showPicker?.() ?? inputRef.current?.click()}
          style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, border:"1.5px solid var(--border-md)", background:"var(--bg-s)", cursor:"pointer", color:value?"var(--t1)":"var(--t3)", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:value?500:400 }}
        >
          <Ic n="cal" s={13} c={value ? statusColor : "var(--t3)"} />
          {value ? fmtDate(value) : t(lang, "selectDate")}
        </button>
        {value && statusText && <span style={{ fontSize:11, color:statusColor, ...T.mono }}>{statusText}</span>}
        {value && (
          <button onClick={() => onChange("")} style={{ display:"inline-flex", alignItems:"center", background:"none", border:"none", cursor:"pointer", padding:4 }}>
            <Ic n="close" s={11} c="var(--t3)" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="date" value={value} onChange={e => onChange(e.target.value)}
        style={{ position:"absolute", opacity:0, pointerEvents:"none", width:0, height:0 }} tabIndex={-1} />
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      style={{ flexShrink:0, transition:"transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
      <path d="M6 9l6 6 6-6" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AccordionCard({ icon, title, badge, open, onToggle, children }) {
  return (
    <div style={{ borderRadius:14, border:"1px solid var(--border)", background:"var(--bg-r)", overflow:"hidden", transition:"border-color 0.15s" }}>
      <button
        onClick={onToggle}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"12px 16px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}
      >
        <Ic n={icon} s={13} c="var(--t3)" />
        <span style={{ flex:1, ...T.label, color:"var(--t2)", fontSize:11 }}>{title}</span>
        {badge}
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ borderTop:"1px solid var(--border)", padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function VagaTab({ process, onUpdate, onDelete, isMobile, lang = "pt" }) {
  const [open, setOpen]             = useState({ next: true, vaga: true, notes: true });
  const [editingField, setEditingField] = useState(null);
  const [drafts, setDrafts]             = useState({});
  const [meetingType, setMeetingType]   = useState(() => {
    const mt = MEETING_TYPES.find(m => m.stage === process.stage);
    return mt ? mt.id : "";
  });

  useEffect(() => {
    const mt = MEETING_TYPES.find(m => m.stage === process.stage);
    setMeetingType(mt ? mt.id : "");
    setDrafts({});
    setEditingField(null);
  }, [process.id]);

  const diff   = daysDiff(process.nextStepDate);
  const urgent = diff !== null && diff >= 0 && diff <= 2;
  const soon   = diff !== null && diff >= 0 && diff <= 7 && !urgent;

  const toggle = (key) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const saveField = (field, value) => {
    setEditingField(null);
    setDrafts(prev => { const n = {...prev}; delete n[field]; return n; });
    const safe = field === "jobUrl" ? sanitizeUrl(value) : value;
    onUpdate({ ...process, [field]: safe });
  };

  const handleMeetingType = (typeId) => {
    setMeetingType(typeId);
    const mt = MEETING_TYPES.find(m => m.id === typeId);
    if (mt?.stage) onUpdate({ ...process, stage: mt.stage });
  };

  const EditableText = ({ field, value, placeholder, multiline, label }) => {
    const isEditing = editingField === field;
    const draftVal  = drafts[field] !== undefined ? drafts[field] : value || "";
    if (isEditing) {
      return (
        <div>
          {label && <div style={{ ...T.label, marginBottom:5 }}>{label}</div>}
          {multiline ? (
            <textarea autoFocus value={draftVal} rows={3}
              onChange={e => setDrafts(prev => ({ ...prev, [field]: e.target.value }))}
              onBlur={() => saveField(field, draftVal)}
              style={{ ...T.input, resize:"vertical", lineHeight:1.6 }} />
          ) : (
            <input autoFocus value={draftVal} placeholder={placeholder}
              onChange={e => setDrafts(prev => ({ ...prev, [field]: e.target.value }))}
              onBlur={() => saveField(field, draftVal)}
              onKeyDown={e => { if (e.key==="Enter") saveField(field, draftVal); if (e.key==="Escape") { setEditingField(null); setDrafts(prev => { const n={...prev}; delete n[field]; return n; }); }}}
              style={{ ...T.input }} />
          )}
        </div>
      );
    }
    return (
      <button onClick={() => { setEditingField(field); setDrafts(prev => ({ ...prev, [field]: value||"" })); }}
        style={{ background:"none", border:"none", cursor:"text", textAlign:"left", padding:0, width:"100%", display:"block" }}>
        {label && <div style={{ ...T.label, marginBottom:4 }}>{label}</div>}
        <div style={{ fontSize:13, color:value?"var(--t1)":"var(--t4)", lineHeight:1.6 }}>{value || placeholder || "—"}</div>
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

  const col2 = isMobile ? "1fr" : "1fr 1fr";
  const col3 = isMobile ? "1fr 1fr" : "1fr 1fr 1fr";

  const nextBadge = urgent ? (
    <span style={{ fontSize:10, padding:"2px 7px", borderRadius:999, background:"var(--red)", color:"#fff", ...T.mono, fontWeight:700 }}>{t(lang, "urgentBadge")}</span>
  ) : soon ? (
    <span style={{ fontSize:10, padding:"2px 7px", borderRadius:999, background:"var(--amb)", color:"#fff", ...T.mono, fontWeight:700 }}>{t(lang, "soonBadge")}</span>
  ) : process.nextStepDate ? (
    <span style={{ fontSize:10, color:"var(--t3)", ...T.mono }}>{fmtDate(process.nextStepDate)}</span>
  ) : null;

  return (
    <div style={{ height:"100%", overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
      <div style={{ padding: isMobile ? "12px" : "20px", paddingBottom: isMobile ? "80px" : "20px", display:"flex", flexDirection:"column", gap:10 }}>

        {/* ── Próxima etapa ─────────────────────────────────────── */}
        <AccordionCard icon={urgent?"alert":"cal"} title={t(lang, "nextStep")} badge={nextBadge} open={open.next} onToggle={() => toggle("next")}>
          <DatePicker value={process.nextStepDate||""} onChange={val=>onUpdate({...process,nextStepDate:val||null})} diff={diff} urgent={urgent} soon={soon} lang={lang} />
          <div>
            <div style={{ ...T.label, marginBottom:6 }}>{t(lang, "stepType")}</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {MEETING_TYPES.map(mt => {
                const on = meetingType === mt.id;
                return (
                  <button key={mt.id} onClick={() => handleMeetingType(mt.id)} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${on?"var(--acc-b)":"var(--border)"}`, background:on?"var(--acc-d)":"transparent", color:on?"var(--acc-text)":"var(--t3)", fontSize:12, cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:on?600:400, transition:"all 0.15s" }}>
                    {meetingTypeLabel(mt.id, lang)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ ...T.label, marginBottom:5 }}>{t(lang, "stepDesc")}</div>
            <input value={process.nextStepNote||""} onChange={e=>onUpdate({...process,nextStepNote:e.target.value})}
              placeholder={lang === "en" ? "e.g. Technical interview with the platform team" : "Ex: Entrevista técnica com o time de plataforma"} style={{ ...T.input }} />
          </div>
        </AccordionCard>

        {/* ── Dados da vaga ─────────────────────────────────────── */}
        <AccordionCard icon="pipeline" title={t(lang, "jobData")} open={open.vaga} onToggle={() => toggle("vaga")}>
          <div style={{ display:"grid", gridTemplateColumns:col2, gap:12 }}>
            <EditableText field="company"  value={process.company}  label={t(lang, "companyLabel")} placeholder={lang === "en" ? "Company name" : "Nome da empresa"} />
            <EditableText field="role"     value={process.role}     label={t(lang, "roleLabel")}    placeholder={lang === "en" ? "Job title" : "Título da vaga"} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:col3, gap:10 }}>
            <EditableText field="location" value={process.location} label={t(lang, "locationLabel")} placeholder={lang === "en" ? "Remote / NYC" : "Remoto / SP"} />
            <EditableText field="salary"   value={process.salary}   label={t(lang, "salaryLabel")}   placeholder="—" />
            <div>
              <div style={{ ...T.label, marginBottom:6 }}>{t(lang, "originLabel")}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {[{value:"inbound",label:"Inbound"},{value:"outbound",label:"Outbound"}].map(opt => (
                  <button key={opt.value} onClick={() => onUpdate({...process,origin:opt.value})}
                    style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${(process.origin||"inbound")===opt.value?"var(--acc-b)":"var(--border)"}`, background:(process.origin||"inbound")===opt.value?"var(--acc-d)":"transparent", color:(process.origin||"inbound")===opt.value?"var(--acc-text)":"var(--t3)", fontSize:11, cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all 0.15s" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(process.origin||"inbound")==="inbound" && (
            <div>
              <div style={{ ...T.label, marginBottom:6 }}>{t(lang, "channelLabel")}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {CONTACT_CHANNELS.map(ch => {
                  const on = (process.channel||"")===ch.value;
                  return (
                    <button key={ch.value} onClick={()=>onUpdate({...process,channel:on?"":ch.value})}
                      style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, border:`1px solid ${on?"var(--acc-b)":"var(--border)"}`, background:on?"var(--acc-d)":"transparent", color:on?"var(--acc-text)":"var(--t3)", fontSize:11, cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all 0.15s" }}>
                      <Ic n={ch.icon} s={11} c={on?"var(--acc)":"var(--t3)"}/>{ch.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ borderTop:"1px solid var(--border)", paddingTop:12, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:col2, gap:12 }}>
              <EditableText field="recruiter"      value={process.recruiter}      label={t(lang, "recruiterLabel")} placeholder={lang === "en" ? "Name" : "Nome"} />
              <EditableText field="recruiterEmail" value={process.recruiterEmail} label={t(lang, "emailLabel")}     placeholder="email@company.com" />
            </div>
            <EditableText field="jobUrl" value={process.jobUrl} label={t(lang, "jobLinkLabel")} placeholder="https://..." />
            {drafts.jobUrl !== undefined && drafts.jobUrl && !/^https?:\/\//i.test(drafts.jobUrl) && (
              <div style={{ fontSize:11, color:"var(--amb)", fontFamily:"'Outfit',sans-serif" }}>
                {lang === "en" ? "URL must start with https:// — will be discarded if invalid." : "URL deve começar com https:// — será descartada se inválida."}
              </div>
            )}
            {process.jobUrl && /^https?:\/\//i.test(process.jobUrl) && (
              <a href={process.jobUrl} target="_blank" rel="noreferrer noopener"
                style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, color:"var(--acc-text)", textDecoration:"none" }}>
                <Ic n="send" s={11} c="var(--acc)"/>{t(lang, "openJob")}
              </a>
            )}
          </div>
          <div>
            <div style={{ ...T.label, marginBottom:6 }}>{t(lang, "tagsLabel")}</div>
            <InlineTags process={process} onUpdate={onUpdate} />
          </div>
        </AccordionCard>

        {/* ── Anotações ──────────────────────────────────────────── */}
        <AccordionCard icon="edit" title={t(lang, "notesTitle")} open={open.notes} onToggle={() => toggle("notes")}>
          {contextMsg && (
            <div>
              <div style={{ ...T.label, marginBottom:5 }}>{t(lang, "contextLabel")}</div>
              <div style={{ fontSize:12, color:"var(--t3)", lineHeight:1.6, padding:"8px 12px", background:"var(--bg-s)", borderRadius:8, border:"1px solid var(--border)" }}>
                {contextMsg.slice(0,200)}{contextMsg.length>200?"…":""}
              </div>
            </div>
          )}
          <textarea value={localNotes} onChange={e=>setLocalNotes(e.target.value)} onBlur={saveNotes}
            placeholder={t(lang, "freeNotes")}
            rows={isMobile ? 5 : 4}
            style={{ ...T.input, resize:"vertical", lineHeight:1.65 }} />
        </AccordionCard>

        {/* ── Praticar para esta vaga ────────────────────────────── */}
        <a href={buildDILUrl(process)} target="_blank" rel="noopener noreferrer"
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"11px 16px", borderRadius:10, border:"1px solid var(--acc-b)", background:"var(--acc-d)", color:"var(--acc-text)", textDecoration:"none", fontSize:13, fontWeight:500, fontFamily:"'Outfit',sans-serif" }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}
        >
          <Ic n="ai" s={14} c="var(--acc)"/>{t(lang, "practiceJob")}
        </a>

        {/* ── Deletar ────────────────────────────────────────────── */}
        <div style={{ display:"flex", justifyContent:"flex-end", paddingBottom:8 }}>
          <Btn variant="danger" size="sm" onClick={() => {
            if (window.confirm(t(lang, "deleteProcessConfirm"))) onDelete();
          }}>
            <Ic n="trash" s={12} c="var(--red)"/>{t(lang, "deleteProcess")}
          </Btn>
        </div>

      </div>
    </div>
  );
}

export default VagaTab;
