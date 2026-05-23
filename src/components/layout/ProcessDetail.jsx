import { useState, useEffect } from "react";
import { T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Badge from "../ui/Badge.jsx";
import Tabs from "../process/Tabs.jsx";
import PipelineBar from "../process/PipelineBar.jsx";
import OverviewTab from "../tabs/OverviewTab.jsx";
import TimelineTab from "../tabs/TimelineTab.jsx";
import MessagesTab from "../tabs/MessagesTab.jsx";
import AITab from "../tabs/AITab.jsx";
import CVTab from "../tabs/CVTab.jsx";

export function ProcessDetail({ process, onUpdate, onDelete, isMobile, profile, onEditProfile, resumes, onManageResumes, initialTab }) {
  const [tab, setTab] = useState(initialTab || "overview");
  useEffect(()=>setTab(initialTab || "overview"),[process.id, initialTab]);

  const tabs = [
    { id:"overview",  label:"Overview" },
    { id:"timeline",  label:"Timeline" },
    { id:"messages",  label:"Respostas" },
    { id:"ai",        label:"AI" },
    { id:"curriculo", label:"Currículo" },
  ];
  const tabH = isMobile ? "calc(100dvh - 268px)" : "calc(100vh - 260px)";

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
        {tab==="overview"  && <div style={{ height:"100%", overflowY:"auto", padding:20 }}><OverviewTab process={process} onUpdate={onUpdate} onDelete={onDelete}/></div>}
        {tab==="timeline"  && <div style={{ height:"100%", overflowY:"auto", padding:20 }}><TimelineTab process={process} onUpdate={onUpdate}/></div>}
        {tab==="messages"  && <div style={{ height:tabH }}><MessagesTab process={process} isMobile={isMobile} autoFocus={initialTab==="messages"}/></div>}
        {tab==="ai"        && <div style={{ height:tabH }}><AITab process={process} isMobile={isMobile}/></div>}
        {tab==="curriculo" && (
          <div style={{ height:tabH, display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"8px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ fontSize:11, color:"var(--t3)" }}>
                {profile.stack.length>0 ? `${profile.stack.length} tecnologias no perfil` : "Perfil não configurado"}
              </div>
              <button onClick={onEditProfile} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", color:"var(--t2)", fontSize:11, cursor:"pointer", fontFamily:"'Outfit',sans-serif" }}>
                <Ic n="edit" s={11} c="var(--t2)"/>Editar perfil
              </button>
            </div>
            <div style={{ flex:1, minHeight:0 }}>
              <CVTab process={process} profile={profile} isMobile={isMobile} resumes={resumes} onManageResumes={onManageResumes}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProcessDetail;
