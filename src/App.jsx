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
import { useCVAdaptations } from "./hooks/useCVAdaptations.js";

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
import SetPasswordModal from "./components/modals/SetPasswordModal.jsx";
import ProfileSetupModal from "./components/modals/ProfileSetupModal.jsx";
import ResumesModal from "./components/modals/ResumesModal.jsx";
import NewEntryModal from "./components/modals/NewEntryModal.jsx";

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
  const isPWA = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || !!window.navigator.standalone);
  const { dark, toggle: toggleTheme } = useTheme();
  const { session, isRecovery, clearRecovery } = useAuth();
  const [isDemo, setIsDemo] = useState(false);
  const [processes, setProcesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("pipeline");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntryInitialMsg, setNewEntryInitialMsg] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sortBy, setSortBy] = useState("urgencia");
  const [mobileScreen, setMobileScreen] = useState("list");
  const [mobileDetailTab, setMobileDetailTab] = useState("overview");
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const { profile, saveProfile } = useUserProfile();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [showResumes, setShowResumes] = useState(false);
  const { resumes, loading: resumesLoading, add: addResume, update: updateResume, remove: removeResume } = useResumes(session);
  const { adaptation, save: saveAdaptation, refetch: refetchAdaptation } = useCVAdaptations(session, selected?.id);

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

const active = processes.filter(p=>!["rejected","archived"].includes(p.stage));
  const archived = processes.filter(p=>["rejected","archived"].includes(p.stage));
  const listSrc = view==="archived" ? archived : active;
  const filtered = sortProcesses(filterProcesses(listSrc, search, stageFilter), sortBy);
  const urgent = active.filter(p=>{ const d=daysDiff(p.nextStepDate); return d!==null&&d>=0&&d<=2; }).length;

  const EmptyState = () => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:16, padding:"48px 32px", maxWidth:400, margin:"0 auto", textAlign:"center" }}>
      <div style={{ width:52, height:52, borderRadius:14, background:"var(--acc-d)", border:"1px solid var(--acc-b)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Ic n="pipeline" s={22} c="var(--acc)"/>
      </div>
      <div>
        <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:6 }}>Nenhum processo ainda</div>
        <div style={{ fontSize:13, color:"var(--t3)", lineHeight:1.6 }}>Adicione um processo novo para começar a organizar sua busca.</div>
      </div>
      <Btn variant="primary" onClick={()=>setShowNewEntry(true)}>
        <Ic n="plus" s={14} c="#fff"/> Adicionar processo
      </Btn>
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
              <Ic n="pipeline" s={16} c="#fff"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:14, color:"var(--t1)", letterSpacing:"-0.02em", fontFamily:"'Outfit',sans-serif" }}>Interview OS</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginTop:1 }}>Command Center</div>
            </div>
            <div style={{ display:"flex", gap:2 }}>
              <button className="icon-btn" onClick={toggleTheme} style={iconBtn()} title="Alternar tema" aria-label="Alternar tema">
                <Ic n={dark?"sun":"moon"} s={15} c="var(--t3)"/>
              </button>
              <button className="icon-btn" onClick={()=>isDemo?setIsDemo(false):supabase.auth.signOut()} style={iconBtn()} title={isDemo?"Sair do demo":"Sair"} aria-label="Sair"><Ic n="logout" s={15} c="var(--t3)"/></button>
            </div>
          </div>
          <div style={{ padding:"8px" }}>
            {[
              { id:"pipeline",  icon:"pipeline", label:"Pipeline",   count:active.length, urgentCount:urgent },
              { id:"dashboard", icon:"chart",    label:"Dashboard"   },
              { id:"archived",  icon:"archive",  label:"Arquivados", count:archived.length },
            ].map(n=>(
              <button key={n.id} onClick={()=>setView(n.id)} className={`nav-btn${view===n.id?" active":""}`} style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 10px", borderRadius:9, border:"none", marginBottom:2, background:view===n.id?"var(--acc)":"transparent", color:view===n.id?"#EFEFEF":"var(--t2)", cursor:"pointer", fontSize:13, fontWeight:view===n.id?600:500, fontFamily:"'Outfit',sans-serif", transition:"all 0.15s", textAlign:"left" }}>
                <Ic n={n.icon} s={15} c={view===n.id?"#EFEFEF":"var(--t3)"}/>
                <span style={{ flex:1 }}>{n.label}</span>
                {n.urgentCount>0 && <span style={{ padding:"2px 6px", borderRadius:999, background:"var(--red)", color:"#fff", fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{n.urgentCount}</span>}
                {n.count!=null && <span style={{ padding:"2px 7px", borderRadius:999, background:view===n.id?"rgba(255,255,255,0.15)":"var(--bg-s)", color:view===n.id?"#EFEFEF":"var(--t3)", fontSize:11, fontFamily:"'JetBrains Mono',monospace", border:`1px solid ${view===n.id?"rgba(255,255,255,0.2)":"var(--border)"}` }}>{n.count}</span>}
              </button>
            ))}
            <div style={{ borderTop:"1px solid var(--border)", margin:"4px 0" }}/>
            {[
              { label:"Perfil & preferências", icon:"edit",   action:()=>setShowProfileModal(true) },
              { label:"Gerenciar currículos",   icon:"copy",   action:()=>setShowResumes(true) },
              ...(!isDemo ? [{ label:"Definir senha", icon:"star", action:()=>setShowProfileModal(true) }] : []),
            ].map((item,i)=>(
              <button key={i} onClick={item.action} className="nav-btn" style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:9, border:"none", marginBottom:2, background:"transparent", color:"var(--t3)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", transition:"all 0.15s", textAlign:"left" }}
                onMouseEnter={e=>{ e.currentTarget.style.background="var(--bg-o)"; e.currentTarget.style.color="var(--t2)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="var(--t3)"; }}
              >
                <Ic n={item.icon} s={14} c="var(--t4)"/>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div style={{ padding:"4px 8px 6px" }}>
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><Ic n="search" s={13} c="var(--t4)"/></div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." aria-label="Buscar processos" style={{ ...T.input, paddingLeft:32, fontSize:13, borderRadius:9 }}/>
            </div>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-o)", color:"var(--t2)", fontSize:12, fontFamily:"'Outfit',sans-serif", cursor:"pointer", outline:"none", marginTop:6, colorScheme:dark?"dark":"light" }}>
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
            <button className="nav-btn" onClick={()=>setShowNewEntry(true)} style={{ width:"100%", padding:"10px", borderRadius:10, border:"1.5px dashed var(--acc-b)", background:"transparent", color:"var(--acc)", cursor:"pointer", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:600, transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
              <Ic n="plus" s={14} c="var(--acc)"/>
              Novo Processo
            </button>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {dbLoading ? <Spinner/> : view==="dashboard" ? (
            <Dashboard processes={processes}/>
          ) : (
            <div style={{ flex:1, overflowY:"auto" }}>
              {selected
                ? <ProcessDetail process={processes.find(p=>p.id===selected.id)||selected} onUpdate={updateProcess} onDelete={deleteProcess} isMobile={false} profile={profile} onEditProfile={()=>setShowProfileModal(true)} resumes={resumes} onManageResumes={()=>setShowResumes(true)} adaptation={adaptation} onSaveAdaptation={saveAdaptation}/>
                : <EmptyState/>
              }
            </div>
          )}
        </div>
      </div>
      {showNewEntry && <NewEntryModal isMobile={false} initialMsg={newEntryInitialMsg} onClose={()=>{ setShowNewEntry(false); setNewEntryInitialMsg(""); }} onProcessCreated={(p)=>{ addProcess(p); setShowNewEntry(false); setNewEntryInitialMsg(""); setSelected(p); }}/>}
      {showSetPassword && <SetPasswordModal onClose={()=>setShowSetPassword(false)} onSuccess={clearRecovery}/>}
      {showProfileModal && <ProfileSetupModal onClose={()=>setShowProfileModal(false)} onSave={saveProfile} isMobile={false} initial={profile} isDemo={isDemo}/>}
      {showResumes && <ResumesModal onClose={()=>setShowResumes(false)} isMobile={false} resumes={resumes} onAdd={addResume} onUpdate={updateResume} onDelete={removeResume} loading={resumesLoading}/>}
    </>
  );

  // ── Mobile layout ───────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"var(--bg)", overflow:"hidden" }}>
        {/* Mobile header */}
        <div style={{ paddingTop:"max(12px, env(safe-area-inset-top, 12px))", paddingBottom:"10px", paddingLeft:"16px", paddingRight:"16px", borderBottom:"1px solid var(--border)", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          {mobileScreen==="detail" && view!=="dashboard" ? (
            <button onClick={()=>setMobileScreen("list")} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"var(--acc-text)", cursor:"pointer", fontSize:14, fontWeight:600, fontFamily:"'Outfit',sans-serif", padding:0 }}>
              <Ic n="back" s={16} c="var(--acc-text)"/>Voltar
            </button>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:7, background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center" }}><Ic n="pipeline" s={13} c="#fff"/></div>
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
            <button className="icon-btn" onClick={()=>setHamburgerOpen(true)} style={iconBtn({ width:44, height:44, borderRadius:10, border:"1px solid var(--border)", background:"var(--bg-r)" })} aria-label="Menu">
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <rect y="0" width="18" height="2" rx="1" fill="var(--t2)"/>
                <rect y="6" width="14" height="2" rx="1" fill="var(--t2)"/>
                <rect y="12" width="10" height="2" rx="1" fill="var(--t2)"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Hamburger bottom sheet */}
        {hamburgerOpen && (
          <>
            <div onClick={()=>setHamburgerOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:199, backdropFilter:"blur(2px)" }}/>
            <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"var(--bg-r)", borderRadius:"20px 20px 0 0", borderTop:"1px solid var(--border-md)", padding:"20px 16px", paddingBottom:"max(20px, env(safe-area-inset-bottom, 20px))", zIndex:200, animation:"slideUp 0.25s ease" }}>
              <div style={{ width:36, height:4, background:"var(--border-md)", borderRadius:2, margin:"0 auto 20px" }}/>
              {[
                { label: dark?"Tema claro":"Tema escuro", icon:dark?"sun":"moon", action:()=>{ toggleTheme(); setHamburgerOpen(false); } },
                { label:"Perfil & preferências", icon:"edit", action:()=>{ setShowProfileModal(true); setHamburgerOpen(false); } },
                { label:"Gerenciar currículos", icon:"copy", action:()=>{ setShowResumes(true); setHamburgerOpen(false); } },
                { label: isDemo?"Sair do modo demo":"Sair da conta", icon:"logout", action:()=>{ setHamburgerOpen(false); if(isDemo){setIsDemo(false);}else{supabase.auth.signOut();} }, danger:true },
              ].map((item,i)=>(

                <button key={i} onClick={item.action} style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"14px 12px", borderRadius:12, border:"none", background:"transparent", cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontSize:15, fontWeight:500, color: item.danger?"var(--red)":item.accent?"var(--acc-text)":item.linkedinBlue?"#0A66C2":"var(--t1)", textAlign:"left", transition:"background 0.15s", marginBottom:2 }}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--bg-o)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >
                  <div style={{ width:38, height:38, borderRadius:10, background: item.danger?"var(--red-d)":item.accent?"var(--acc-d)":item.linkedinBlue?"rgba(10,102,194,0.1)":"var(--bg-o)", border:`1px solid ${item.danger?"var(--red-b)":item.accent?"var(--acc-b)":item.linkedinBlue?"rgba(10,102,194,0.25)":"var(--border)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Ic n={item.icon} s={17} c={item.danger?"var(--red)":item.accent?"var(--acc)":item.linkedinBlue?"#0A66C2":"var(--t2)"}/>
                  </div>
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {dbLoading && <Spinner/>}

          {!dbLoading && view==="dashboard" && (
            <div style={{ flex:1, overflowY:"auto", paddingBottom:"calc(56px + 16px)" }}><MobileDashboard processes={processes}/></div>
          )}

          {!dbLoading && view!=="dashboard" && mobileScreen==="list" && (
            <div style={{ flex:1, overflowY:"auto", paddingBottom:"calc(56px + 16px)", animation:"slideUp 0.2s ease" }}>
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
                    <div key={p.id} onClick={()=>setStageFilter(p.id)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:`1px solid ${isActive?"var(--acc)":"var(--border)"}`, background:isActive?"var(--acc)":"var(--bg-r)", color:isActive?"#EFEFEF":"var(--t3)", fontSize:12, cursor:"pointer", fontFamily:"'Outfit',sans-serif", whiteSpace:"nowrap", fontWeight:isActive?600:400, transition:"all 0.15s" }}>{p.label}</div>
                  );
                })}
              </div>
              <div style={{ padding:"0 16px 8px" }}>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-o)", color:"var(--t2)", fontSize:12, fontFamily:"'Outfit',sans-serif", cursor:"pointer", outline:"none", colorScheme:dark?"dark":"light" }}>
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
                  <ProcessCard key={p.id} process={p} onClick={()=>{setSelected(p);setMobileDetailTab("overview");setMobileScreen("detail");}} selected={false} isMobile={true} isArchived={view==="archived"} onSwipeAction={view==="archived" ? ()=>deleteProcess(p.id) : ()=>updateProcess({...p,stage:"rejected"})}/>
                ))}
              </div>
            </div>
          )}

          {!dbLoading && view!=="dashboard" && mobileScreen==="detail" && selected && (
            <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", animation:"slideUp 0.22s ease" }}>
              <ProcessDetail process={processes.find(p=>p.id===selected.id)||selected} onUpdate={updateProcess} onDelete={deleteProcess} isMobile={true} isPWA={isPWA} profile={profile} onEditProfile={()=>setShowProfileModal(true)} resumes={resumes} onManageResumes={()=>setShowResumes(true)} initialTab={mobileDetailTab} adaptation={adaptation} onSaveAdaptation={saveAdaptation}/>
            </div>
          )}
        </div>

<div style={{ position:"fixed", bottom:0, left:0, right:0, background:"var(--bg)", borderTop:"1px solid var(--border)", display:"flex", flexShrink:0 }}>
          <button className="bottom-nav-btn" onClick={()=>setShowNewEntry(true)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"10px 0 8px", gap:2, background:"none", border:"none", cursor:"pointer", color:"var(--t1)", minHeight:56, position:"relative" }}>
            <Ic n="plus" s={19} c="var(--t1)"/>
            <span style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:400, letterSpacing:"0.05em" }}>Novo</span>
          </button>
          {[
            { id:"pipeline", icon:"pipeline", label:"Pipeline" },
            { id:"dashboard", icon:"chart",   label:"Stats"    },
            { id:"archived",  icon:"archive", label:"Arquivo"  },
          ].map(n=>{
            const on = view===n.id;
            return (
              <button key={n.id} className="bottom-nav-btn" onClick={()=>{setView(n.id);setMobileScreen("list");}} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"10px 0 8px", gap:2, background:"none", border:"none", cursor:"pointer", color:"var(--t1)", minHeight:56, position:"relative" }}>
                {on && <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:20, height:2, borderRadius:"0 0 2px 2px", background:"var(--acc)" }}/>}
                <Ic n={n.icon} s={19} c="var(--t1)"/>
                <span style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:400, letterSpacing:"0.05em" }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {showNewEntry && <NewEntryModal isMobile={true} initialMsg={newEntryInitialMsg} onClose={()=>{ setShowNewEntry(false); setNewEntryInitialMsg(""); }} onProcessCreated={(p)=>{ addProcess(p); setShowNewEntry(false); setNewEntryInitialMsg(""); setSelected(p); setMobileScreen("detail"); }}/>}
      {showSetPassword && <SetPasswordModal onClose={()=>setShowSetPassword(false)} onSuccess={clearRecovery}/>}
      {showProfileModal && <ProfileSetupModal onClose={()=>setShowProfileModal(false)} onSave={saveProfile} isMobile={true} initial={profile} isDemo={isDemo}/>}
{showResumes && <ResumesModal onClose={()=>setShowResumes(false)} isMobile={true} resumes={resumes} onAdd={addResume} onUpdate={updateResume} onDelete={removeResume} loading={resumesLoading}/>}
    </>
  );
}

// Keep backward-compat export for any tests that still import from App.jsx
export { sortProcesses } from "./utils/sort.js";
