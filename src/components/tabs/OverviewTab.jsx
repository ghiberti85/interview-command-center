import { useState, useEffect } from "react";
import { CONTACT_CHANNELS, T } from "../../constants/index.js";
import { fmtDate } from "../../utils/dateUtils.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";
import InlineTags from "../process/InlineTags.jsx";

export function OverviewTab({ process, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(process);
  useEffect(()=>{ setDraft(process); setEditing(false); },[process.id]);
  const save = () => { onUpdate(draft); setEditing(false); };

  const InfoGrid = () => (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
      {[
        [process.origin==="outbound"?"Candidatura em":"Contactado em", fmtDate(process.contactedDate)],
        ["Salário", process.salary||"—"],
        ["Próxima etapa", fmtDate(process.nextStepDate)],
        ["Recrutador(a)", process.recruiter||"—"],
      ].map(([l,v])=>(
        <div key={l} style={{ padding:"12px 14px", background:"var(--bg-o)", borderRadius:10, border:"1px solid var(--border)" }}>
          <div style={{ ...T.label, marginBottom:4 }}>{l}</div>
          <div style={{ fontSize:13, color:"var(--t1)", fontWeight:500 }}>{v}</div>
        </div>
      ))}
    </div>
  );

  if (editing) return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {[["Empresa","company"],["Cargo","role"],["Localização","location"],["Salário","salary"],["Recrutador(a)","recruiter"],["E-mail","recruiterEmail"],["Link da vaga","jobUrl"],["Próximo passo","nextStepNote"]].map(([l,f])=>(
        <div key={f}>
          <label style={{ ...T.label, display:"block", marginBottom:6 }}>{l}</label>
          <input value={draft[f]||""} onChange={e=>setDraft({...draft,[f]:e.target.value})} style={{ ...T.input }}/>
        </div>
      ))}
      <div>
        <label style={{ ...T.label, display:"block", marginBottom:6 }}>Data próxima etapa</label>
        <input type="date" value={draft.nextStepDate||""} onChange={e=>setDraft({...draft,nextStepDate:e.target.value})} style={{ ...T.input }}/>
      </div>
      <div>
        <label style={{ ...T.label, display:"block", marginBottom:6 }}>Notas</label>
        <textarea value={draft.notes||""} onChange={e=>setDraft({...draft,notes:e.target.value})} rows={3} style={{ ...T.input, resize:"vertical" }}/>
      </div>
      <div>
        <label style={{ ...T.label, display:"block", marginBottom:6 }}>Tags (separadas por vírgula)</label>
        <input value={(draft.tags||[]).join(", ")} onChange={e=>setDraft({...draft,tags:e.target.value.split(",").map(t=>t.trim()).filter(Boolean)})} style={{ ...T.input }}/>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={save}>Salvar</Btn>
        <Btn variant="ghost" onClick={()=>{setEditing(false);setDraft(process);}}>Cancelar</Btn>
        <Btn variant="danger" onClick={onDelete} style={{ marginLeft:"auto" }}><Ic n="trash" s={13} c="var(--red)"/>Excluir</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        {[
          { value:"inbound",  label:"Fui contactado", icon:"msg",  activeBg:"var(--cyan-d)", activeBorder:"var(--cyan-b)", activeColor:"var(--cyan)" },
          { value:"outbound", label:"Me candidatei",  icon:"send", activeBg:"var(--acc-d)",  activeBorder:"var(--acc-b)",  activeColor:"var(--acc)"  },
        ].map(opt=>{
          const on = (process.origin||"inbound")===opt.value;
          return (
            <button key={opt.value} onClick={()=>onUpdate({...process,origin:opt.value})} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:999, cursor:"pointer", border:`1px solid ${on?opt.activeBorder:"var(--border)"}`, background:on?opt.activeBg:"transparent", color:on?opt.activeColor:"var(--t3)", fontSize:12, fontWeight:500, fontFamily:"'Outfit',sans-serif", transition:"all 0.15s" }}>
              <Ic n={opt.icon} s={12} c={on?opt.activeColor:"var(--t3)"}/>
              {opt.label}
              {on && <Ic n="check" s={11} c={opt.activeColor}/>}
            </button>
          );
        })}
        <button onClick={()=>setEditing(true)} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:8, border:"1px solid var(--border)", background:"transparent", color:"var(--t2)", fontSize:12, fontFamily:"'Outfit',sans-serif", cursor:"pointer" }}>
          <Ic n="edit" s={12} c="var(--t2)"/>Editar
        </button>
      </div>
      {(process.origin||"inbound")==="inbound" && (
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ ...T.label, marginRight:2 }}>Canal:</span>
          {CONTACT_CHANNELS.map(ch=>{
            const on = (process.channel||"")===ch.value;
            return (
              <button key={ch.value} onClick={()=>onUpdate({...process,channel:on?"":ch.value})} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:999, cursor:"pointer", border:`1px solid ${on?"var(--acc-b)":"var(--border)"}`, background:on?"var(--acc-d)":"transparent", color:on?"var(--acc)":"var(--t3)", fontSize:11, fontWeight:on?600:400, fontFamily:"'Outfit',sans-serif", transition:"all 0.15s" }}>
                <Ic n={ch.icon} s={11} c={on?"var(--acc)":"var(--t3)"}/>
                {ch.label}
              </button>
            );
          })}
        </div>
      )}
      <InfoGrid/>
      {process.nextStepNote && (
        <div style={{ padding:"12px 14px", background:"var(--amb-d)", border:"1px solid var(--amb-b)", borderRadius:10 }}>
          <div style={{ ...T.label, color:"var(--amb)", marginBottom:4 }}>Próxima etapa</div>
          <div style={{ fontSize:13, color:"var(--amb)" }}>{process.nextStepNote}</div>
        </div>
      )}
      {process.recruiterEmail && (
        <div style={{ padding:"12px 14px", background:"var(--bg-o)", border:"1px solid var(--border)", borderRadius:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ ...T.label, marginBottom:3 }}>Contato</div>
            <div style={{ fontSize:13, color:"var(--acc)" }}>{process.recruiter} · {process.recruiterEmail}</div>
          </div>
          {process.jobUrl && /^https?:\/\//i.test(process.jobUrl) && <a href={process.jobUrl} target="_blank" rel="noreferrer noopener" style={{ padding:"5px 12px", borderRadius:7, border:"1px solid var(--acc-b)", color:"var(--acc)", textDecoration:"none", fontSize:11, ...T.mono }}>↗ Vaga</a>}
        </div>
      )}
      {process.notes && (
        <div style={{ padding:"14px", background:"var(--bg-o)", border:"1px solid var(--border)", borderRadius:10 }}>
          <div style={{ ...T.label, marginBottom:6 }}>Notas</div>
          <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.65 }}>{process.notes}</div>
        </div>
      )}
      <div>
        <div style={{ ...T.label, marginBottom:6 }}>Tags</div>
        <InlineTags process={process} onUpdate={onUpdate}/>
      </div>
    </div>
  );
}

export default OverviewTab;
