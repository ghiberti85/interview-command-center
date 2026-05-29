import { useState, useEffect } from "react";
import { T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Badge from "../ui/Badge.jsx";
import Tabs from "../process/Tabs.jsx";
import PipelineBar from "../process/PipelineBar.jsx";
import ConversaTab from "../tabs/ConversaTab.jsx";
import VagaTab from "../tabs/VagaTab.jsx";
import CVTab from "../tabs/CVTab.jsx";

export function ProcessDetail({ process, onUpdate, onDelete, isMobile, isPWA, navH: navHProp, profile, onEditProfile, resumes, onManageResumes, initialTab, adaptation, onSaveAdaptation }) {
  const [tab, setTab] = useState(initialTab || "conversa");
  useEffect(()=>setTab(initialTab || "conversa"),[process.id, initialTab]);

  const tabs = [
    { id:"conversa",  label:"Conversa"  },
    { id:"vaga",      label:"Vaga"      },
    { id:"curriculo", label:"Currículo" },
  ];
  const navH = isMobile ? (navHProp || "calc(56px + env(safe-area-inset-bottom, 0px))") : "0px";

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>{process.company}</h2>
              <button onClick={()=>onUpdate({...process,starred:!process.starred})} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", padding:2 }}>
                <Ic n={process.starred?"starF":"star"} s={17} c={process.starred?"#F5A623":"var(--t4)"}/>
              </button>
            </div>
            <div style={{ color:"var(--t2)", fontSize:13, marginTop:3 }}>{process.role} · {process.location}</div>
          </div>
          <Badge stage={process.stage}/>
        </div>
        <PipelineBar stage={process.stage} onStageClick={s=>onUpdate({...process,stage:s})}/>
      </div>
      <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <Tabs tabs={tabs} active={tab} onChange={setTab}/>
      </div>
      <div style={{ flex:1, overflow:"hidden", minHeight:0 }}>
        {tab==="conversa"  && <div style={{ height:"100%" }}><ConversaTab process={process} isMobile={isMobile} navH={navH} profile={profile} adaptation={adaptation} onUpdate={onUpdate}/></div>}
        {tab==="vaga"      && <div style={{ height:"100%" }}><VagaTab process={process} onUpdate={onUpdate} onDelete={onDelete} isMobile={isMobile}/></div>}
        {tab==="curriculo" && (
          <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"8px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ fontSize:11, color:"var(--t3)" }}>
                {profile.stack.length>0 ? `${profile.stack.length} tecnologias no perfil` : "Perfil não configurado"}
              </div>
              <button onClick={onEditProfile} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", color:"var(--t2)", fontSize:11, cursor:"pointer", fontFamily:"'Outfit',sans-serif" }}>
                <Ic n="edit" s={11} c="var(--t2)"/>Editar perfil
              </button>
            </div>
            <div style={{ flex:1, minHeight:0 }}>
              <CVTab process={process} profile={profile} isMobile={isMobile} resumes={resumes} onManageResumes={onManageResumes} adaptation={adaptation} onSaveAdaptation={onSaveAdaptation}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProcessDetail;
