import { useState } from "react";
import { STAGE, ACTIVE_STAGES } from "../../utils/constants.js";
import { CONTACT_CHANNELS, T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

export function NewProcessModal({ onClose, onSave, isMobile }) {
  const [form, setForm] = useState({ company:"", role:"", stage:"contacted", location:"", salary:"", recruiter:"", recruiterEmail:"", jobUrl:"", nextStepNote:"", nextStepDate:"", tags:"", notes:"", origin:"inbound", channel:"" });
  const [saving, setSaving] = useState(false);
  const F = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.company||!form.role||saving) return;
    setSaving(true);
    await onSave({
      ...form,
      id: crypto.randomUUID(),
      contactedDate: new Date().toISOString().split("T")[0],
      tags: form.tags.split(",").map(t=>t.trim()).filter(Boolean),
      steps: [{ date:new Date().toISOString().split("T")[0], type:form.stage, note:form.origin==="inbound"?"Recrutador entrou em contato":"Aplicação enviada" }],
      aiContext: "",
      starred: false,
    });
    onClose();
  };

  const fields = [["Empresa *","company"],["Cargo *","role"],["Localização","location"],["Salário / range","salary"],["Recrutador(a)","recruiter"],["E-mail / contato","recruiterEmail"],["Link da vaga","jobUrl"],["Próximo passo","nextStepNote"]];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:200, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border-md)", borderRadius:isMobile?"20px 20px 0 0":16, padding:isMobile?"20px 16px":"28px", width:isMobile?"100%":520, maxHeight:isMobile?"92dvh":"85vh", overflowY:"auto" }}>
        {isMobile && <div style={{ width:36, height:4, background:"var(--border-md)", borderRadius:2, margin:"0 auto 20px" }}/>}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h2 style={{ margin:0, fontFamily:"'Outfit',sans-serif", fontSize:20, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.02em" }}>Novo Processo</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", padding:4 }}><Ic n="close" s={18} c="var(--t3)"/></button>
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ ...T.label, marginBottom:8 }}>Como surgiu esta oportunidade?</div>
          <div style={{ display:"flex", borderRadius:12, border:"1.5px solid var(--border)", overflow:"hidden" }}>
            {[
              { value:"inbound",  label:"Fui contactado", sub:"recrutador veio até mim", icon:"msg",  activeBg:"var(--cyan-d)", activeBorder:"var(--cyan-b)", activeColor:"var(--cyan)" },
              { value:"outbound", label:"Me candidatei",  sub:"apliquei na vaga",        icon:"send", activeBg:"var(--acc-d)",  activeBorder:"var(--acc-b)",  activeColor:"var(--acc)"  },
            ].map((opt,i)=>(
              <button key={opt.value} onClick={()=>F("origin",opt.value)} style={{ flex:1, padding:"13px 10px", border:"none", cursor:"pointer", background:form.origin===opt.value?opt.activeBg:"var(--bg-o)", borderRight:i===0?"1px solid var(--border)":"none", transition:"background 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <Ic n={opt.icon} s={15} c={form.origin===opt.value?opt.activeColor:"var(--t3)"}/>
                <span style={{ fontSize:13, fontWeight:600, color:form.origin===opt.value?opt.activeColor:"var(--t2)", fontFamily:"'Outfit',sans-serif" }}>{opt.label}</span>
                <span style={{ fontSize:10, color:"var(--t4)", ...T.mono }}>{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>
        {form.origin==="inbound" && (
          <div style={{ marginBottom:20 }}>
            <div style={{ ...T.label, marginBottom:8 }}>Canal de contato</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {CONTACT_CHANNELS.map(ch=>{
                const on = form.channel===ch.value;
                return (
                  <button key={ch.value} onClick={()=>F("channel",on?"":ch.value)} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:999, cursor:"pointer", border:`1px solid ${on?"var(--acc-b)":"var(--border)"}`, background:on?"var(--acc-d)":"transparent", color:on?"var(--acc)":"var(--t3)", fontSize:12, fontWeight:on?600:400, fontFamily:"'Outfit',sans-serif", transition:"all 0.15s" }}>
                    <Ic n={ch.icon} s={12} c={on?"var(--acc)":"var(--t3)"}/>
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {fields.map(([label,field])=>(
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
        <div style={{ display:"flex", gap:8, marginTop:20 }}>
          <Btn full onClick={save} disabled={!form.company||!form.role||saving}>
            {saving ? "Salvando..." : "Adicionar Processo"}
          </Btn>
          <Btn variant="ghost" onClick={onClose} style={{ whiteSpace:"nowrap" }}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

export default NewProcessModal;
