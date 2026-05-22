import { useState, useEffect, useCallback } from "react";
import { supabase, rowToProcess, processToRow } from "./supabase";

// Constants & utils
import { DARK_VARS, LIGHT_VARS, GLOBAL_CSS, DEMO_PROCESSES, T, iconBtn } from "./constants/index.js";
import { STAGE, ACTIVE_STAGES } from "./utils/constants.js";
import { sortProcesses } from "./utils/sort.js";
import { filterProcesses } from "./utils/filterProcesses.js";
import { daysDiff } from "./utils/dateUtils.js";

// Hooks
import { useAuth } from "./hooks/useAuth.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { useTheme } from "./hooks/useTheme.js";
import { useUserProfile } from "./hooks/useUserProfile.js";
import { useResumes } from "./hooks/useResumes.js";

// UI components
import Ic from "./components/ui/Ic.jsx";
import Btn from "./components/ui/Btn.jsx";

// Process components
import ProcessCard from "./components/process/ProcessCard.jsx";

// Layout
import { Dashboard, MobileDashboard } from "./components/layout/Dashboard.jsx";
import ProcessDetail from "./components/layout/ProcessDetail.jsx";

// Auth
import LoginScreen from "./components/auth/LoginScreen.jsx";

// Modals
import NewProcessModal from "./components/modals/NewProcessModal.jsx";
import SetPasswordModal from "./components/modals/SetPasswordModal.jsx";
import ProfileSetupModal from "./components/modals/ProfileSetupModal.jsx";
import ResumesModal from "./components/modals/ResumesModal.jsx";
import ImportChatGPTModal from "./components/modals/ImportChatGPTModal.jsx";

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", gap:16, padding:40 }}>
      <div style={{ width:36, height:36, borderRadius:"50%", border:"2px solid var(--border)", borderTopColor:"var(--acc)", animation:"spin 0.7s linear infinite" }}/>
      <div style={{ fontSize:13, color:"var(--t3)", fontFamily:"'JetBrains Mono',monospace" }}>carregando...</div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const { dark, toggle: toggleTheme } = useTheme();
  const { session, isRecovery, clearRecovery } = useAuth();
  const [isDemo, setIsDemo] = useState(false);
  const [processes, setProcesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("pipeline");
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sortBy, setSortBy] = useState("urgencia");
  const [mobileScreen, setMobileScreen] = useState("list");
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const { profile, saveProfile } = useUserProfile();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showResumes, setShowResumes] = useState(false);
  const { resumes, loading: resumesLoading, add: addResume, update: updateResume, remove: removeResume } = useResumes(session);

  // Apply CSS vars
  useEffect(() => {
    const vars = dark ? DARK_VARS : LIGHT_VARS;
    Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    document.body.style.background = vars["--bg"];
    document.body.style.color = vars["--t1"];
  }, [dark]);

  // Load processes
  useEffect(() => {
    if (isDemo) {
      setProcesses(DEMO_PROCESSES);
      setSelected(DEMO_PROCESSES[0]);
      setDbLoading(false);
      return;
    }
    async function load() {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) { console.error("[ICC] DB load error:", error); setDbError(true); setDbLoading(false); return; }
      const mapped = (data || []).map(rowToProcess);
      setProcesses(mapped);
      if (mapped.length > 0) setSelected(mapped[0]);
      setDbLoading(false);
    }
    load();
  }, [isDemo]);

  // Auto-show set password modal after password recovery redirect
  useEffect(() => {
    if (isRecovery) { setShowSetPassword(true); }
  }, [isRecovery]);

  const updateProcess = useCallback(async (updated) => {
    setProcesses(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelected(updated);
    if (!isDemo) await supabase.from("processes").upsert({ ...processToRow(updated), user_id: session?.user?.id });
  }, [isDemo, session]);

  const deleteProcess = useCallback(async () => {
    if (!selected) return;
    if (!isDemo) await supabase.from("processes").delete().eq("id", selected.id);
    setProcesses(prev => {
      const next = prev.filter(p => p.id !== selected.id);
      setSelected(next[0] || null);
      return next;
    });
    if (isMobile) setMobileScreen("list");
  }, [selected, isMobile, isDemo]);

  const addProcess = useCallback(async (p) => {
    if (isDemo) {
      setProcesses(prev => [p, ...prev]);
      setSelected(p);
      setView("pipeline");
      if (isMobile) setMobileScreen("detail");
      return;
    }
    const row = { ...processToRow(p), user_id: session?.user?.id };
    const { error } = await supabase.from("processes").insert(row);
    if (!error) {
      setProcesses(prev => [p, ...prev]);
      setSelected(p);
      setView("pipeline");
      if (isMobile) setMobileScreen("detail");
    }
  }, [isMobile, session]);

  const importProcesses = useCallback(async (newProcesses) => {
    if (isDemo || !newProcesses.length) return;
    const rows = newProcesses.map(p => ({ ...processToRow(p), user_id: session?.user?.id }));
    const { error } = await supabase.from("processes").insert(rows);
    if (!error) setProcesses(prev => [...newProcesses, ...prev]);
  }, [session, isDemo]);

  const active = processes.filter(p=>!["rejected","archived"].includes(p.stage));
  const archived = processes.filter(p=>["rejected","archived"].includes(p.stage));
  const listSrc = view==="archived" ? archived : active;
  const filtered = sortProcesses(filterProcesses(listSrc, search, stageFilter), sortBy);
  const urgent = active.filter(p=>{ const d=daysDiff(p.nextStepDate); return d!==null&&d>=0&&d<=2; }).length;

  const EmptyState = () => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:20, padding:40, textAlign:"center" }}>
      <div style={{ width:56, height:56, borderRadius:16, background:"var(--acc-d)", border:"1px solid var(--acc-b)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Ic n="pipeline" s={24} c="var(--acc)"/>
      </div>
      <div>
        <div style={{ fontSize:18, fontWeight:700, color:"var(--t1)", marginBottom:6 }}>Nenhum processo ainda</div>
        <div style={{ fontSize:13, color:"var(--t3)", lineHeight:1.6, maxWidth:260 }}>Adicione seu primeiro processo seletivo para começar a gerenciar suas oportunidades.</div>
      </div>
      <Btn onClick={()=>setShowNew(true)}><Ic n="plus" s={14} c="#fff"/>Novo Processo</Btn>
    </div>
  );

  // Auth loading
  if (session === undefined) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"var(--bg)" }}>
        <Spinner/>
      </div>
    </>
  );

  // Not authenticated
  if (!session && !isDemo) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LoginScreen onDemo={()=>setIsDemo(true)}/>
    </>
  );

  if (dbError) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"var(--bg)", flexDirection:"column", gap:12 }}>
        <Ic n="alert" s={32} c="var(--red)"/>
        <div style={{ fontSize:14, color:"var(--red)" }}>Erro ao conectar com o banco de dados</div>
        <div style={{ fontSize:11, color:"var(--t3)", fontFamily:"'JetBrains Mono',monospace" }}>Verifique sua conexão ou tente novamente mais tarde.</div>
      </div>
    </>
  );

  // ── Desktop layout ──────────────────────────────────────────
  if (!isMobile) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--bg)" }}>
        {/* Sidebar */}
        <div style={{ width:268, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", background:"var(--bg)", flexShrink:0 }}>
          {isDemo && (
            <div style={{ margin:"10px 10px 0", padding:"8px 12px", borderRadius:10, background:"var(--amb-d)", border:"1px solid var(--amb-b)", display:"flex", alignItems:"center", gap:8 }}>
              <Ic n="info" s={13} c="var(--amb)"/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:"var(--amb)", fontWeight:600 }}>Modo demonstração</div>
                <div style={{ fontSize:10, color:"var(--amb)", opacity:0.7 }}>Dados não são salvos</div>
              </div>
              <button onClick={()=>setIsDemo(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:10, color:"var(--amb)", fontFamily:"'Outfit',sans-serif", fontWeight:600, whiteSpace:"nowrap" }}>Sair</button>
            </div>
          )}
          <div style={{ padding:"16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Ic n="target" s={16} c="#fff"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:14, color:"var(--t1)", letterSpacing:"-0.02em", fontFamily:"'Outfit',sans-serif" }}>Interview OS</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginTop:1 }}>Command Center</div>
            </div>
            <div style={{ display:"flex", gap:2 }}>
              <button className="icon-btn" onClick={toggleTheme} style={iconBtn()} title="Alternar tema" aria-label="Alternar tema">
                <Ic n={dark?"sun":"moon"} s={15} c="var(--t3)"/>
              </button>
              {!isDemo && <button className="icon-btn" onClick={()=>setShowSetPassword(true)} style={iconBtn()} title="Definir senha" aria-label="Definir senha"><Ic n="edit" s={15} c="var(--t3)"/></button>}
              {!isDemo && <button className="icon-btn" onClick={()=>supabase.auth.signOut()} style={iconBtn()} title="Sair" aria-label="Sair"><Ic n="logout" s={15} c="var(--t3)"/></button>}
            </div>
          </div>
          <div style={{ padding:"8px" }}>
            {[
              { id:"pipeline",  icon:"pipeline", label:"Pipeline",   count:active.length },
              { id:"dashboard", icon:"chart",    label:"Dashboard"   },
              { id:"archived",  icon:"archive",  label:"Arquivados", count:archived.length },
            ].map(n=>(
              <button key={n.id} onClick={()=>setView(n.id)} className={`nav-btn${view===n.id?" active":""}`} style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 10px", borderRadius:9, border:"none", marginBottom:2, background:view===n.id?"var(--acc-d)":"transparent", color:view===n.id?"var(--acc)":"var(--t2)", cursor:"pointer", fontSize:13, fontWeight:view===n.id?600:500, fontFamily:"'Outfit',sans-serif", transition:"all 0.15s", textAlign:"left" }}>
                <Ic n={n.icon} s={15} c={view===n.id?"var(--acc)":"var(--t3)"}/>
                <span style={{ flex:1 }}>{n.label}</span>
                {n.count!=null && <span style={{ padding:"2px 7px", borderRadius:999, background:view===n.id?"var(--acc-d)":"var(--bg-s)", color:view===n.id?"var(--acc)":"var(--t3)", fontSize:11, fontFamily:"'JetBrains Mono',monospace", border:`1px solid ${view===n.id?"var(--acc-b)":"var(--border)"}` }}>{n.count}</span>}
              </button>
            ))}
          </div>
          {urgent>0 && (
            <div style={{ margin:"0 8px 4px", padding:"10px 12px", borderRadius:10, background:"var(--red-d)", border:"1px solid var(--red-b)", display:"flex", alignItems:"center", gap:8 }}>
              <Ic n="alert" s={13} c="var(--red)"/>
              <div>
                <div style={{ fontSize:12, color:"var(--red)", fontWeight:600 }}>{urgent} etapa{urgent>1?"s urgentes":" urgente"}</div>
                <div style={{ fontSize:11, color:"var(--red)", opacity:0.7, marginTop:1 }}>Ação necessária em 48h</div>
              </div>
            </div>
          )}
          <div style={{ padding:"4px 8px 6px" }}>
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><Ic n="search" s={13} c="var(--t4)"/></div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." aria-label="Buscar processos" style={{ ...T.input, paddingLeft:32, fontSize:13, borderRadius:9 }}/>
            </div>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-o)", color:"var(--t2)", fontSize:12, fontFamily:"'Outfit',sans-serif", cursor:"pointer", outline:"none", marginTop:6 }}>
              <option value="urgencia">Ordenar: Urgência</option>
              <option value="empresa">Ordenar: Empresa A–Z</option>
              <option value="stage">Ordenar: Stage</option>
              <option value="recente">Ordenar: Mais recente</option>
            </select>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"4px 8px" }}>
            {dbLoading ? (
              <div style={{ padding:"24px 0" }}><Spinner/></div>
            ) : filtered.length===0 ? (
              <div style={{ color:"var(--t3)", fontSize:12, textAlign:"center", padding:"24px 0" }}>
                {processes.length===0 ? "Nenhum processo ainda" : "Sem resultados"}
              </div>
            ) : filtered.map(p=>(
              <ProcessCard key={p.id} process={p} onClick={()=>setSelected(p)} selected={selected?.id===p.id}/>
            ))}
          </div>
          <div style={{ padding:"8px" }}>
            <button className="nav-btn" onClick={()=>setShowNew(true)} style={{ width:"100%", padding:"10px", borderRadius:10, border:"1.5px dashed var(--border)", background:"transparent", color:"var(--acc)", cursor:"pointer", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:600, transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
              <Ic n="plus" s={14} c="var(--acc)"/>Novo Processo
            </button>
            {!isDemo && (
              <button className="nav-btn" onClick={()=>setShowImport(true)} style={{ width:"100%", padding:"8px 10px", borderRadius:10, border:"1px solid var(--border)", background:"transparent", color:"var(--t3)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:500, transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginTop:4 }}>
                <svg width="13" height="13" viewBox="0 0 41 41" fill="none"><path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.504-3.357 10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.356 10.079 10.079 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.5v4.999l-4.331 2.5-4.331-2.5V18z" fill="var(--t3)"/></svg>
                Importar do ChatGPT
              </button>
            )}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {dbLoading ? <Spinner/> : view==="dashboard" ? (
            <Dashboard processes={processes}/>
          ) : (
            <div style={{ flex:1, overflowY:"auto" }}>
              {selected
                ? <ProcessDetail process={processes.find(p=>p.id===selected.id)||selected} onUpdate={updateProcess} onDelete={deleteProcess} isMobile={false} profile={profile} onEditProfile={()=>setShowProfileModal(true)} resumes={resumes} onManageResumes={()=>setShowResumes(true)}/>
                : <EmptyState/>
              }
            </div>
          )}
        </div>
      </div>
      {showNew && <NewProcessModal onClose={()=>setShowNew(false)} onSave={addProcess} isMobile={false}/>}
      {showSetPassword && <SetPasswordModal onClose={()=>setShowSetPassword(false)} onSuccess={clearRecovery}/>}
      {showProfileModal && <ProfileSetupModal onClose={()=>setShowProfileModal(false)} onSave={saveProfile} isMobile={false} initial={profile}/>}
      {showImport && <ImportChatGPTModal onClose={()=>setShowImport(false)} onImport={importProcesses} isMobile={false} isDemo={isDemo}/>}
      {showResumes && <ResumesModal onClose={()=>setShowResumes(false)} isMobile={false} resumes={resumes} onAdd={addResume} onUpdate={updateResume} onDelete={removeResume} loading={resumesLoading}/>}
    </>
  );

  // ── Mobile layout ───────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"var(--bg)", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px 10px", borderBottom:"1px solid var(--border)", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          {mobileScreen==="detail" && view!=="dashboard" ? (
            <button onClick={()=>setMobileScreen("list")} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:14, fontWeight:600, fontFamily:"'Outfit',sans-serif", padding:0 }}>
              <Ic n="back" s={16} c="var(--acc)"/>Voltar
            </button>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:7, background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center" }}><Ic n="target" s={13} c="#fff"/></div>
              <div style={{ fontWeight:800, fontSize:15, color:"var(--t1)", fontFamily:"'Outfit',sans-serif", letterSpacing:"-0.02em" }}>Interview OS</div>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {urgent>0 && (
              <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:10, background:"var(--red-d)", border:"1px solid var(--red-b)" }}>
                <Ic n="alert" s={11} c="var(--red)"/>
                <span style={{ fontSize:11, color:"var(--red)", fontWeight:600 }}>{urgent}</span>
              </div>
            )}
            <button className="icon-btn" onClick={toggleTheme} style={iconBtn({ width:44, height:44, borderRadius:10, border:"1px solid var(--border)", background:"var(--bg-r)" })} aria-label="Alternar tema">
              <Ic n={dark?"sun":"moon"} s={16} c="var(--t3)"/>
            </button>
            <button className="icon-btn" onClick={()=>supabase.auth.signOut()} style={iconBtn({ width:44, height:44, borderRadius:10, border:"1px solid var(--border)", background:"var(--bg-r)" })} title="Sair" aria-label="Sair">
              <Ic n="logout" s={16} c="var(--t3)"/>
            </button>
            {!isDemo && (
              <button className="icon-btn" onClick={()=>setShowImport(true)} style={iconBtn({ width:44, height:44, borderRadius:10, border:"1px solid var(--border)", background:"var(--bg-r)" })} aria-label="Importar do ChatGPT" title="Importar do ChatGPT">
                <svg width="16" height="16" viewBox="0 0 41 41" fill="none"><path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.504-3.357 10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.356 10.079 10.079 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.5v4.999l-4.331 2.5-4.331-2.5V18z" fill="var(--t3)"/></svg>
              </button>
            )}
            <button className="icon-btn" onClick={()=>setShowNew(true)} style={iconBtn({ width:44, height:44, borderRadius:10, border:"none", background:"var(--acc-d)" })} aria-label="Novo processo">
              <Ic n="plus" s={17} c="var(--acc)"/>
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {dbLoading && <Spinner/>}

          {!dbLoading && view==="dashboard" && (
            <div style={{ flex:1, overflowY:"auto", paddingBottom:70 }}><MobileDashboard processes={processes}/></div>
          )}

          {!dbLoading && view!=="dashboard" && mobileScreen==="list" && (
            <div style={{ flex:1, overflowY:"auto", paddingBottom:70, animation:"slideUp 0.2s ease" }}>
              <div style={{ padding:"12px 16px 8px" }}>
                <div style={{ position:"relative" }}>
                  <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}><Ic n="search" s={14} c="var(--t4)"/></div>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar empresa ou cargo..." style={{ ...T.input, paddingLeft:34, fontSize:14 }}/>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, padding:"0 16px 12px", overflowX:"auto", scrollbarWidth:"none" }}>
                {[{id:"all",label:"Todos"},...ACTIVE_STAGES.map(s=>({id:s,label:STAGE[s].label}))].map(p=>{
                  const isActive = stageFilter===p.id;
                  return (
                    <div key={p.id} onClick={()=>setStageFilter(p.id)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:`1px solid ${isActive?"var(--acc-b)":"var(--border)"}`, background:isActive?"var(--acc-d)":"var(--bg-r)", color:isActive?"var(--acc)":"var(--t3)", fontSize:12, cursor:"pointer", fontFamily:"'Outfit',sans-serif", whiteSpace:"nowrap", fontWeight:isActive?600:400, transition:"all 0.15s" }}>{p.label}</div>
                  );
                })}
              </div>
              <div style={{ padding:"0 16px 8px" }}>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-o)", color:"var(--t2)", fontSize:12, fontFamily:"'Outfit',sans-serif", cursor:"pointer", outline:"none" }}>
                  <option value="urgencia">Ordenar: Urgência</option>
                  <option value="empresa">Ordenar: Empresa A–Z</option>
                  <option value="stage">Ordenar: Stage</option>
                  <option value="recente">Ordenar: Mais recente</option>
                </select>
              </div>
              <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:8 }}>
                {filtered.length===0 ? (
                  processes.length===0 ? <EmptyState/> : <div style={{ color:"var(--t4)", fontSize:13, textAlign:"center", padding:"32px 0" }}>Nenhum resultado</div>
                ) : filtered.map(p=>(
                  <ProcessCard key={p.id} process={p} onClick={()=>{setSelected(p);setMobileScreen("detail");}} selected={false} isMobile={true} onSwipeAction={()=>updateProcess({...p,stage:"rejected"})}/>
                ))}
              </div>
            </div>
          )}

          {!dbLoading && view!=="dashboard" && mobileScreen==="detail" && selected && (
            <div style={{ flex:1, overflowY:"auto", paddingBottom:70, animation:"slideUp 0.22s ease" }}>
              <ProcessDetail process={processes.find(p=>p.id===selected.id)||selected} onUpdate={updateProcess} onDelete={deleteProcess} isMobile={true} profile={profile} onEditProfile={()=>setShowProfileModal(true)} resumes={resumes} onManageResumes={()=>setShowResumes(true)}/>
            </div>
          )}
        </div>

        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"var(--bg)", borderTop:"1px solid var(--border)", display:"flex", paddingBottom:"env(safe-area-inset-bottom,0px)", flexShrink:0 }}>
          {[
            { id:"pipeline", icon:"pipeline", label:"Pipeline" },
            { id:"dashboard", icon:"chart",   label:"Stats"    },
            { id:"archived",  icon:"archive", label:"Arquivo"  },
          ].map(n=>{
            const on = view===n.id;
            return (
              <button key={n.id} className="bottom-nav-btn" onClick={()=>{setView(n.id);setMobileScreen("list");}} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0 6px", gap:4, background:"none", border:"none", cursor:"pointer", color:on?"var(--acc)":"var(--t4)", minHeight:52, position:"relative" }}>
                {on && <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:24, height:2, borderRadius:"0 0 2px 2px", background:"var(--acc)" }}/>}
                <Ic n={n.icon} s={22} c={on?"var(--acc)":"var(--t4)"}/>
                <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:on?600:400, letterSpacing:"0.05em" }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {showNew && <NewProcessModal onClose={()=>setShowNew(false)} onSave={addProcess} isMobile={true}/>}
      {showSetPassword && <SetPasswordModal onClose={()=>setShowSetPassword(false)} onSuccess={clearRecovery}/>}
      {showProfileModal && <ProfileSetupModal onClose={()=>setShowProfileModal(false)} onSave={saveProfile} isMobile={true} initial={profile}/>}
      {showImport && <ImportChatGPTModal onClose={()=>setShowImport(false)} onImport={importProcesses} isMobile={true} isDemo={isDemo}/>}
      {showResumes && <ResumesModal onClose={()=>setShowResumes(false)} isMobile={true} resumes={resumes} onAdd={addResume} onUpdate={updateResume} onDelete={removeResume} loading={resumesLoading}/>}
    </>
  );
}

// Keep backward-compat export for any tests that still import from App.jsx
export { sortProcesses } from "./utils/sort.js";
