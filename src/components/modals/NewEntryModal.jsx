import { useState } from "react";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import { STAGE } from "../../utils/constants.js";
import { CONTACT_CHANNELS, T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

// ── AI prompts ────────────────────────────────────────────────────────────────

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

const DRAFT_SYSTEM = `Você é Fernando, Senior Full-Stack Engineer / Front-End Tech Lead com 10+ anos de experiência (React, Next.js, Node.js, TypeScript, Supabase). Você foi contactado por um recrutador.
Escreva UMA resposta inicial na primeira pessoa, como se fosse você mesmo digitando agora.
Regras:
- Confirme o interesse de forma direta (não exagerada)
- Faça UMA pergunta estratégica sobre a vaga (stack, modelo de trabalho ou próximo passo)
- Máximo 3 parágrafos curtos, tom profissional mas humano
- Sem saudações genéricas ("Espero que esteja bem"), sem "Atenciosamente"
- Não mencione IA
- Responda SEMPRE no mesmo idioma da mensagem do recrutador
Responda SOMENTE com o texto da mensagem, sem introdução, sem aspas, sem explicações.`;

// ── Manual form fields ────────────────────────────────────────────────────────

const FIELDS = [
  ["Empresa *",       "company"],
  ["Cargo *",         "role"],
  ["Localização",     "location"],
  ["Salário / range", "salary"],
  ["Recrutador(a)",   "recruiter"],
  ["E-mail / contato","recruiterEmail"],
  ["Link da vaga",    "jobUrl"],
  ["Próximo passo",   "nextStepNote"],
];

const INITIAL_FORM = {
  company:"", role:"", stage:"contacted", location:"", salary:"",
  recruiter:"", recruiterEmail:"", jobUrl:"", nextStepNote:"",
  nextStepDate:"", tags:"", notes:"", channel:"",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NewEntryModal({ onClose, onProcessCreated, isMobile, initialMsg = "" }) {
  // steps: choose → contact (inbound) → working → result
  //        choose → manual (outbound)
  const [step, setStep]       = useState(initialMsg ? "contact" : "choose");
  const [origin, setOrigin]   = useState(initialMsg ? "inbound" : "");
  const [channel, setChannel] = useState("");
  const [msg, setMsg]         = useState(initialMsg);
  const [extracted, setExtracted] = useState(null);
  const [draft, setDraft]     = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState("");
  const [saved, setSaved]     = useState(false);
  const [form, setForm]       = useState(INITIAL_FORM);
  const [saving, setSaving]   = useState(false);

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Inbound: analyze message ────────────────────────────────────────────────

  const analyze = async () => {
    if (!msg.trim()) return;
    setStep("working");
    setError("");
    let token;
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token;
    } catch {
      setError("Erro de autenticação. Recarregue a página.");
      setStep("contact");
      return;
    }
    let ext;
    try {
      const raw = await callAI([{ role:"user", content:msg }], EXTRACTION_SYSTEM, token);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      ext = {
        recruiter:    parsed.recruiter    || "",
        recruiterRole:parsed.recruiterRole|| "",
        company:      parsed.company      || "",
        role:         parsed.role         || "",
        stack:        parsed.stack        || "",
        regime:       parsed.regime       || "",
        salary:       parsed.salary       || "",
        nextStep:     parsed.nextStep     || "",
        location:     parsed.location     || "",
      };
      setExtracted(ext);
    } catch {
      setError("Não foi possível extrair as informações. Verifique a mensagem e tente novamente.");
      setStep("contact");
      return;
    }
    setStep("result");
    setDraftLoading(true);
    try {
      const userMsg = `Recrutador: ${ext.recruiter || "recrutador"}${ext.recruiterRole ? ` (${ext.recruiterRole})` : ""}
Empresa: ${ext.company || "empresa"} | Cargo: ${ext.role || "cargo"} | Regime: ${ext.regime || "—"} | Salário: ${ext.salary || "—"}
Canal: ${channel || "mensagem"}
Mensagem do recrutador:
"${msg}"`;
      const draftText = await callAI([{ role:"user", content:userMsg }], DRAFT_SYSTEM, token);
      setDraft(draftText.trim());
    } catch { setDraft(""); }
    finally { setDraftLoading(false); }
  };

  // ── Inbound: save process ───────────────────────────────────────────────────

  const saveInbound = () => {
    if (saved) { onClose(); return; }
    const today = new Date().toISOString().slice(0, 10);
    const tags  = extracted?.stack ? extracted.stack.split(",").map(s => s.trim()).filter(Boolean) : [];
    const channelNote = channel ? `Contactado via ${CONTACT_CHANNELS.find(c=>c.value===channel)?.label || channel}` : "Contactado";
    const process = {
      id: crypto.randomUUID(),
      company:      extracted?.company  || "Empresa?",
      role:         extracted?.role     || "Cargo?",
      stage:        "contacted",
      origin:       "inbound",
      channel:      channel || "",
      location:     extracted?.location || "",
      salary:       extracted?.salary   || "",
      recruiter:    extracted?.recruiter|| "",
      recruiterEmail:"",
      contactedDate: today,
      nextStepDate:  null,
      nextStepNote:  extracted?.nextStep|| "",
      jobUrl:        "",
      tags,
      notes: `Mensagem original:\n${msg}`,
      steps: [{ date:today, type:"contacted", note:channelNote }],
      aiContext: "",
      starred:   false,
    };
    onProcessCreated(process);
    setSaved(true);
  };

  // ── Outbound: save process ──────────────────────────────────────────────────

  const saveOutbound = async () => {
    if (!form.company || !form.role || saving) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    await onProcessCreated({
      ...form,
      id: crypto.randomUUID(),
      origin: "outbound",
      channel: "",
      contactedDate: today,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      steps: [{ date:today, type:form.stage, note:"Aplicação enviada" }],
      aiContext: "",
      starred: false,
    });
    onClose();
  };

  const copyDraft = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const overlay = {
    position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
    display:"flex", alignItems: isMobile ? "flex-end" : "center",
    justifyContent:"center", zIndex:1000,
    backdropFilter:"blur(4px)",
  };
  const sheet = {
    background:"var(--bg-r)",
    borderRadius: isMobile ? "20px 20px 0 0" : 16,
    border:"1px solid var(--border-md)",
    width:"100%", maxWidth:520,
    maxHeight: isMobile ? "92dvh" : "88vh",
    overflow:"hidden", display:"flex", flexDirection:"column",
    boxShadow:"0 24px 60px rgba(0,0,0,0.35)",
  };
  const hdr = {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"16px 20px", borderBottom:"1px solid var(--border)", flexShrink:0,
  };
  const body = {
    flex:1, overflowY:"auto", padding:20,
    display:"flex", flexDirection:"column", gap:14,
  };
  const ftr = {
    padding:"14px 20px", borderTop:"1px solid var(--border)",
    display:"flex", gap:8, justifyContent:"space-between",
    alignItems:"center", flexShrink:0,
  };

  const stepTitle = {
    choose:  "Novo processo",
    contact: "Fui contactado",
    working: "Analisando…",
    result:  "Pronto para responder",
    manual:  "Me candidatei",
  }[step];

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sheet}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={hdr}>
          {isMobile && <div style={{ position:"absolute", top:8, left:"50%", transform:"translateX(-50%)", width:36, height:4, background:"var(--border-md)", borderRadius:2 }}/>}
          <div style={{ display:"flex", alignItems:"center", gap:9, marginTop: isMobile ? 8 : 0 }}>
            {step !== "choose" && (
              <button onClick={()=>{
                if (step === "contact" || step === "manual") setStep("choose");
                else if (step === "result") { setStep("contact"); setDraft(""); setExtracted(null); setSaved(false); }
              }} style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", borderRadius:6, display:"flex", marginRight:2 }}>
                <Ic n="back" s={15} c="var(--t3)"/>
              </button>
            )}
            <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:15, color:"var(--t1)" }}>{stepTitle}</span>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:6, display:"flex" }}>
            <Ic n="close" s={16} c="var(--t3)"/>
          </button>
        </div>

        {/* ── STEP: choose ───────────────────────────────────────────────── */}
        {step === "choose" && (
          <div style={{ ...body, gap:12, justifyContent:"center" }}>
            <p style={{ fontSize:13, color:"var(--t3)", fontFamily:"'Outfit',sans-serif", margin:0, lineHeight:1.6, textAlign:"center" }}>
              Como surgiu esta oportunidade?
            </p>
            {[
              {
                value:"inbound", icon:"msg", next:"contact",
                label:"Fui contactado",
                sub:"Recrutador veio até mim — colo a mensagem e a IA preenche tudo",
                activeBg:"rgba(34,211,238,0.08)", activeBorder:"rgba(34,211,238,0.3)", activeColor:"var(--cyan)",
              },
              {
                value:"outbound", icon:"send", next:"manual",
                label:"Me candidatei",
                sub:"Apliquei na vaga e quero registrar o processo manualmente",
                activeBg:"var(--acc-d)", activeBorder:"var(--acc-b)", activeColor:"var(--acc)",
              },
            ].map(opt => (
              <button key={opt.value} onClick={()=>{ setOrigin(opt.value); setStep(opt.next); }}
                style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"18px 16px", borderRadius:14, border:`1.5px solid ${opt.activeBorder}`, background:opt.activeBg, cursor:"pointer", textAlign:"left", width:"100%", transition:"opacity 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >
                <div style={{ width:40, height:40, borderRadius:12, background:"var(--bg-o)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                  <Ic n={opt.icon} s={18} c={opt.activeColor}/>
                </div>
                <div>
                  <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:15, color:"var(--t1)", marginBottom:4 }}>{opt.label}</div>
                  <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:12, color:"var(--t3)", lineHeight:1.5 }}>{opt.sub}</div>
                </div>
                <Ic n="back" s={14} c="var(--t4)" style={{ marginLeft:"auto", flexShrink:0, alignSelf:"center", transform:"rotate(180deg)" }}/>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP: contact ──────────────────────────────────────────────── */}
        {step === "contact" && (
          <>
            <div style={body}>
              <div>
                <div style={{ ...T.label, marginBottom:8 }}>Canal de contato</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {CONTACT_CHANNELS.map(ch => {
                    const on = channel === ch.value;
                    return (
                      <button key={ch.value} onClick={()=>setChannel(on ? "" : ch.value)}
                        style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:999, cursor:"pointer", border:`1px solid ${on?"var(--acc-b)":"var(--border)"}`, background:on?"var(--acc-d)":"var(--bg-o)", color:on?"var(--acc)":"var(--t3)", fontSize:13, fontWeight:on?600:400, fontFamily:"'Outfit',sans-serif", transition:"all 0.15s" }}>
                        <Ic n={ch.icon} s={13} c={on?"var(--acc)":"var(--t3)"}/>
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ ...T.label, marginBottom:8 }}>Mensagem recebida</div>
                <textarea
                  autoFocus
                  value={msg}
                  onChange={e=>setMsg(e.target.value)}
                  onKeyDown={e=>{ if((e.ctrlKey||e.metaKey)&&e.key==="Enter"&&msg.trim()) analyze(); }}
                  placeholder="Cole aqui a mensagem do recrutador — a IA extrai empresa, cargo, stack e gera uma resposta pronta…"
                  rows={isMobile ? 5 : 7}
                  style={{ ...T.input, resize:"none", lineHeight:1.65, fontSize:13 }}
                />
                {msg.trim() && (
                  <div style={{ marginTop:5, fontSize:11, color:"var(--t3)", ...T.mono }}>
                    {msg.trim().split(/\s+/).length} palavras · Ctrl+Enter para analisar
                  </div>
                )}
              </div>
              {error && (
                <div style={{ padding:"10px 14px", borderRadius:10, background:"rgba(255,106,106,0.08)", border:"1px solid rgba(255,106,106,0.2)", color:"var(--red)", fontSize:13, fontFamily:"'Outfit',sans-serif" }}>
                  {error}
                </div>
              )}
            </div>
            <div style={ftr}>
              <button onClick={()=>{ setOrigin("outbound"); setStep("manual"); }}
                style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t3)", fontSize:12, fontFamily:"'Outfit',sans-serif", padding:"6px 8px", borderRadius:8 }}>
                Preencher manualmente
              </button>
              <Btn variant="primary" onClick={analyze} disabled={!msg.trim()}>
                <Ic n="ai" s={14} c="#fff"/> Analisar mensagem
              </Btn>
            </div>
          </>
        )}

        {/* ── STEP: working ──────────────────────────────────────────────── */}
        {step === "working" && (
          <div style={{ ...body, alignItems:"center", justifyContent:"center", minHeight:200 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", border:"3px solid var(--acc-b)", borderTopColor:"var(--acc)", animation:"spin 0.8s linear infinite" }}/>
              <span style={{ fontSize:13, color:"var(--t3)", fontFamily:"'Outfit',sans-serif" }}>Extraindo informações…</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          </div>
        )}

        {/* ── STEP: result ───────────────────────────────────────────────── */}
        {step === "result" && extracted && (
          <>
            <div style={body}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { key:"company", label:"Empresa" },
                  { key:"role",    label:"Cargo"   },
                  { key:"salary",  label:"Salário" },
                  { key:"regime",  label:"Regime"  },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    <span style={{ ...T.label }}>{label}</span>
                    <input
                      value={extracted[key]}
                      onChange={e=>setExtracted(prev=>({ ...prev, [key]:e.target.value }))}
                      placeholder={`${label}…`}
                      style={{ ...T.input, fontSize:13 }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ ...T.label }}>Rascunho de resposta</span>
                  {draftLoading && (
                    <div style={{ width:12, height:12, borderRadius:"50%", border:"2px solid var(--border)", borderTopColor:"var(--acc)", animation:"spin 0.6s linear infinite", flexShrink:0 }}/>
                  )}
                </div>
                {draftLoading ? (
                  <div style={{ height:120, borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-o)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:12, color:"var(--t4)", fontFamily:"'Outfit',sans-serif" }}>Gerando resposta…</span>
                  </div>
                ) : draft ? (
                  <textarea readOnly value={draft}
                    style={{ ...T.input, resize:"none", height:120, lineHeight:1.65, background:"var(--bg-o)", cursor:"text", fontSize:13, overflowY:"auto" }}
                  />
                ) : (
                  <div style={{ padding:14, borderRadius:10, border:"1px solid var(--border)", background:"var(--bg-o)" }}>
                    <span style={{ fontSize:12, color:"var(--t3)", fontFamily:"'Outfit',sans-serif" }}>Não foi possível gerar a resposta. Use a aba Mensagens no processo.</span>
                  </div>
                )}
              </div>
            </div>
            <div style={ftr}>
              <div/>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {draft && !draftLoading && (
                  <button onClick={copyDraft}
                    style={{ display:"flex", alignItems:"center", gap:6, background:copied?"rgba(34,198,122,0.1)":"var(--bg-o)", border:`1px solid ${copied?"rgba(34,198,122,0.3)":"var(--border)"}`, borderRadius:8, cursor:"pointer", color:copied?"var(--grn)":"var(--t2)", fontSize:13, fontFamily:"'Outfit',sans-serif", padding:"8px 14px", transition:"all 0.15s", fontWeight:500 }}>
                    <Ic n={copied?"check":"copy"} s={13} c={copied?"var(--grn)":"var(--t2)"}/>
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                )}
                <Btn variant="primary" onClick={saveInbound}>
                  <Ic n={saved?"check":"plus"} s={14} c="#fff"/>
                  {saved ? "Abrir processo" : "Salvar"}
                </Btn>
              </div>
            </div>
          </>
        )}

        {/* ── STEP: manual ───────────────────────────────────────────────── */}
        {step === "manual" && (
          <>
            <div style={body}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {FIELDS.map(([label, field]) => (
                  <div key={field} style={{ gridColumn:["company","role","nextStepNote","jobUrl"].includes(field)?"span 2":"span 1" }}>
                    <label style={{ ...T.label, display:"block", marginBottom:6 }}>{label}</label>
                    <input value={form[field]} onChange={e=>F(field,e.target.value)} style={{ ...T.input, boxSizing:"border-box" }}/>
                  </div>
                ))}
                <div style={{ gridColumn:"span 2" }}>
                  <label style={{ ...T.label, display:"block", marginBottom:6 }}>Data próxima etapa</label>
                  <input type="date" value={form.nextStepDate} onChange={e=>F("nextStepDate",e.target.value)} style={{ ...T.input, boxSizing:"border-box" }}/>
                </div>
                <div style={{ gridColumn:"span 2" }}>
                  <label style={{ ...T.label, display:"block", marginBottom:6 }}>Estágio atual</label>
                  <select value={form.stage} onChange={e=>F("stage",e.target.value)} style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-o)", color:"var(--t1)", fontSize:14, outline:"none", fontFamily:"'Outfit',sans-serif" }}>
                    {Object.entries(STAGE).filter(([k])=>!["rejected","archived"].includes(k)).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:"span 2" }}>
                  <label style={{ ...T.label, display:"block", marginBottom:6 }}>Tags (separadas por vírgula)</label>
                  <input value={form.tags} onChange={e=>F("tags",e.target.value)} placeholder="React, Remoto, FinTech" style={{ ...T.input, boxSizing:"border-box" }}/>
                </div>
                <div style={{ gridColumn:"span 2" }}>
                  <label style={{ ...T.label, display:"block", marginBottom:6 }}>Notas iniciais</label>
                  <textarea rows={3} value={form.notes} onChange={e=>F("notes",e.target.value)} style={{ ...T.input, resize:"vertical", boxSizing:"border-box" }}/>
                </div>
              </div>
            </div>
            <div style={ftr}>
              <div/>
              <div style={{ display:"flex", gap:8 }}>
                <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
                <Btn variant="primary" onClick={saveOutbound} disabled={!form.company||!form.role||saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default NewEntryModal;
