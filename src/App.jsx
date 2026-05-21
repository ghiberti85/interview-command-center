import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, rowToProcess, processToRow } from "./supabase";
import JSZip from "jszip";
// URL do worker resolvida em build-time pelo Vite (necessário para Vercel)
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

// pdfjs é carregado sob demanda para não penalizar o bundle inicial
let _pdfjsLib = null;
async function getPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import("pdfjs-dist");
    _pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  return _pdfjsLib;
}

// ─── Responsive hook ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

// ─── Theme hook ──────────────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("icc-theme") !== "light"; } catch { return true; }
  });
  const toggle = () => setDark(d => {
    const next = !d;
    try { localStorage.setItem("icc-theme", next ? "dark" : "light"); } catch {}
    return next;
  });
  return { dark, toggle };
}

// ─── User profile hook ───────────────────────────────────────────────────────
const PROFILE_KEY = "icc-user-profile";
const DEFAULT_PROFILE = { stack: [], summary: "", cvText: "" };

function useUserProfile() {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch { return DEFAULT_PROFILE; }
  });
  const saveProfile = (p) => {
    setProfile(p);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
  };
  return { profile, saveProfile };
}


const DARK_VARS = {
  "--bg":         "#111113",
  "--bg-r":       "#17171A",
  "--bg-o":       "#1C1C20",
  "--bg-s":       "#222226",
  "--border":     "rgba(255,255,255,0.07)",
  "--border-md":  "rgba(255,255,255,0.12)",
  "--border-str": "rgba(255,255,255,0.18)",
  "--t1":         "#EFEFEF",
  "--t2":         "#9A9AA8",
  "--t3":         "#52525C",
  "--t4":         "#333338",
  "--acc":        "#7C6AFF",
  "--acc-d":      "rgba(124,106,255,0.14)",
  "--acc-b":      "rgba(124,106,255,0.30)",
  "--grn":        "#22C67A",
  "--grn-d":      "rgba(34,198,122,0.12)",
  "--grn-b":      "rgba(34,198,122,0.25)",
  "--amb":        "#F5A623",
  "--amb-d":      "rgba(245,166,35,0.12)",
  "--amb-b":      "rgba(245,166,35,0.25)",
  "--red":        "#FF6A6A",
  "--red-d":      "rgba(255,106,106,0.12)",
  "--red-b":      "rgba(255,106,106,0.25)",
  "--cyan":               "#22D3EE",
  "--cyan-d":             "rgba(34,211,238,0.12)",
  "--cyan-b":             "rgba(34,211,238,0.25)",
  "--date-picker-filter": "invert(1)",
};
const LIGHT_VARS = {
  "--bg":         "#FAFAF9",
  "--bg-r":       "#FFFFFF",
  "--bg-o":       "#F4F4F2",
  "--bg-s":       "#EDEDEB",
  "--border":     "rgba(0,0,0,0.07)",
  "--border-md":  "rgba(0,0,0,0.12)",
  "--border-str": "rgba(0,0,0,0.20)",
  "--t1":         "#111113",
  "--t2":         "#606060",
  "--t3":         "#999990",
  "--t4":         "#C8C8C0",
  "--acc":        "#5B47FF",
  "--acc-d":      "rgba(91,71,255,0.10)",
  "--acc-b":      "rgba(91,71,255,0.25)",
  "--grn":        "#16A05E",
  "--grn-d":      "rgba(22,160,94,0.10)",
  "--grn-b":      "rgba(22,160,94,0.25)",
  "--amb":        "#C07A00",
  "--amb-d":      "rgba(192,122,0,0.10)",
  "--amb-b":      "rgba(192,122,0,0.25)",
  "--red":        "#CC3333",
  "--red-d":      "rgba(204,51,51,0.10)",
  "--red-b":      "rgba(204,51,51,0.25)",
  "--cyan":               "#0891B2",
  "--cyan-d":             "rgba(8,145,178,0.10)",
  "--cyan-b":             "rgba(8,145,178,0.25)",
  "--date-picker-filter": "none",
};

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGE = {
  contacted: { label: "Contactado", bar: "#22D3EE", badgeBg: "var(--cyan-d)", badgeColor: "var(--cyan)", badgeBorder: "var(--cyan-b)" },
  screening: { label: "Conversa",   bar: "#7C6AFF", badgeBg: "var(--acc-d)",  badgeColor: "var(--acc)",  badgeBorder: "var(--acc-b)"  },
  interview: { label: "Entrevista", bar: "#F5A623", badgeBg: "var(--amb-d)",  badgeColor: "var(--amb)",  badgeBorder: "var(--amb-b)"  },
  technical: { label: "Técnica",    bar: "#A78BFA", badgeBg: "rgba(167,139,250,0.12)", badgeColor: "#A78BFA", badgeBorder: "rgba(167,139,250,0.25)" },
  offer:     { label: "Proposta",   bar: "#22C67A", badgeBg: "var(--grn-d)",  badgeColor: "var(--grn)",  badgeBorder: "var(--grn-b)"  },
  rejected:  { label: "Encerrado",  bar: "#FF6A6A", badgeBg: "var(--red-d)",  badgeColor: "var(--red)",  badgeBorder: "var(--red-b)"  },
  archived:  { label: "Arquivado",  bar: "var(--t3)", badgeBg: "var(--bg-s)", badgeColor: "var(--t3)",   badgeBorder: "var(--border)" },
};
const ACTIVE_STAGES = ["contacted","screening","interview","technical","offer"];

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}) : "—";
const daysDiff = d => d ? Math.ceil((new Date(d + "T12:00:00") - new Date()) / 86400000) : null;

// ─── Sort ─────────────────────────────────────────────────────────────────────
const STAGE_ORDER = { contacted:0, screening:1, interview:2, technical:3, offer:4, rejected:5, archived:6 };
export function sortProcesses(list, sortBy) {
  const arr = [...list];
  if (sortBy === "urgencia") {
    return arr.sort((a, b) => {
      const da = a.nextStepDate ? new Date(a.nextStepDate + "T12:00:00").getTime() : Infinity;
      const db = b.nextStepDate ? new Date(b.nextStepDate + "T12:00:00").getTime() : Infinity;
      return da - db;
    });
  }
  if (sortBy === "empresa") {
    return arr.sort((a, b) => a.company.toLowerCase().localeCompare(b.company.toLowerCase(), "pt-BR"));
  }
  if (sortBy === "stage") {
    return arr.sort((a, b) => (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99));
  }
  if (sortBy === "recente") {
    return arr.sort((a, b) => {
      const da = a.contactedDate ? new Date(a.contactedDate + "T12:00:00").getTime() : 0;
      const db = b.contactedDate ? new Date(b.contactedDate + "T12:00:00").getTime() : 0;
      return db - da;
    });
  }
  return arr;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Ic = ({ n, s=16, c="currentColor" }) => {
  const P = {
    target:   <><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="6" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="2" fill={c}/></>,
    pipeline: <><rect x="3" y="3" width="6" height="18" rx="1.5" stroke={c} strokeWidth="1.5" fill="none"/><rect x="12" y="7" width="9" height="14" rx="1.5" stroke={c} strokeWidth="1.5" fill="none"/></>,
    chart:    <><path d="M3 3v18h18" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M7 16l4-6 4 3 4-8" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    archive:  <><rect x="2" y="4" width="20" height="4" rx="1" stroke={c} strokeWidth="1.5" fill="none"/><path d="M4 8v11a1 1 0 001 1h14a1 1 0 001-1V8" stroke={c} strokeWidth="1.5"/><path d="M10 13h4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    plus:     <><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    search:   <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" fill="none"/><path d="M21 21l-4.35-4.35" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    back:     <><path d="M19 12H5M12 5l-7 7 7 7" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    star:     <><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round"/></>,
    starF:    <><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={c} strokeWidth="1.5" fill={c} strokeLinejoin="round"/></>,
    edit:     <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    close:    <><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    trash:    <><polyline points="3 6 5 6 21 6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke={c} strokeWidth="1.5"/><path d="M10 11v6M14 11v6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke={c} strokeWidth="1.5"/></>,
    cal:      <><rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><path d="M16 2v4M8 2v4M3 10h18" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    alert:    <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.5" fill="none"/><path d="M12 9v4M12 17v.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    copy:     <><rect x="9" y="9" width="13" height="13" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke={c} strokeWidth="1.5" fill="none"/></>,
    check:    <><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    refresh:  <><path d="M4 4v5h5M20 20v-5h-5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4.93 9A8 8 0 1119 14.07" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    send:     <><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    msg:      <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={c} strokeWidth="1.5" fill="none"/></>,
    ai:       <><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.5" fill="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    sun:      <><circle cx="12" cy="12" r="5" stroke={c} strokeWidth="1.5" fill="none"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M17.66 6.34l1.41-1.41M4.93 19.07l1.41-1.41" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    moon:     <><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={c} strokeWidth="1.5" fill="none"/></>,
    linkedin: <><rect x="2" y="2" width="20" height="20" rx="4" stroke={c} strokeWidth="1.5" fill="none"/><path d="M7 10v7M7 7v.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M11 17v-4a2 2 0 014 0v4M11 10v7" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    email:    <><rect x="3" y="5" width="18" height="14" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><path d="M3 7l9 6 9-6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    whatsapp: <><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke={c} strokeWidth="1.5" fill="none"/><path d="M8.5 8.5s1 2 2 3 3 2 3 2l1.5-1.5s.5-.5 1 0l1.5 1.5s.5.5 0 1L16 16s-1 1-3-1-4-4-5-6l1.5-1.5s.5-.5 0-1L8 7s-.5-.5-.5 0l1 1.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    info:     <><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.5" fill="none"/><path d="M12 8v.5M12 11v5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    logout:   <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>{P[n]||null}</svg>;
};

// ─── DS primitives ────────────────────────────────────────────────────────────
const T = {
  label: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)" },
  mono:  { fontFamily:"'JetBrains Mono',monospace" },
  card:  { background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, transition:"border-color 0.15s" },
  input: { width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-o)", color:"var(--t1)", fontSize:14, outline:"none", fontFamily:"'Outfit',sans-serif", transition:"border-color 0.15s, box-shadow 0.15s" },
};

// Shared icon-button style — 36×36, meets touch target with padding
const iconBtn = (extra={}) => ({ display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:8, border:"none", background:"transparent", cursor:"pointer", transition:"background 0.15s", flexShrink:0, ...extra });

function Badge({ stage }) {
  const s = STAGE[stage] || STAGE.archived;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:10, fontWeight:600, background:s.badgeBg, color:s.badgeColor, border:`1px solid ${s.badgeBorder}`, whiteSpace:"nowrap" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.badgeColor, flexShrink:0 }}/>
      {s.label}
    </span>
  );
}

function Btn({ children, variant="primary", size="md", full, onClick, disabled, style={} }) {
  const [hov, setHov] = useState(false);
  const base = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, borderRadius:10, fontFamily:"'Outfit',sans-serif", fontWeight:600, cursor:disabled?"not-allowed":"pointer", border:"none", transition:"all 0.15s", letterSpacing:"-0.01em", opacity:disabled?0.5:1, ...style };
  const sizes = { sm:{padding:"6px 14px",fontSize:12,borderRadius:8}, md:{padding:"10px 20px",fontSize:13}, lg:{padding:"13px 24px",fontSize:14,borderRadius:12} };
  const variants = {
    primary:   { background: hov&&!disabled ? "var(--acc)" : "var(--acc)", color:"#fff", filter: hov&&!disabled ? "brightness(1.12)" : "none" },
    secondary: { background: hov&&!disabled ? "var(--acc-d)" : "transparent", color:"var(--acc)", border:"1px solid var(--acc-b)" },
    ghost:     { background: hov&&!disabled ? "var(--bg-s)" : "transparent", color:"var(--t2)", border:"1px solid var(--border)" },
    danger:    { background: hov&&!disabled ? "var(--red-d)" : "transparent", color:"var(--red)", border:"1px solid var(--red-b)" },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...(full?{width:"100%"}:{}) }}>
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", gap:16, padding:40 }}>
      <div style={{ width:36, height:36, borderRadius:"50%", border:"2px solid var(--border)", borderTopColor:"var(--acc)", animation:"spin 0.7s linear infinite" }}/>
      <div style={{ fontSize:13, color:"var(--t3)", fontFamily:"'JetBrains Mono',monospace" }}>carregando...</div>
    </div>
  );
}

// ─── Auth hook ───────────────────────────────────────────────────────────────
function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [isRecovery, setIsRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => setSession(error ? null : (data?.session ?? null)))
      .catch(() => setSession(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      setSession(s ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return { session, isRecovery, clearRecovery: () => setIsRecovery(false) };
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_PROCESSES = [
  { id:"demo1", company:"Nubank", role:"Senior Front-End Engineer", stage:"interview", location:"Remoto", salary:"R$ 22.000 – 28.000", recruiter:"Ana Paula Costa", recruiterEmail:"ana.costa@nubank.com.br", origin:"inbound", contactedDate:"2026-05-01", nextStepDate:"2026-05-22", nextStepNote:"Entrevista técnica com o time de plataforma", jobUrl:"", tags:["fintech","react","typescript"], notes:"Vaga para o time de design system. Stack: React, TypeScript, Storybook.", steps:[{date:"2026-05-01",type:"contacted",note:"Contato via LinkedIn"},{date:"2026-05-08",type:"screening",note:"Conversa com recruiter — 30min"},{date:"2026-05-15",type:"interview",note:"Entrevista com o gestor de engenharia"}], aiContext:"", starred:true, channel:"linkedin" },
  { id:"demo2", company:"Mercado Livre", role:"Front-End Tech Lead", stage:"screening", location:"São Paulo (híbrido)", salary:"R$ 30.000 – 38.000", recruiter:"Carlos Mendes", recruiterEmail:"carlos@meli.com", origin:"inbound", contactedDate:"2026-05-05", nextStepDate:"2026-05-23", nextStepNote:"Ligação de alinhamento com Head de Eng", jobUrl:"", tags:["lead","react","scale"], notes:"Liderança de time de 8 pessoas. Foco em performance e micro-frontends.", steps:[{date:"2026-05-05",type:"contacted",note:"Mensagem pelo LinkedIn"},{date:"2026-05-12",type:"screening",note:"Entrevista de fit cultural"}], aiContext:"", starred:false, channel:"linkedin" },
  { id:"demo3", company:"Itaú Unibanco", role:"Especialista UI/UX Engineering", stage:"technical", location:"São Paulo (presencial)", salary:"R$ 18.000 – 22.000", recruiter:"Fernanda Lima", recruiterEmail:"fernanda.lima@itau.com.br", origin:"inbound", contactedDate:"2026-04-20", nextStepDate:"2026-05-21", nextStepNote:"Apresentação do case técnico", jobUrl:"", tags:["banco","next.js","design-system"], notes:"Case: construir componente de input com validação e acessibilidade.", steps:[{date:"2026-04-20",type:"contacted",note:"Indicação interna"},{date:"2026-04-28",type:"screening",note:"Triagem com RH"},{date:"2026-05-10",type:"interview",note:"Entrevista comportamental"},{date:"2026-05-18",type:"technical",note:"Recebeu o case técnico"}], aiContext:"", starred:true, channel:"indicacao" },
  { id:"demo4", company:"Spotify", role:"Senior Software Engineer — Web", stage:"offer", location:"Remoto (global)", salary:"USD 140k – 160k", recruiter:"James Harrington", recruiterEmail:"j.harrington@spotify.com", origin:"outbound", contactedDate:"2026-04-10", nextStepDate:"2026-05-25", nextStepNote:"Prazo para aceitar ou recusar a proposta", jobUrl:"", tags:["global","typescript","streaming"], notes:"Proposta formal recebida. Equity + RSU incluídos. Analisar junto ao advogado.", steps:[{date:"2026-04-10",type:"contacted",note:"Aplicação direta no site"},{date:"2026-04-18",type:"screening",note:"Recruiter screen"},{date:"2026-04-28",type:"interview",note:"System design interview"},{date:"2026-05-08",type:"technical",note:"Coding challenge — 4h"},{date:"2026-05-15",type:"offer",note:"Proposta recebida por e-mail"}], aiContext:"", starred:true, channel:"" },
  { id:"demo5", company:"Stone", role:"Front-End Engineer", stage:"rejected", location:"Rio de Janeiro (híbrido)", salary:"R$ 15.000 – 18.000", recruiter:"Mariana Souza", recruiterEmail:"mariana@stone.com.br", origin:"inbound", contactedDate:"2026-04-05", nextStepDate:null, nextStepNote:"", jobUrl:"", tags:["fintech","vue"], notes:"Feedack: buscavam experiência com Vue. Recontato possível no futuro.", steps:[{date:"2026-04-05",type:"contacted",note:"Contato via LinkedIn"},{date:"2026-04-12",type:"screening",note:"Triagem técnica"},{date:"2026-04-22",type:"rejected",note:"Feedack recebido por e-mail"}], aiContext:"", starred:false, channel:"email" },
  { id:"demo6", company:"Creditas", role:"Senior React Developer", stage:"contacted", location:"Remoto", salary:"R$ 16.000 – 20.000", recruiter:"Roberto Alves", recruiterEmail:"roberto.alves@creditas.com", origin:"inbound", contactedDate:"2026-05-18", nextStepDate:"2026-05-27", nextStepNote:"Aguardando retorno para agendar conversa inicial", jobUrl:"", tags:["fintech","react","node"], notes:"Primeiro contato recebido hoje. Vaga para o time de crédito.", steps:[{date:"2026-05-18",type:"contacted",note:"Mensagem no LinkedIn"}], aiContext:"", starred:false, channel:"whatsapp" },
];

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onDemo }) {
  const [mode, setMode] = useState("password"); // "password" | "magic" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inputFocus = e => { e.target.style.borderColor="var(--acc)"; e.target.style.boxShadow="0 0 0 3px var(--acc-d)"; };
  const inputBlur  = e => { e.target.style.borderColor="var(--border)"; e.target.style.boxShadow="none"; };
  const switchMode = m => { setMode(m); setError(null); setSent(false); };

  async function handlePassword(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
  }

  async function handleMagicLink(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  async function handleForgot(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  const Logo = () => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:32 }}>
      <div style={{ width:52, height:52, borderRadius:15, background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
        <Ic n="target" s={24} c="#fff"/>
      </div>
      <div style={{ fontWeight:800, fontSize:22, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>Interview OS</div>
      <div style={{ fontSize:11, color:"var(--t3)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:4 }}>Command Center</div>
    </div>
  );

  const ErrorBox = () => error ? (
    <div style={{ padding:"8px 12px", borderRadius:8, background:"var(--red-d)", border:"1px solid var(--red-b)", color:"var(--red)", fontSize:12, marginBottom:14 }}>{error}</div>
  ) : null;

  const SentBox = ({ title, subtitle }) => (
    <div style={{ textAlign:"center", padding:"8px 0" }}>
      <div style={{ width:44, height:44, borderRadius:12, background:"var(--grn-d)", border:"1px solid var(--grn-b)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
        <Ic n="send" s={20} c="var(--grn)"/>
      </div>
      <div style={{ fontWeight:700, fontSize:16, color:"var(--t1)", marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.6 }}>{subtitle} <strong style={{ color:"var(--t1)" }}>{email}</strong></div>
      <button onClick={()=>switchMode("password")} style={{ marginTop:20, background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
        Voltar ao login
      </button>
    </div>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"var(--bg)", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380, animation:"fadeIn 0.3s ease" }}>
        <Logo/>
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:16, padding:28 }}>
          {sent && mode === "magic" && <SentBox title="Link enviado!" subtitle="Verifique seu e-mail em"/>}
          {sent && mode === "forgot" && <SentBox title="E-mail enviado!" subtitle="Verifique as instruções de recuperação em"/>}

          {!sent && mode === "password" && (
            <form onSubmit={handlePassword}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>Entrar</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>Use seu e-mail e senha para acessar.</div>
              <div style={{ marginBottom:12 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>E-mail</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <div style={{ marginBottom:6 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>Senha</label>
                <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <div style={{ textAlign:"right", marginBottom:16 }}>
                <button type="button" onClick={()=>switchMode("forgot")} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11, fontFamily:"'Outfit',sans-serif" }}>
                  Esqueci minha senha
                </button>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim() || !password}>
                {loading ? "Entrando…" : "Entrar"}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={()=>switchMode("magic")} style={{ background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  Entrar sem senha (link mágico)
                </button>
              </div>
            </form>
          )}

          {!sent && mode === "magic" && (
            <form onSubmit={handleMagicLink}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>Link mágico</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>Receba um link de acesso no seu e-mail.</div>
              <div style={{ marginBottom:16 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>E-mail</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim()}>
                {loading ? "Enviando…" : <><Ic n="send" s={14} c="#fff"/>Enviar link</>}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={()=>switchMode("password")} style={{ background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  Voltar ao login com senha
                </button>
              </div>
            </form>
          )}

          {!sent && mode === "forgot" && (
            <form onSubmit={handleForgot}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>Recuperar senha</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>Enviaremos um link para você criar uma nova senha.</div>
              <div style={{ marginBottom:16 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>E-mail</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim()}>
                {loading ? "Enviando…" : <><Ic n="send" s={14} c="#fff"/>Enviar e-mail de recuperação</>}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={()=>switchMode("password")} style={{ background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  Voltar ao login
                </button>
              </div>
            </form>
          )}
        </div>

        <button onClick={onDemo} style={{ width:"100%", marginTop:12, padding:"12px", borderRadius:12, border:"1px dashed var(--border)", background:"transparent", color:"var(--t2)", cursor:"pointer", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:500, transition:"all 0.15s" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-md)";e.currentTarget.style.color="var(--t1)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--t2)";}}
        >
          Ver demonstração sem cadastro →
        </button>
      </div>
    </div>
  );
}

// ─── AI call ──────────────────────────────────────────────────────────────────
const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;
if (!AI_PROXY_URL) console.error("[ICC] VITE_AI_PROXY_URL não configurada — chamadas de IA vão falhar.");

async function callAI(messages, system, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system, messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const d = await res.json();
  return d.content?.find(b=>b.type==="text")?.text || "Erro.";
}

// ─── Channel & scenario config ─────────────────────────────────────────────────
const CHANNELS = {
  linkedin: { label:"LinkedIn", icon:"linkedin", color:"#0A66C2", accent:"#378FE9", bg:"rgba(10,102,194,0.12)", border:"rgba(10,102,194,0.3)", hint:"Tom profissional e direto. Máximo 3 parágrafos curtos." },
  email:    { label:"E-mail",   icon:"email",    color:"#6366F1", accent:"#A5B4FC", bg:"rgba(99,102,241,0.12)", border:"rgba(99,102,241,0.3)", hint:"Tom formal mas caloroso. Inclui assunto, saudação e despedida." },
  whatsapp: { label:"WhatsApp", icon:"whatsapp", color:"#25D366", accent:"#4AE07A", bg:"rgba(37,211,102,0.12)", border:"rgba(37,211,102,0.3)", hint:"Tom leve e conversacional. Curto, sem formalidades." },
};
const SCENARIOS = [
  { id:"reply_recruiter",   label:"Responder contato inicial" },
  { id:"confirm_interest",  label:"Confirmar interesse"       },
  { id:"schedule_first",    label:"Agendar primeira conversa" },
  { id:"confirm_interview", label:"Confirmar entrevista"      },
  { id:"reschedule",        label:"Remarcar horário"          },
  { id:"post_interview",    label:"Follow-up pós-entrevista"  },
  { id:"ask_feedback",      label:"Pedir feedback"            },
  { id:"negotiate_offer",   label:"Negociar proposta"         },
  { id:"accept_offer",      label:"Aceitar proposta"          },
  { id:"decline_offer",     label:"Declinar proposta"         },
];

// ══════════════════════════════════════════════════════════════
//  COMPONENTS
// ══════════════════════════════════════════════════════════════

const CHANNEL_ICONS = { linkedin:"linkedin", email:"email", whatsapp:"whatsapp", indicacao:"star" };

function ProcessCard({ process, onClick, selected, onSwipeAction, isMobile }) {
  const s = STAGE[process.stage] || STAGE.archived;
  const diff = daysDiff(process.nextStepDate);
  const urgent = diff !== null && diff >= 0 && diff <= 2;
  const touchStartX = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    if (dx > 0) setSwipeOffset(Math.min(dx, 110));
  };
  const handleTouchEnd = () => {
    if (swipeOffset >= 80 && onSwipeAction) onSwipeAction();
    setSwipeOffset(0);
    touchStartX.current = null;
  };

  return (
    <div style={{ position:"relative", marginBottom:6, borderRadius:12, overflow:"hidden" }}>
      {isMobile && onSwipeAction && (
        <div style={{ position:"absolute", inset:0, background:"var(--red)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:20 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <Ic n="close" s={18} c="#fff"/>
            <span style={{ fontSize:10, color:"#fff", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em", textTransform:"uppercase" }}>Encerrar</span>
          </div>
        </div>
      )}
    <div
      className="process-card"
      onClick={onClick}
      onTouchStart={isMobile&&onSwipeAction?handleTouchStart:undefined}
      onTouchMove={isMobile&&onSwipeAction?handleTouchMove:undefined}
      onTouchEnd={isMobile&&onSwipeAction?handleTouchEnd:undefined}
      style={{ background:"var(--bg-r)", border:`1.5px solid ${selected?"var(--acc-b)":"var(--border)"}`, borderLeft:`3px solid ${s.bar}`, borderRadius:12, padding:"12px 14px", cursor:"pointer", transform:`translateX(-${swipeOffset}px)`, transition:swipeOffset===0?"transform 0.2s":"none", position:"relative" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontWeight:700, fontSize:14, color:"var(--t1)", letterSpacing:"-0.02em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{process.company}</span>
            {process.starred && <Ic n="starF" s={12} c="#F5A623"/>}
            {process.channel && CHANNEL_ICONS[process.channel] && (
              <Ic n={CHANNEL_ICONS[process.channel]} s={11} c="var(--t3)"/>
            )}
          </div>
          <div style={{ fontSize:12, color:"var(--t2)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{process.role}</div>
        </div>
        <Badge stage={process.stage}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8, gap:8 }}>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", minWidth:0 }}>
          {process.tags.slice(0,2).map(t=>(
            <span key={t} style={{ padding:"2px 7px", borderRadius:6, background:"var(--bg-s)", color:"var(--t3)", fontSize:10, ...T.mono, whiteSpace:"nowrap" }}>{t}</span>
          ))}
        </div>
        {process.nextStepDate && (
          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:7, background:urgent?"var(--red-d)":"var(--bg-s)", border:`1px solid ${urgent?"var(--red-b)":"var(--border)"}`, flexShrink:0 }}>
            <Ic n={urgent?"alert":"cal"} s={10} c={urgent?"var(--red)":"var(--t3)"}/>
            <span style={{ fontSize:10, color:urgent?"var(--red)":"var(--t3)", ...T.mono }}>
              {fmtDate(process.nextStepDate)}{diff!==null&&` · ${diff===0?"hoje":diff<0?`${Math.abs(diff)}d atrás`:`em ${diff}d`}`}
            </span>
          </div>
        )}
      </div>
      {process.nextStepNote && (
        <div style={{ marginTop:8, fontSize:11, color:"var(--t3)", borderTop:"1px solid var(--border)", paddingTop:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{process.nextStepNote}</div>
      )}
    </div>
    </div>
  );
}

function PipelineBar({ stage, onStageClick }) {
  const idx = ACTIVE_STAGES.indexOf(stage);
  return (
    <div>
      <div style={{ display:"flex", gap:3, marginBottom:4 }}>
        {ACTIVE_STAGES.map((s,i) => {
          const done = i < idx, current = i === idx;
          const bar = STAGE[s]?.bar||"var(--t4)";
          return <div key={s} onClick={()=>onStageClick(s)} title={STAGE[s]?.label} style={{ flex:1, height:4, borderRadius:2, background:done||current?bar:"var(--bg-s)", boxShadow:current?`0 0 6px ${bar}80`:"none", cursor:"pointer", transition:"all 0.15s" }}/>;
        })}
      </div>
      <div style={{ display:"flex", gap:3 }}>
        {ACTIVE_STAGES.map((s,i) => {
          const done = i < idx, current = i === idx;
          const bar = STAGE[s]?.bar||"var(--t4)";
          return <div key={s} onClick={()=>onStageClick(s)} style={{ flex:1, textAlign:"center", ...T.label, fontSize:9, color:done||current?bar:"var(--t4)", cursor:"pointer", transition:"color 0.15s" }}>{STAGE[s]?.label}</div>;
        })}
      </div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", gap:2, padding:4, background:"var(--bg-o)", borderRadius:12, border:"1px solid var(--border)", overflowX:"auto", scrollbarWidth:"none" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={()=>onChange(t.id)} className="tab-btn" style={{ flex:1, padding:"9px 12px", borderRadius:9, border:"none", background:active===t.id?"var(--bg-r)":"transparent", color:active===t.id?"var(--t1)":"var(--t3)", fontSize:13, fontWeight:active===t.id?600:400, fontFamily:"'Outfit',sans-serif", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s", boxShadow:active===t.id?"0 1px 4px rgba(0,0,0,0.12)":"none" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const CONTACT_CHANNELS = [
  { value:"linkedin",  label:"LinkedIn",  icon:"linkedin" },
  { value:"email",     label:"E-mail",    icon:"email"    },
  { value:"whatsapp",  label:"WhatsApp",  icon:"whatsapp" },
  { value:"indicacao", label:"Indicação", icon:"star"     },
];

function InlineTags({ process, onUpdate }) {
  const [newTag, setNewTag] = useState("");
  const addTag = () => {
    const t = newTag.trim();
    if (!t || (process.tags||[]).includes(t)) { setNewTag(""); return; }
    onUpdate({ ...process, tags: [...(process.tags||[]), t] });
    setNewTag("");
  };
  const removeTag = (tag) => onUpdate({ ...process, tags: (process.tags||[]).filter(t => t !== tag) });
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
      {(process.tags||[]).map(t => (
        <span key={t} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px 3px 10px", borderRadius:6, background:"var(--bg-s)", border:"1px solid var(--border)", color:"var(--t3)", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
          {t}
          <button onClick={()=>removeTag(t)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", lineHeight:1 }}>
            <Ic n="close" s={10} c="var(--t4)"/>
          </button>
        </span>
      ))}
      <input
        value={newTag}
        onChange={e=>setNewTag(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();addTag();} }}
        onBlur={addTag}
        placeholder="+ tag"
        style={{ padding:"3px 8px", borderRadius:6, border:"1px dashed var(--border-md)", background:"transparent", color:"var(--t2)", fontSize:12, fontFamily:"'JetBrains Mono',monospace", outline:"none", width:60, minWidth:0 }}
      />
    </div>
  );
}

function OverviewTab({ process, onUpdate, onDelete }) {
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

function TimelineTab({ process, onUpdate }) {
  const [type, setType] = useState("interview");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const addStep = () => {
    if (!note.trim()) return;
    onUpdate({ ...process, steps:[...process.steps,{date,type,note}] });
    setNote("");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ position:"relative", paddingLeft:22 }}>
        <div style={{ position:"absolute", left:5, top:8, bottom:8, width:1, background:"var(--border)" }}/>
        {[...process.steps].reverse().map((s,i)=>{
          const st = STAGE[s.type]||STAGE.archived;
          return (
            <div key={i} style={{ position:"relative", marginBottom:18 }}>
              <div style={{ position:"absolute", left:-17, top:2, width:10, height:10, borderRadius:"50%", background:st.bar, border:"2px solid var(--bg)", boxShadow:`0 0 5px ${st.bar}60` }}/>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:10, color:"var(--t3)", ...T.mono, paddingTop:1, whiteSpace:"nowrap" }}>{fmtDate(s.date)}</span>
                <div>
                  <Badge stage={s.type}/>
                  <div style={{ fontSize:12, color:"var(--t2)", marginTop:4, lineHeight:1.5 }}>{s.note}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding:14, background:"var(--bg-o)", borderRadius:10, border:"1px solid var(--border)" }}>
        <div style={{ ...T.label, marginBottom:10 }}>Adicionar evento</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          <select value={type} onChange={e=>setType(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-r)", color:"var(--t1)", fontSize:12, outline:"none", fontFamily:"'Outfit',sans-serif" }}>
            {Object.entries(STAGE).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-r)", color:"var(--t1)", fontSize:12, outline:"none" }}/>
          <input value={note} onChange={e=>setNote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addStep()} placeholder="Descreva o evento..." style={{ flex:1, minWidth:140, ...T.input, padding:"8px 10px", fontSize:12 }}/>
          <Btn onClick={addStep} size="sm"><Ic n="plus" s={13} c="#fff"/></Btn>
        </div>
      </div>
    </div>
  );
}

function MessagesTab({ process, isMobile }) {
  const [channel, setChannel] = useState("linkedin");
  const [scenario, setScenario] = useState("reply_recruiter");
  const [recruiterMsg, setRecruiterMsg] = useState("");
  const [extraCtx, setExtraCtx] = useState(false);
  const [extraVal, setExtraVal] = useState("");
  const [generated, setGenerated] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSub, setCopiedSub] = useState(false);

  const ch = CHANNELS[channel];
  const scenLabel = SCENARIOS.find(s=>s.id===scenario)?.label||scenario;
  const canGen = scenario!=="reply_recruiter" || recruiterMsg.trim().length>0;

  const buildPrompt = () => `Você é um assistente especializado em comunicação profissional para processos seletivos de tecnologia.
Candidato: Fernando, Senior Full-Stack Engineer / Front-End Tech Lead (React, Next.js, Node.js, TypeScript, Supabase, liderança técnica).
Contexto: ${process.origin==="outbound"?"Fernando se candidatou ativamente para esta vaga.":"Fernando foi contactado pelo recrutador — ele não aplica ativamente."}
Empresa: ${process.company} | Cargo: ${process.role} | Etapa: ${STAGE[process.stage]?.label} | Recrutador(a): ${process.recruiter||"—"} | Salário: ${process.salary||"—"}
${recruiterMsg?`\nMensagem do recrutador:\n"""${recruiterMsg}"""\n`:""}Canal: ${ch.label} | Tom: ${ch.hint} | Objetivo: ${scenLabel}${extraVal?`\nContexto extra: ${extraVal}`:""}
${channel==="email"?`Responda EXATAMENTE neste JSON (sem markdown):\n{"subject":"assunto","body":"corpo completo"}`:`Responda EXATAMENTE neste JSON (sem markdown):\n{"body":"mensagem completa"}`}
A resposta deve soar natural e humana. Não mencione IA. Em português.`;

  const generate = async () => {
    setLoading(true); setGenerated(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const raw = await callAI([{role:"user",content:buildPrompt()}], undefined, s?.access_token);
      const parsed = JSON.parse(raw.replace(/```json|```/g,"").trim());
      const entry = {...parsed, channel, scenario:scenLabel, recruiterMsg, ts:Date.now()};
      setGenerated(entry);
      setHistory(prev=>[entry,...prev].slice(0,20));
    } catch { setGenerated({body:"Erro ao gerar. Tente novamente.",channel,scenario:scenLabel,ts:Date.now()}); }
    setLoading(false);
  };

  const copy = async (text, setter) => { await navigator.clipboard.writeText(text); setter(true); setTimeout(()=>setter(false),2000); };

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:16, padding:"20px 20px 24px" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
            <Ic n="msg" s={12} c="var(--acc)"/>
            <span style={{ ...T.label, color:"var(--t2)" }}>Mensagem do recrutador</span>
            <span style={{ fontSize:10, color:"var(--t4)", ...T.mono, marginLeft:2 }}>(opcional)</span>
          </div>
          <textarea value={recruiterMsg} onChange={e=>setRecruiterMsg(e.target.value)} placeholder="Cole aqui a mensagem exata recebida — a IA vai analisar e gerar a melhor resposta..." rows={4} style={{ ...T.input, resize:"vertical", lineHeight:1.6, borderColor:recruiterMsg?"var(--acc-b)":"var(--border)", background:recruiterMsg?"rgba(124,106,255,0.04)":"var(--bg-o)" }}/>
          {recruiterMsg && (
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:5 }}>
              <Ic n="check" s={11} c="var(--grn)"/>
              <span style={{ fontSize:11, color:"var(--grn)", ...T.mono }}>{recruiterMsg.split(/\s+/).filter(Boolean).length} palavras capturadas</span>
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:14, flexWrap:isMobile?"wrap":"nowrap" }}>
          <div style={{ flex:1, minWidth:isMobile?"100%":0 }}>
            <div style={{ ...T.label, marginBottom:8 }}>Canal</div>
            <div style={{ display:"flex", gap:6 }}>
              {Object.entries(CHANNELS).map(([k,cfg])=>(
                <button key={k} onClick={()=>setChannel(k)} style={{ flex:1, padding:"10px 6px", borderRadius:10, cursor:"pointer", border:`1px solid ${channel===k?cfg.border:"var(--border)"}`, background:channel===k?cfg.bg:"var(--bg-o)", color:channel===k?cfg.accent:"var(--t3)", transition:"all 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                  <Ic n={cfg.icon} s={17} c={channel===k?cfg.accent:"var(--t3)"}/>
                  <span style={{ fontSize:11, fontWeight:channel===k?700:400, fontFamily:"'Outfit',sans-serif" }}>{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex:2, minWidth:isMobile?"100%":0 }}>
            <div style={{ ...T.label, marginBottom:8 }}>Objetivo</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
              {SCENARIOS.map(s=>(
                <button key={s.id} onClick={()=>setScenario(s.id)} style={{ padding:"7px 10px", borderRadius:8, cursor:"pointer", textAlign:"left", border:`1px solid ${scenario===s.id?"var(--acc-b)":"var(--border)"}`, background:scenario===s.id?"var(--acc-d)":"var(--bg-o)", color:scenario===s.id?"var(--acc)":"var(--t2)", fontSize:12, fontFamily:"'Outfit',sans-serif", transition:"all 0.15s" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <button onClick={()=>setExtraCtx(o=>!o)} style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", color:extraCtx?"var(--acc)":"var(--t3)", fontSize:11, ...T.mono, padding:0, marginBottom:extraCtx?8:0, transition:"color 0.15s" }}>
            <Ic n="info" s={12} c={extraCtx?"var(--acc)":"var(--t3)"}/>Contexto adicional {extraCtx?"▲":"▼"}
          </button>
          {extraCtx && <textarea value={extraVal} onChange={e=>setExtraVal(e.target.value)} rows={2} placeholder="Ex: a entrevista foi ótima — ou — preciso remarcar para depois das 18h" style={{ ...T.input, resize:"vertical" }}/>}
        </div>
        <button onClick={generate} disabled={loading||!canGen} style={{ padding:13, borderRadius:12, border:`1px solid ${!canGen?"var(--border)":ch.border}`, background:loading?"var(--bg-o)":!canGen?"var(--bg-o)":ch.bg, color:loading?"var(--t3)":!canGen?"var(--t4)":ch.accent, cursor:loading||!canGen?"not-allowed":"pointer", fontSize:14, fontWeight:700, fontFamily:"'Outfit',sans-serif", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          {loading
            ? <><div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:"var(--t3)",animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>Gerando resposta...</>
            : <><Ic n={ch.icon} s={16} c={!canGen?"var(--t4)":ch.accent}/>{canGen?`Gerar resposta para ${ch.label}`:"Cole a mensagem ou escolha um objetivo"}</>
          }
        </button>
        {!generated && !loading && (
          <div style={{ padding:"28px 20px", borderRadius:12, border:"1px dashed var(--border)", background:"var(--bg-o)", textAlign:"center" }}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:10, opacity:0.25 }}><Ic n="send" s={26} c="var(--t2)"/></div>
            <div style={{ fontSize:13, color:"var(--t3)", lineHeight:1.65 }}>Cole a mensagem do recrutador<br/>e clique em <strong style={{color:"var(--t2)"}}>Gerar resposta</strong></div>
          </div>
        )}
        {generated && (
          <div style={{ borderRadius:12, border:`1px solid ${CHANNELS[generated.channel]?.border||"var(--border)"}`, background:"var(--bg-r)", overflow:"hidden", animation:"fadeIn 0.25s ease" }}>
            <div style={{ padding:"10px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <Ic n={CHANNELS[generated.channel]?.icon||"msg"} s={13} c={CHANNELS[generated.channel]?.accent||"var(--t2)"}/>
                <span style={{ fontSize:11, color:CHANNELS[generated.channel]?.accent, ...T.mono, fontWeight:600 }}>{CHANNELS[generated.channel]?.label} · {generated.scenario}</span>
              </div>
              <span style={{ fontSize:10, color:"var(--t4)", ...T.mono }}>{new Date(generated.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            {generated.subject && (
              <div style={{ padding:"10px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, background:"var(--bg-o)" }}>
                <div style={{ flex:1 }}>
                  <div style={{ ...T.label, marginBottom:3 }}>Assunto</div>
                  <div style={{ fontSize:14, color:"var(--t1)", fontWeight:600 }}>{generated.subject}</div>
                </div>
                <Btn variant="ghost" size="sm" onClick={()=>copy(generated.subject,setCopiedSub)}>
                  <Ic n={copiedSub?"check":"copy"} s={12} c={copiedSub?"var(--grn)":"var(--t2)"}/>{copiedSub?"copiado":"copiar"}
                </Btn>
              </div>
            )}
            <div style={{ padding:"18px 16px" }}>
              <div style={{ fontSize:14, color:"var(--t1)", lineHeight:1.75, whiteSpace:"pre-wrap" }}>{generated.body}</div>
            </div>
            <div style={{ padding:"10px 16px", borderTop:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:11, color:"var(--t4)", ...T.mono }}>{generated.body.split(/\s+/).filter(Boolean).length} palavras</span>
              <div style={{ display:"flex", gap:8 }}>
                <Btn variant="ghost" size="sm" onClick={generate} disabled={loading}><Ic n="refresh" s={13} c="var(--t2)"/>Regerar</Btn>
                <Btn size="sm" onClick={()=>copy(generated.body,setCopied)} style={{ background:copied?"var(--grn)":CHANNELS[generated.channel]?.color, color:"#fff" }}>
                  <Ic n={copied?"check":"copy"} s={13} c="#fff"/>{copied?"Copiado!":CHANNELS[generated.channel]?.label}
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
      {!isMobile && (
        <div style={{ width:210, borderLeft:"1px solid var(--border)", display:"flex", flexDirection:"column", flexShrink:0 }}>
          <div style={{ padding:"14px 12px 10px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:6 }}>
            <Ic n="cal" s={12} c="var(--t4)"/>
            <span style={{ ...T.label }}>Histórico</span>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:8 }}>
            {history.length===0 && <div style={{ color:"var(--t4)", fontSize:11, textAlign:"center", padding:"20px 8px", lineHeight:1.6 }}>Respostas geradas<br/>aparecerão aqui</div>}
            {history.map((h,i)=>{
              const cfg = CHANNELS[h.channel];
              const act = generated?.ts===h.ts;
              return (
                <div key={i} onClick={()=>setGenerated(h)} style={{ padding:10, borderRadius:10, marginBottom:6, cursor:"pointer", border:`1px solid ${act?cfg?.border||"var(--border)":"var(--border)"}`, background:act?cfg?.bg||"var(--bg-o)":"var(--bg-r)", transition:"all 0.15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
                    <Ic n={cfg?.icon||"msg"} s={12} c={cfg?.accent||"var(--t2)"}/>
                    <span style={{ fontSize:11, color:cfg?.accent, ...T.mono, fontWeight:600 }}>{cfg?.label}</span>
                  </div>
                  <div style={{ fontSize:11, color:"var(--t2)", lineHeight:1.4, marginBottom:3 }}>{h.scenario}</div>
                  {h.recruiterMsg && <div style={{ fontSize:10, color:"var(--t4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>"{h.recruiterMsg.slice(0,35)}{h.recruiterMsg.length>35?"…":""}"</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AITab({ process, isMobile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const sys = `Você é um coach de carreira especializado em processos seletivos de tecnologia no Brasil.
Candidato: Fernando, Senior Full-Stack Engineer / Front-End Tech Lead (React, Next.js, Node.js, TypeScript, Supabase, liderança técnica).
Contexto: ${process.origin==="outbound"?"Fernando se candidatou ativamente.":"Fernando foi contactado pelo recrutador."}
Empresa: ${process.company} | Cargo: ${process.role} | Etapa: ${STAGE[process.stage]?.label} | Local: ${process.location} | Salário: ${process.salary} | Próxima etapa: ${process.nextStepNote||"não definida"}
Seja direto, prático e orientado a ação. Responda em português.`;

  const quickActions = [
    { label:"Responder contato inicial", prompt:`Preciso responder o recrutador ${process.recruiter||"(a)"} da ${process.company} sobre a vaga de ${process.role}. Tom profissional mas humano, confirmando interesse.` },
    { label:"Research da empresa",       prompt:`Briefing estratégico sobre a ${process.company}: modelo de negócio, cultura de engenharia, stack, pontos para destacar na entrevista.` },
    { label:"Perguntas prováveis",       prompt:`8 perguntas mais prováveis na etapa de "${STAGE[process.stage]?.label}" para a vaga de ${process.role} na ${process.company}. Para cada uma, uma resposta estruturada baseada no meu perfil.` },
    { label:"Negociar proposta",         prompt:`O range é ${process.salary||"a definir"}. Como negociar a proposta? Argumentos, contra-proposta e como abordar benefícios além do salário.` },
    { label:"Elevator pitch",            prompt:`Elevator pitch de 90 segundos para a conversa com o recrutador da ${process.company} para a vaga de ${process.role}, destacando meus diferenciais de forma natural.` },
  ];

  const send = async text => {
    if (!text.trim()||loading) return;
    const updated = [...messages,{role:"user",content:text}];
    setMessages(updated); setInput(""); setLoading(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const reply = await callAI(updated, sys, s?.access_token);
      setMessages([...updated,{role:"assistant",content:reply}]);
    } catch { setMessages([...updated,{role:"assistant",content:"Erro ao conectar. Tente novamente."}]); }
    setLoading(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Quick actions — scroll horizontal no mobile, wrap no desktop */}
      <div style={{ padding:isMobile?"10px 14px":"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ ...T.label, marginBottom:6, display:"flex", alignItems:"center", gap:6, color:"var(--acc)" }}>
          <Ic n="ai" s={11} c="var(--acc)"/>Quick Actions
        </div>
        <div style={{ display:"flex", gap:6, overflowX:isMobile?"auto":"visible", flexWrap:isMobile?"nowrap":"wrap", paddingBottom:isMobile?4:0, WebkitOverflowScrolling:"touch" }}>
          {quickActions.map(qa=>(
            <button key={qa.label} onClick={()=>send(qa.prompt)} style={{ padding:"6px 12px", borderRadius:20, border:"1px solid var(--border)", background:"var(--bg-o)", color:"var(--t2)", fontSize:isMobile?12:11, cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all 0.15s", whiteSpace:"nowrap", flexShrink:0 }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--acc-b)";e.currentTarget.style.color="var(--acc)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--t2)"}}
            >{qa.label}</button>
          ))}
        </div>
      </div>
      {/* Messages area */}
      <div style={{ flex:1, overflowY:"auto", padding:isMobile?"12px 14px":16, display:"flex", flexDirection:"column", gap:10, minHeight:0, WebkitOverflowScrolling:"touch" }}>
        {messages.length===0 && (
          <div style={{ textAlign:"center", padding:isMobile?"24px 16px":"36px 20px" }}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:10, opacity:0.2 }}><Ic n="ai" s={28} c="var(--t2)"/></div>
            <div style={{ color:"var(--t3)", fontSize:13 }}>IA contextualizada para <strong style={{color:"var(--t2)"}}>{process.company}</strong></div>
            <div style={{ color:"var(--t4)", fontSize:12, marginTop:4 }}>Use os quick actions ou faça sua pergunta</div>
          </div>
        )}
        {messages.map((m,i)=>(
          <div key={i} style={{ alignSelf:m.role==="user"?"flex-end":"flex-start", maxWidth:isMobile?"90%":"85%", padding:"10px 14px", borderRadius:12, background:m.role==="user"?"var(--acc-d)":"var(--bg-r)", border:`1px solid ${m.role==="user"?"var(--acc-b)":"var(--border)"}`, fontSize:13, color:"var(--t1)", lineHeight:1.65, whiteSpace:"pre-wrap" }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf:"flex-start", padding:"10px 14px", borderRadius:12, background:"var(--bg-r)", border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", gap:5 }}>{[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--acc)",animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {/* Input — safe area no mobile para evitar sobreposição com bottom nav / home indicator */}
      <div style={{ padding:isMobile?"10px 14px":"12px 16px", paddingBottom:isMobile?"env(safe-area-inset-bottom, 10px)":"12px", borderTop:"1px solid var(--border)", display:"flex", gap:8, flexShrink:0, background:"var(--bg-r)" }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send(input)} placeholder={isMobile?"Pergunte sobre a empresa...":"Pergunte sobre a empresa, prepare respostas..."} style={{ ...T.input, flex:1, fontSize:13 }}/>
        <button onClick={()=>send(input)} disabled={loading||!input.trim()} style={{ padding:"10px 14px", borderRadius:10, border:"none", background:loading||!input.trim()?"var(--bg-s)":"var(--acc)", color:loading||!input.trim()?"var(--t3)":"#fff", cursor:loading||!input.trim()?"not-allowed":"pointer", fontSize:16, fontWeight:700, transition:"all 0.15s", flexShrink:0 }}>→</button>
      </div>
    </div>
  );
}

// ─── Resumes hook ────────────────────────────────────────────────────────────
function useResumes(session) {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .order("created_at", { ascending: false });
    setResumes(data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (resume) => {
    const row = { ...resume, user_id: session?.user?.id };
    const { data, error } = await supabase.from("resumes").insert(row).select().single();
    if (!error && data) setResumes(prev => [data, ...prev]);
    return { data, error };
  }, [session]);

  const update = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from("resumes").update(patch).eq("id", id).select().single();
    if (!error && data) setResumes(prev => prev.map(r => r.id === id ? data : r));
    return { data, error };
  }, []);

  const remove = useCallback(async (id) => {
    const { error } = await supabase.from("resumes").delete().eq("id", id);
    if (!error) setResumes(prev => prev.filter(r => r.id !== id));
    return { error };
  }, []);

  return { resumes, loading, add, update, remove, refetch: fetch };
}

// ─── PDF text extractor ───────────────────────────────────────────────────────
async function extractTextFromPdf(file) {
  const pdfjsLib = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(" "));
  }
  return pages.join("\n\n");
}

// ─── Resumes Manager Modal ────────────────────────────────────────────────────
function ResumesModal({ onClose, isMobile, resumes, onAdd, onUpdate, onDelete, loading }) {
  const [view, setView] = useState("list"); // list | new | edit
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt");
  const [content, setContent] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const resetForm = () => { setName(""); setLanguage("pt"); setContent(""); setEditing(null); setError(""); };

  const openNew = () => { resetForm(); setView("new"); };
  const openEdit = (r) => { setName(r.name); setLanguage(r.language); setContent(r.content); setEditing(r); setView("edit"); };

  const handleFile = async (file) => {
    setError("");
    setExtracting(true);
    try {
      let text = "";
      if (file.name.endsWith(".pdf")) {
        text = await extractTextFromPdf(file);
      } else {
        text = await file.text();
      }
      setContent(text.trim());
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
    } catch { setError("Não foi possível extrair o texto. Tente colar o conteúdo manualmente."); }
    setExtracting(false);
  };

  const save = async () => {
    if (!name.trim() || !content.trim()) { setError("Nome e conteúdo são obrigatórios."); return; }
    setSaving(true);
    setError("");
    if (view === "new") {
      const { error: e } = await onAdd({ name: name.trim(), language, content: content.trim() });
      if (e) { setError("Erro ao salvar. Tente novamente."); setSaving(false); return; }
    } else {
      const { error: e } = await onUpdate(editing.id, { name: name.trim(), language, content: content.trim() });
      if (e) { setError("Erro ao atualizar. Tente novamente."); setSaving(false); return; }
    }
    setSaving(false);
    resetForm();
    setView("list");
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este currículo?")) return;
    await onDelete(id);
  };

  const langLabel = { pt: "Português", en: "English", es: "Español" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border-md)", borderRadius:isMobile?"20px 20px 0 0":16, width:isMobile?"100%":580, maxHeight:isMobile?"92dvh":"88vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--border)", flexShrink:0, display:"flex", alignItems:"center", gap:10 }}>
          {view !== "list" && (
            <button onClick={()=>{ resetForm(); setView("list"); }} style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex" }}>
              <Ic n="back" s={16} c="var(--t3)"/>
            </button>
          )}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>
              {view==="list" ? "Meus Currículos" : view==="new" ? "Novo Currículo" : "Editar Currículo"}
            </div>
            <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>
              {view==="list" ? `${resumes.length} salvo${resumes.length!==1?"s":""}` : "Salvos no Supabase — disponíveis em qualquer device"}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>

          {/* List */}
          {view==="list" && (
            <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:10 }}>
              {loading ? (
                <div style={{ padding:"32px 0" }}><Spinner/></div>
              ) : resumes.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px" }}>
                  <div style={{ opacity:0.15, display:"flex", justifyContent:"center", marginBottom:12 }}><Ic n="edit" s={36} c="var(--t2)"/></div>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>Nenhum currículo salvo</div>
                  <div style={{ fontSize:12, color:"var(--t3)", lineHeight:1.6, marginBottom:16 }}>Faça upload de um PDF ou cole o texto do seu currículo. Salvo no Supabase, disponível em qualquer dispositivo.</div>
                  <Btn onClick={openNew}><Ic n="plus" s={14} c="#fff"/>Adicionar currículo</Btn>
                </div>
              ) : (
                resumes.map(r => (
                  <div key={r.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"var(--bg-o)", border:"1px solid var(--border)", borderRadius:10, transition:"border-color 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border-md)"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}
                  >
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", marginBottom:3 }}>{r.name}</div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:"var(--bg-s)", border:"1px solid var(--border)", color:"var(--t3)", ...T.mono }}>{langLabel[r.language]||r.language}</span>
                        <span style={{ fontSize:10, color:"var(--t4)", ...T.mono }}>{r.content.length.toLocaleString()} chars</span>
                        <span style={{ fontSize:10, color:"var(--t4)", ...T.mono }}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:4 }}>
                      <button className="icon-btn" onClick={()=>openEdit(r)} style={iconBtn()}><Ic n="edit" s={14} c="var(--t3)"/></button>
                      <button className="icon-btn" onClick={()=>handleDelete(r.id)} style={iconBtn()}><Ic n="trash" s={14} c="var(--red)"/></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* New / Edit form */}
          {(view==="new" || view==="edit") && (
            <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:2 }}>
                  <label style={{ ...T.label, display:"block", marginBottom:6 }}>Nome do currículo</label>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: CV Tech Lead PT, CV Senior Frontend EN..." style={{ ...T.input }}/>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ ...T.label, display:"block", marginBottom:6 }}>Idioma</label>
                  <select value={language} onChange={e=>setLanguage(e.target.value)} style={{ ...T.input, cursor:"pointer" }}>
                    <option value="pt">Português</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>

              {/* Upload area */}
              <div>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>Upload (PDF ou .txt)</label>
                <div
                  onClick={()=>fileRef.current?.click()}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFile(f); }}
                  style={{ border:"1.5px dashed var(--border-md)", borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", background:"var(--bg-o)", transition:"all 0.15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--acc-b)";e.currentTarget.style.background="var(--acc-d)"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border-md)";e.currentTarget.style.background="var(--bg-o)"}}
                >
                  <input ref={fileRef} type="file" accept=".pdf,.txt,.md" style={{ display:"none" }} onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); }}/>
                  {extracting
                    ? <><div style={{ display:"flex", gap:4 }}>{[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--acc)",animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}</div><span style={{ fontSize:12, color:"var(--t3)" }}>Extraindo texto do PDF...</span></>
                    : <><Ic n="copy" s={16} c="var(--t3)"/><span style={{ fontSize:12, color:"var(--t3)" }}>Arraste um PDF ou clique para selecionar — o texto será extraído automaticamente</span></>
                  }
                </div>
              </div>

              <div>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>
                  Conteúdo do currículo
                  {content && <span style={{ color:"var(--t4)", fontWeight:400, marginLeft:6 }}>({content.length.toLocaleString()} chars)</span>}
                </label>
                <textarea
                  value={content}
                  onChange={e=>setContent(e.target.value)}
                  rows={isMobile?10:14}
                  placeholder="Cole aqui o texto do seu currículo, ou faça upload de um PDF acima..."
                  style={{ ...T.input, resize:"vertical", lineHeight:1.6, fontSize:12 }}
                />
              </div>

              {error && <div style={{ padding:"10px 12px", borderRadius:8, background:"rgba(255,106,106,0.08)", border:"1px solid rgba(255,106,106,0.2)", fontSize:12, color:"var(--red)" }}>{error}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", gap:8 }}>
          {view==="list"
            ? <Btn onClick={openNew} full><Ic n="plus" s={14} c="#fff"/>Adicionar currículo</Btn>
            : <><Btn onClick={save} full disabled={saving||extracting}>{saving?"Salvando...":"Salvar"}</Btn><Btn variant="ghost" onClick={()=>{ resetForm(); setView("list"); }}>Cancelar</Btn></>
          }
        </div>
      </div>
    </div>
  );
}

// ─── ChatGPT Import helpers ──────────────────────────────────────────────────

function extractMessagesFromConversation(conv) {
  const mapping = conv.mapping || {};
  const msgs = [];
  Object.values(mapping).forEach(node => {
    const msg = node?.message;
    if (!msg) return;
    const role = msg.author?.role;
    if (role !== "user" && role !== "assistant") return;
    const parts = msg.content?.parts || [];
    const text = parts.filter(p => typeof p === "string").join("\n").trim();
    if (text) msgs.push({ role, content: text, time: msg.create_time || 0 });
  });
  return msgs.sort((a, b) => a.time - b.time);
}

function conversationText(conv) {
  return extractMessagesFromConversation(conv)
    .map(m => `[${m.role === "user" ? "Eu" : "ChatGPT"}]: ${m.content}`)
    .join("\n\n");
}

function parseConversationsJson(raw) {
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function loadConversationsFromFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) {
    return parseConversationsJson(await file.text());
  }
  if (name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const jsonFile = zip.file("conversations.json");
    if (!jsonFile) throw new Error("conversations.json não encontrado no ZIP.");
    return parseConversationsJson(await jsonFile.async("string"));
  }
  throw new Error("Formato não suportado. Use o arquivo .zip ou conversations.json.");
}

function filterRecentConversations(convs, months = 2) {
  const cutoff = Date.now() / 1000 - months * 30 * 24 * 3600;
  return convs.filter(c => (c.update_time || c.create_time || 0) >= cutoff);
}

function filterByProject(convs, projectId) {
  if (!projectId) return convs;
  return convs.filter(c => c.project_id === projectId);
}

function getProjects(convs) {
  const map = {};
  convs.forEach(c => {
    if (c.project_id) map[c.project_id] = (map[c.project_id] || 0) + 1;
  });
  return Object.entries(map).map(([id, count]) => ({ id, count }));
}

function looksLikeRecruiterChat(conv) {
  const title = (conv.title || "").toLowerCase();
  const keywords = ["recrutador","recruiter","vaga","job","oportunidade","opportunity","entrevista","interview","empresa","company","contratação","hiring","processo seletivo","selection process","tech lead","engineer","developer","desenvolvedor","linkedin","headhunter"];
  return keywords.some(k => title.includes(k));
}

// ─── Import ChatGPT Modal ────────────────────────────────────────────────────
function ImportChatGPTModal({ onClose, onImport, isMobile, isDemo }) {
  const [step, setStep] = useState("upload"); // upload | filter | processing | review | done
  const [allConvs, setAllConvs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("__all__");
  const [months, setMonths] = useState(2);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState({});
  const [processing, setProcessing] = useState({ current: 0, total: 0, label: "" });
  const [extracted, setExtracted] = useState([]);
  const [approved, setApproved] = useState({});
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFile = async (file) => {
    setError("");
    try {
      const convs = await loadConversationsFromFile(file);
      if (!convs.length) throw new Error("Nenhuma conversa encontrada no arquivo.");
      setAllConvs(convs);
      setProjects(getProjects(convs));
      applyFilter(convs, "__all__", months);
      setStep("filter");
    } catch(e) { setError(e.message); }
  };

  const applyFilter = (convs, projectId, m) => {
    let result = filterRecentConversations(convs, m);
    if (projectId && projectId !== "__all__") result = filterByProject(result, projectId);
    // Pre-select conversations that look recruiter-related
    const sel = {};
    result.forEach(c => { sel[c.id] = looksLikeRecruiterChat(c); });
    setFiltered(result);
    setSelected(sel);
  };

  const onProjectChange = (pid) => {
    setSelectedProject(pid);
    applyFilter(allConvs, pid, months);
  };

  const onMonthsChange = (m) => {
    setMonths(m);
    applyFilter(allConvs, selectedProject, m);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const processSelected = async () => {
    const toProcess = filtered.filter(c => selected[c.id]);
    if (!toProcess.length) return;
    setStep("processing");
    setProcessing({ current: 0, total: toProcess.length, label: "" });

    const results = [];
    const { data: { session: s } } = await supabase.auth.getSession();
    const sys = `Você é um especialista em análise de conversas de recrutamento. Analise a conversa e retorne APENAS JSON válido, sem markdown nem explicações.`;

    for (let i = 0; i < toProcess.length; i++) {
      const conv = toProcess[i];
      setProcessing({ current: i + 1, total: toProcess.length, label: conv.title || `Conversa ${i+1}` });
      const text = conversationText(conv);
      if (!text.trim()) continue;

      const prompt = `Analise esta conversa e determine se é sobre um processo seletivo/recrutamento.

CONVERSA:
${text.slice(0, 4000)}

Se NÃO for sobre recrutamento, retorne: {"is_recruitment": false}

Se FOR sobre recrutamento, retorne este JSON:
{
  "is_recruitment": true,
  "company": "nome da empresa (ou null)",
  "role": "cargo/vaga (ou null)",
  "recruiter": "nome do recrutador (ou null)",
  "recruiterEmail": "email do recrutador (ou null)",
  "stage": "contacted|screening|interview|technical|offer|rejected|archived",
  "origin": "inbound|outbound",
  "location": "cidade/remoto (ou null)",
  "salary": "faixa salarial mencionada (ou null)",
  "contactedDate": "YYYY-MM-DD da data de contato (ou null)",
  "notes": "resumo em 2-3 linhas do que aconteceu nesta conversa",
  "tags": ["array de tags relevantes ex: react, remoto, fintech"]
}`;

      try {
        const reply = await callAI([{role:"user",content:prompt}], sys, s?.access_token);
        const clean = reply.replace(/```json\n?|\n?```/g,"").trim();
        const parsed = JSON.parse(clean);
        if (parsed.is_recruitment) {
          results.push({
            ...parsed,
            id: crypto.randomUUID(),
            convTitle: conv.title || `Conversa ${i+1}`,
            convDate: new Date((conv.update_time || conv.create_time || 0) * 1000).toISOString().split("T")[0],
          });
        }
      } catch { /* skip malformed */ }
    }

    setExtracted(results);
    const approvedMap = {};
    results.forEach(r => { approvedMap[r.id] = true; });
    setApproved(approvedMap);
    setStep("review");
  };

  const doImport = async () => {
    const toImport = extracted.filter(r => approved[r.id]);
    const now = new Date().toISOString().split("T")[0];
    const newProcesses = toImport.map(r => ({
      id: r.id,
      company: r.company || "Empresa não identificada",
      role: r.role || "Cargo não identificado",
      stage: Object.keys(STAGE).includes(r.stage) ? r.stage : "contacted",
      location: r.location || "",
      salary: r.salary || "",
      recruiter: r.recruiter || "",
      recruiterEmail: r.recruiterEmail || "",
      origin: r.origin === "outbound" ? "outbound" : "inbound",
      contactedDate: r.contactedDate || r.convDate || now,
      nextStepDate: null,
      nextStepNote: "",
      jobUrl: "",
      tags: Array.isArray(r.tags) ? r.tags : [],
      notes: r.notes || "",
      steps: r.contactedDate ? [{ date: r.contactedDate || r.convDate || now, type: "contacted", note: "Importado do ChatGPT" }] : [],
      aiContext: "",
      starred: false,
    }));
    await onImport(newProcesses);
    setStep("done");
  };

  const approvedCount = Object.values(approved).filter(Boolean).length;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border-md)", borderRadius:isMobile?"20px 20px 0 0":16, width:isMobile?"100%":580, maxHeight:isMobile?"92dvh":"88vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid var(--border)", flexShrink:0, display:"flex", alignItems:"center", gap:12 }}>
          {isMobile && <div style={{ position:"absolute", top:12, left:"50%", transform:"translateX(-50%)", width:36, height:4, background:"var(--border-md)", borderRadius:2 }}/>}
          <div style={{ width:36, height:36, borderRadius:10, background:"var(--bg-o)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-7.504-3.357 10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.504 3.356 10.079 10.079 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.5v4.999l-4.331 2.5-4.331-2.5V18z" fill="var(--t2)"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>Importar do ChatGPT</div>
            <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>
              {step==="upload" && "Selecione o arquivo exportado do ChatGPT"}
              {step==="filter" && `${allConvs.length} conversas encontradas`}
              {step==="processing" && `Analisando ${processing.current} de ${processing.total}...`}
              {step==="review" && `${extracted.length} processo${extracted.length!==1?"s":""} detectado${extracted.length!==1?"s":""}`}
              {step==="done" && "Importação concluída"}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>

        {/* Steps indicator */}
        <div style={{ display:"flex", gap:0, flexShrink:0 }}>
          {["upload","filter","processing","review"].map((s,i)=>(
            <div key={s} style={{ flex:1, height:2, background: ["upload","filter","processing","review","done"].indexOf(step) > i ? "var(--acc)" : "var(--border)", transition:"background 0.3s" }}/>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>

          {/* Upload */}
          {step==="upload" && (
            <div style={{ padding:"28px 24px", display:"flex", flexDirection:"column", gap:16 }}>
              <div
                onClick={()=>fileRef.current?.click()}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFile(f); }}
                style={{ border:"2px dashed var(--border-md)", borderRadius:14, padding:"40px 24px", textAlign:"center", cursor:"pointer", transition:"all 0.15s", background:"var(--bg-o)" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--acc-b)";e.currentTarget.style.background="var(--acc-d)"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border-md)";e.currentTarget.style.background="var(--bg-o)"}}
              >
                <div style={{ fontSize:32, marginBottom:12 }}>📁</div>
                <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>Arraste o arquivo aqui ou clique para selecionar</div>
                <div style={{ fontSize:12, color:"var(--t3)" }}>Aceita o <strong style={{color:"var(--t2)"}}>arquivo .zip</strong> exportado do ChatGPT ou <strong style={{color:"var(--t2)"}}>conversations.json</strong> extraído</div>
                <input ref={fileRef} type="file" accept=".zip,.json" style={{ display:"none" }} onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); }}/>
              </div>
              {error && <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(255,106,106,0.08)", border:"1px solid rgba(255,106,106,0.2)", fontSize:12, color:"var(--red)" }}>{error}</div>}
              <div style={{ padding:"14px", background:"var(--bg-o)", borderRadius:10, border:"1px solid var(--border)" }}>
                <div style={{ ...T.label, marginBottom:8 }}>Como exportar do ChatGPT</div>
                {["1. Abra o ChatGPT → clique no seu avatar (canto superior direito)", "2. Vá em Settings → Data Controls", "3. Clique em Export data → Confirm export", "4. Aguarde o email com o link de download (pode levar alguns minutos)", "5. Baixe o .zip e faça o upload aqui"].map((t,i)=>(
                  <div key={i} style={{ fontSize:12, color:"var(--t2)", lineHeight:1.7, display:"flex", gap:8 }}>
                    <span style={{ color:"var(--acc)", fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>{i+1}.</span>{t.slice(3)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter */}
          {step==="filter" && (
            <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>
              {/* Controls */}
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:140 }}>
                  <div style={{ ...T.label, marginBottom:6 }}>Período</div>
                  <select value={months} onChange={e=>onMonthsChange(Number(e.target.value))} style={{ ...T.input, cursor:"pointer" }}>
                    <option value={1}>Último mês</option>
                    <option value={2}>Últimos 2 meses</option>
                    <option value={3}>Últimos 3 meses</option>
                    <option value={6}>Últimos 6 meses</option>
                    <option value={12}>Último ano</option>
                    <option value={999}>Tudo</option>
                  </select>
                </div>
                {projects.length > 0 && (
                  <div style={{ flex:1, minWidth:140 }}>
                    <div style={{ ...T.label, marginBottom:6 }}>Projeto ChatGPT</div>
                    <select value={selectedProject} onChange={e=>onProjectChange(e.target.value)} style={{ ...T.input, cursor:"pointer" }}>
                      <option value="__all__">Todos os projetos</option>
                      {projects.map(p=><option key={p.id} value={p.id}>Projeto ({p.count} chats)</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ fontSize:12, color:"var(--t3)" }}>
                <span style={{ color:"var(--acc)", fontWeight:600 }}>{selectedCount}</span> de <span style={{ color:"var(--t2)" }}>{filtered.length}</span> conversas selecionadas para análise
                {selectedCount > 0 && <span style={{ color:"var(--t3)" }}> · Conversas com aparência de recrutamento foram pré-selecionadas</span>}
              </div>
              {/* Conversation list */}
              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:340, overflowY:"auto" }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"24px", color:"var(--t3)", fontSize:13 }}>Nenhuma conversa no período selecionado</div>
                ) : filtered.map(conv=>{
                  const date = new Date((conv.update_time||conv.create_time||0)*1000).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
                  const isRecruiter = looksLikeRecruiterChat(conv);
                  return (
                    <label key={conv.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, cursor:"pointer", background:selected[conv.id]?"var(--acc-d)":"var(--bg-o)", border:`1px solid ${selected[conv.id]?"var(--acc-b)":"var(--border)"}`, transition:"all 0.15s" }}>
                      <input type="checkbox" checked={!!selected[conv.id]} onChange={e=>setSelected(s=>({...s,[conv.id]:e.target.checked}))} style={{ width:15, height:15, accentColor:"var(--acc)", cursor:"pointer", flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:selected[conv.id]?"var(--acc)":"var(--t1)", fontWeight:selected[conv.id]?500:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{conv.title||"Sem título"}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                        {isRecruiter && <span style={{ fontSize:9, padding:"2px 6px", borderRadius:4, background:"rgba(34,198,122,0.12)", color:"var(--grn)", ...T.mono }}>recrutamento</span>}
                        <span style={{ fontSize:10, color:"var(--t4)", fontFamily:"'JetBrains Mono',monospace" }}>{date}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button onClick={()=>{ const s={}; filtered.forEach(c=>s[c.id]=true); setSelected(s); }} style={{ fontSize:11, color:"var(--acc)", background:"none", border:"none", cursor:"pointer" }}>Selecionar tudo</button>
                <button onClick={()=>setSelected({})} style={{ fontSize:11, color:"var(--t3)", background:"none", border:"none", cursor:"pointer" }}>Desmarcar tudo</button>
              </div>
            </div>
          )}

          {/* Processing */}
          {step==="processing" && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", gap:20 }}>
              <div style={{ display:"flex", gap:6 }}>{[0,1,2].map(i=><span key={i} style={{width:9,height:9,borderRadius:"50%",background:"var(--acc)",animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:14, color:"var(--t1)", fontWeight:600, marginBottom:4 }}>Analisando com IA...</div>
                <div style={{ fontSize:13, color:"var(--t2)", marginBottom:8 }}>{processing.label}</div>
                <div style={{ fontSize:12, color:"var(--t3)" }}>{processing.current} de {processing.total} conversas</div>
              </div>
              <div style={{ width:200, height:4, borderRadius:2, background:"var(--bg-s)", overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:2, background:"var(--acc)", width:`${processing.total ? (processing.current/processing.total)*100 : 0}%`, transition:"width 0.4s" }}/>
              </div>
            </div>
          )}

          {/* Review */}
          {step==="review" && (
            <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:12 }}>
              {extracted.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px" }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>Nenhum processo detectado</div>
                  <div style={{ fontSize:12, color:"var(--t3)" }}>As conversas analisadas não pareceram ser sobre processos seletivos. Tente selecionar mais conversas.</div>
                </div>
              ) : extracted.map(r=>(
                <label key={r.id} style={{ display:"flex", gap:10, padding:"12px 14px", borderRadius:10, background:approved[r.id]?"var(--acc-d)":"var(--bg-o)", border:`1px solid ${approved[r.id]?"var(--acc-b)":"var(--border)"}`, cursor:"pointer", transition:"all 0.15s" }}>
                  <input type="checkbox" checked={!!approved[r.id]} onChange={e=>setApproved(a=>({...a,[r.id]:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--acc)", cursor:"pointer", flexShrink:0, marginTop:2 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:approved[r.id]?"var(--acc)":"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>{r.company||"Empresa?"}</span>
                      <span style={{ fontSize:12, color:"var(--t3)" }}>·</span>
                      <span style={{ fontSize:12, color:"var(--t2)" }}>{r.role||"Cargo?"}</span>
                      <Badge stage={r.stage||"contacted"}/>
                    </div>
                    <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4, ...T.mono }}>{r.convTitle}</div>
                    {r.notes && <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5 }}>{r.notes}</div>}
                    {r.tags?.length > 0 && (
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:6 }}>
                        {r.tags.map(t=><span key={t} style={{ padding:"2px 7px", borderRadius:5, background:"var(--bg-s)", border:"1px solid var(--border)", fontSize:10, color:"var(--t3)", ...T.mono }}>{t}</span>)}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Done */}
          {step==="done" && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", gap:16, textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:4 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--t1)" }}>Importação concluída!</div>
              <div style={{ fontSize:13, color:"var(--t3)" }}>{approvedCount} processo{approvedCount!==1?"s foram":"foi"} adicionado{approvedCount!==1?"s":""} ao seu pipeline.</div>
              <Btn onClick={onClose}>Ver pipeline</Btn>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step==="filter" || step==="review") && (
          <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", gap:8 }}>
            <Btn variant="ghost" onClick={()=>step==="review"?setStep("filter"):setStep("upload")} size="sm"><Ic n="back" s={13} c="var(--t2)"/></Btn>
            {step==="filter" && (
              <Btn onClick={processSelected} full disabled={selectedCount===0}>
                Analisar {selectedCount} conversa{selectedCount!==1?"s":""}
              </Btn>
            )}
            {step==="review" && (
              <Btn onClick={doImport} full disabled={approvedCount===0 || isDemo}>
                {isDemo ? "Indisponível no modo demo" : `Importar ${approvedCount} processo${approvedCount!==1?"s":""}`}
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Setup Modal ─────────────────────────────────────────────────────
function ProfileSetupModal({ onClose, onSave, isMobile, initial }) {
  const [stack, setStack] = useState((initial?.stack||[]).join(", "));
  const [summary, setSummary] = useState(initial?.summary||"");
  const [cvText, setCvText] = useState(initial?.cvText||"");
  const [tab, setTab] = useState("stack");

  const save = () => {
    const stackArr = stack.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
    onSave({ stack: stackArr, summary, cvText });
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border-md)", borderRadius:isMobile?"20px 20px 0 0":16, padding:isMobile?"20px 16px 28px":"28px", width:isMobile?"100%":560, maxHeight:isMobile?"90dvh":"85vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
        {isMobile && <div style={{ width:36, height:4, background:"var(--border-md)", borderRadius:2, margin:"0 auto -4px" }}/>}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>Seu perfil profissional</h3>
            <div style={{ fontSize:12, color:"var(--t3)", marginTop:3 }}>Usado para adaptar o currículo com precisão — só será incluído o que estiver aqui</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4, color:"var(--t3)" }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>

        <div style={{ display:"flex", gap:4, background:"var(--bg-o)", borderRadius:10, padding:4 }}>
          {[["stack","Stack"],["summary","Resumo"],["cvText","CV Completo"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"7px 10px", borderRadius:7, border:"none", background:tab===id?"var(--bg-r)":"transparent", color:tab===id?"var(--t1)":"var(--t3)", fontSize:12, fontWeight:tab===id?600:400, cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all 0.15s", boxShadow:tab===id?"0 1px 3px rgba(0,0,0,0.2)":"none" }}>{label}</button>
          ))}
        </div>

        {tab==="stack" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <label style={{ ...T.label }}>Tecnologias e ferramentas (separadas por vírgula ou enter)</label>
            <textarea value={stack} onChange={e=>setStack(e.target.value)} rows={6} placeholder={"React, Next.js, TypeScript, Node.js, Supabase, PostgreSQL,\nREST API, GraphQL, Jest, Cypress, Docker,\nFigma, Storybook, Tailwind CSS, CSS Modules..."} style={{ ...T.input, resize:"vertical", lineHeight:1.7, fontSize:13 }}/>
            <div style={{ fontSize:11, color:"var(--t3)" }}>A IA só mencionará tecnologias desta lista ao adaptar o currículo. Itens fora da lista serão sinalizados como "não confirmados" e precisarão da sua autorização.</div>
          </div>
        )}
        {tab==="summary" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <label style={{ ...T.label }}>Resumo profissional (texto base para reescritas)</label>
            <textarea value={summary} onChange={e=>setSummary(e.target.value)} rows={6} placeholder="Senior Full-Stack Engineer com 10+ anos de experiência em desenvolvimento React/Next.js e Node.js. Front-End Tech Lead com histórico de liderança de times, design systems e performance em escala..." style={{ ...T.input, resize:"vertical", lineHeight:1.7, fontSize:13 }}/>
          </div>
        )}
        {tab==="cvText" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <label style={{ ...T.label }}>CV completo (opcional — cola aqui para contexto adicional)</label>
            <textarea value={cvText} onChange={e=>setCvText(e.target.value)} rows={12} placeholder="Cole aqui o texto do seu currículo atual. Quanto mais contexto, melhor a adaptação." style={{ ...T.input, resize:"vertical", lineHeight:1.6, fontSize:12 }}/>
          </div>
        )}

        <div style={{ display:"flex", gap:8, paddingTop:4 }}>
          <Btn onClick={save} full>Salvar perfil</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── CV Tab ──────────────────────────────────────────────────────────────────
function CVTab({ process, profile, isMobile, resumes, onManageResumes }) {
  const [jd, setJd] = useState("");
  const [step, setStep] = useState("input"); // input | analyzing | review | result
  const [analysis, setAnalysis] = useState(null);
  const [approved, setApproved] = useState({});
  const [authorized, setAuthorized] = useState({});
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState("profile"); // "profile" or resume.id
  const hasProfile = profile.stack.length > 0 || profile.summary;
  const hasResumes = resumes && resumes.length > 0;
  const selectedResume = resumes?.find(r => r.id === selectedResumeId);
  const baseCV = selectedResume ? selectedResume.content : profile.cvText;

  const analyze = async () => {
    if (!jd.trim()) return;
    setStep("analyzing");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const sys = `Você é um especialista em otimização de currículos para candidaturas em tecnologia.
Regra absoluta: NUNCA invente ou sugira tecnologias que não estejam explicitamente na lista de stack do candidato, a não ser que o candidato autorize explicitamente.`;

      const stackList = profile.stack.length > 0 ? profile.stack.join(", ") : "(não informada)";
      const prompt = `Analise este job description e o perfil do candidato. Retorne APENAS JSON válido, sem markdown.

JOB DESCRIPTION:
${jd}

STACK DO CANDIDATO (fonte da verdade — só use estas tecnologias):
${stackList}

RESUMO DO CANDIDATO:
${profile.summary || "(não informado)"}

VAGA: ${process.role} na ${process.company} | Stage: ${STAGE[process.stage]?.label}

Retorne este JSON:
{
  "jd_keywords": ["lista de tecnologias/skills mencionadas no JD"],
  "matched": ["itens do JD que estão na stack do candidato"],
  "unauthorized": ["itens do JD que NÃO estão na stack do candidato"],
  "highlights": ["3-5 pontos do perfil do candidato mais relevantes para esta vaga"],
  "adapted_summary": "Resumo profissional reescrito para esta vaga, usando APENAS tecnologias da stack do candidato",
  "adapted_highlights": "Tópicos de bullet points para a seção de experiência, usando APENAS tecnologias confirmadas"
}`;

      const reply = await callAI([{role:"user",content:prompt}], sys, s?.access_token);
      const clean = reply.replace(/```json\n?|\n?```/g,"").trim();
      const parsed = JSON.parse(clean);
      setAnalysis(parsed);
      const initialApproved = {};
      (parsed.matched||[]).forEach(k=>{ initialApproved[k]=true; });
      setApproved(initialApproved);
      setAuthorized({});
      setStep("review");
    } catch(e) {
      setStep("input");
      alert("Erro ao analisar. Verifique a conexão e tente novamente.");
    }
  };

  const generate = async () => {
    setStep("analyzing");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const approvedItems = Object.entries(approved).filter(([,v])=>v).map(([k])=>k);
      const authorizedItems = Object.entries(authorized).filter(([,v])=>v).map(([k])=>k);
      const sys = `Você é um especialista em currículos para tecnologia. Escreva de forma direta, sem enrolação.`;

      const prompt = `Gere um currículo adaptado para a vaga abaixo.

VAGA: ${process.role} na ${process.company}

TECNOLOGIAS APROVADAS PELO CANDIDATO:
${approvedItems.join(", ")||"(nenhuma selecionada)"}

TECNOLOGIAS AUTORIZADAS PELO CANDIDATO (adicionais):
${authorizedItems.join(", ")||"nenhuma"}

STACK COMPLETA DO CANDIDATO:
${profile.stack.join(", ")||"(não informada)"}

RESUMO BASE:
${profile.summary||"(não informado)"}

CV BASE:
${baseCV ? baseCV.slice(0,2000) : "(não informado)"}

ANÁLISE DA VAGA:
${JSON.stringify(analysis, null, 2)}

Gere:
1. **Resumo profissional** (3-4 linhas, adaptado para esta vaga)
2. **Destaques técnicos** (bullet points com as tecnologias aprovadas mais relevantes)
3. **Dicas de personalização** (2-3 sugestões de como posicionar a candidatura)

Use APENAS as tecnologias aprovadas + autorizadas. Seja específico e direto. Responda em português.`;

      const reply = await callAI([{role:"user",content:prompt}], sys, s?.access_token);
      setResult(reply);
      setStep("result");
    } catch {
      setStep("review");
      alert("Erro ao gerar. Tente novamente.");
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  if (!hasProfile) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center", gap:16 }}>
      <div style={{ opacity:0.15 }}><Ic n="edit" s={36} c="var(--t2)"/></div>
      <div>
        <div style={{ fontSize:15, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>Configure seu perfil primeiro</div>
        <div style={{ fontSize:13, color:"var(--t3)", lineHeight:1.6 }}>Para adaptar o currículo com segurança, precisamos saber quais tecnologias você realmente domina.</div>
      </div>
    </div>
  );

  if (step==="input") return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:0 }}>
      <div style={{ flex:1, overflowY:"auto", padding:isMobile?"14px":"20px", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ padding:"12px 14px", background:"var(--acc-d)", border:"1px solid var(--acc-b)", borderRadius:10, display:"flex", gap:10, alignItems:"flex-start" }}>
          <Ic n="info" s={14} c="var(--acc)" style={{ flexShrink:0, marginTop:2 }}/>
          <div style={{ fontSize:12, color:"var(--acc)", lineHeight:1.6 }}>
            A IA usará <strong>somente tecnologias do seu perfil</strong>. Itens fora da sua stack serão sinalizados e precisarão de autorização explícita sua antes de serem incluídos.
          </div>
        </div>
        {/* Seletor de currículo base */}
        <div style={{ padding:"12px 14px", background:"var(--bg-o)", borderRadius:10, border:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ ...T.label }}>Currículo base para adaptação</div>
            <button onClick={onManageResumes} style={{ fontSize:11, color:"var(--acc)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Outfit',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
              <Ic n="edit" s={11} c="var(--acc)"/>Gerenciar
            </button>
          </div>
          <select
            value={selectedResumeId}
            onChange={e=>setSelectedResumeId(e.target.value)}
            style={{ ...T.input, fontSize:12, cursor:"pointer" }}
          >
            <option value="profile">Perfil — {profile.cvText ? "CV do perfil (texto colado)" : "resumo + stack do perfil"}</option>
            {(resumes||[]).map(r=>(
              <option key={r.id} value={r.id}>{r.name} ({r.language === "pt" ? "PT" : r.language === "en" ? "EN" : "ES"} · {Math.round(r.content.length/1000)}k chars)</option>
            ))}
          </select>
          {hasResumes && selectedResume && (
            <div style={{ fontSize:11, color:"var(--t3)" }}>
              {selectedResume.content.slice(0,120).replace(/\s+/g," ")}…
            </div>
          )}
          {!hasResumes && (
            <div style={{ fontSize:11, color:"var(--t3)" }}>
              Nenhum currículo salvo ainda. <button onClick={onManageResumes} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--acc)", fontSize:11, fontFamily:"'Outfit',sans-serif" }}>Adicionar agora →</button>
            </div>
          )}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <label style={{ ...T.label }}>Job description da vaga</label>
          <textarea value={jd} onChange={e=>setJd(e.target.value)} rows={isMobile?8:11} placeholder={`Cole aqui o texto completo da vaga de ${process.role} na ${process.company}...`} style={{ ...T.input, resize:"vertical", lineHeight:1.65, fontSize:13 }}/>
        </div>
        <div style={{ padding:"10px 12px", background:"var(--bg-o)", borderRadius:8, border:"1px solid var(--border)" }}>
          <div style={{ ...T.label, marginBottom:4 }}>Stack do perfil</div>
          <div style={{ fontSize:12, color:"var(--t2)" }}>{profile.stack.slice(0,8).join(" · ")}{profile.stack.length>8?` · +${profile.stack.length-8} mais`:""}</div>
        </div>
      </div>
      <div style={{ padding:isMobile?"12px 14px":"14px 20px", borderTop:"1px solid var(--border)", paddingBottom:isMobile?"env(safe-area-inset-bottom, 14px)":"14px" }}>
        <Btn onClick={analyze} full disabled={!jd.trim()}>Analisar job description</Btn>
      </div>
    </div>
  );

  if (step==="analyzing") return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:16 }}>
      <div style={{ display:"flex", gap:6 }}>{[0,1,2].map(i=><span key={i} style={{ width:8, height:8, borderRadius:"50%", background:"var(--acc)", animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}</div>
      <div style={{ fontSize:13, color:"var(--t3)" }}>Analisando a vaga e cruzando com seu perfil...</div>
    </div>
  );

  if (step==="review" && analysis) {
    const matchedItems = analysis.matched || [];
    const unauthorizedItems = analysis.unauthorized || [];
    const approvedCount = Object.values(approved).filter(Boolean).length;
    const authorizedCount = Object.values(authorized).filter(Boolean).length;

    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ flex:1, overflowY:"auto", padding:isMobile?"14px":"20px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* Matched */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--grn)" }}/>
              <span style={{ ...T.label, color:"var(--grn)" }}>Encontrado no seu perfil ({matchedItems.length})</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {matchedItems.map(item=>(
                <label key={item} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background: approved[item]?"var(--grn-d, rgba(34,198,122,0.08))":"var(--bg-o)", border:`1px solid ${approved[item]?"rgba(34,198,122,0.25)":"var(--border)"}`, borderRadius:8, cursor:"pointer", transition:"all 0.15s" }}>
                  <input type="checkbox" checked={!!approved[item]} onChange={e=>setApproved(a=>({...a,[item]:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--grn)", cursor:"pointer", flexShrink:0 }}/>
                  <span style={{ fontSize:13, color: approved[item]?"var(--grn)":"var(--t2)", fontFamily:"'JetBrains Mono',monospace", fontWeight: approved[item]?500:400 }}>{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Unauthorized */}
          {unauthorizedItems.length > 0 && (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--amb)" }}/>
                <span style={{ ...T.label, color:"var(--amb)" }}>Não confirmado no seu perfil ({unauthorizedItems.length})</span>
              </div>
              <div style={{ fontSize:11, color:"var(--t3)", marginBottom:8 }}>Marque apenas o que você realmente domina e deseja incluir no currículo.</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {unauthorizedItems.map(item=>(
                  <label key={item} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background: authorized[item]?"rgba(245,166,35,0.08)":"var(--bg-o)", border:`1px solid ${authorized[item]?"rgba(245,166,35,0.25)":"var(--border)"}`, borderRadius:8, cursor:"pointer", transition:"all 0.15s" }}>
                    <input type="checkbox" checked={!!authorized[item]} onChange={e=>setAuthorized(a=>({...a,[item]:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--amb)", cursor:"pointer", flexShrink:0 }}/>
                    <span style={{ fontSize:13, color: authorized[item]?"var(--amb)":"var(--t3)", fontFamily:"'JetBrains Mono',monospace" }}>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Highlights preview */}
          {(analysis.highlights||[]).length > 0 && (
            <div style={{ padding:"12px 14px", background:"var(--bg-o)", border:"1px solid var(--border)", borderRadius:10 }}>
              <div style={{ ...T.label, marginBottom:8 }}>Pontos de destaque detectados</div>
              {analysis.highlights.map((h,i)=>(
                <div key={i} style={{ fontSize:12, color:"var(--t2)", lineHeight:1.6, display:"flex", gap:6, marginBottom:4 }}>
                  <span style={{ color:"var(--acc)", flexShrink:0 }}>→</span>{h}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:isMobile?"12px 14px":"14px 20px", borderTop:"1px solid var(--border)", paddingBottom:isMobile?"env(safe-area-inset-bottom, 14px)":"14px", display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:11, color:"var(--t3)", textAlign:"center" }}>
            {approvedCount} confirmado{approvedCount!==1?"s":""} · {authorizedCount} autorizado{authorizedCount!==1?"s":""}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn variant="ghost" onClick={()=>setStep("input")} size="sm"><Ic n="back" s={13} c="var(--t2)"/></Btn>
            <Btn onClick={generate} full disabled={approvedCount+authorizedCount===0}>Gerar currículo adaptado</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (step==="result") return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ flex:1, overflowY:"auto", padding:isMobile?"14px":"20px" }}>
        <div style={{ whiteSpace:"pre-wrap", fontSize:13, color:"var(--t1)", lineHeight:1.75, padding:"16px", background:"var(--bg-o)", borderRadius:12, border:"1px solid var(--border)" }}>
          {result}
        </div>
      </div>
      <div style={{ padding:isMobile?"12px 14px":"14px 20px", borderTop:"1px solid var(--border)", paddingBottom:isMobile?"env(safe-area-inset-bottom, 14px)":"14px", display:"flex", gap:8 }}>
        <Btn variant="ghost" onClick={()=>setStep("review")} size="sm"><Ic n="back" s={13} c="var(--t2)"/></Btn>
        <Btn onClick={copyResult} full variant={copied?"secondary":"primary"}>
          <Ic n={copied?"check":"copy"} s={14} c={copied?"var(--grn)":"#fff"}/>{copied?"Copiado!":"Copiar texto"}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={()=>{ setStep("input"); setJd(""); setAnalysis(null); setResult(""); }}>Nova análise</Btn>
      </div>
    </div>
  );

  return null;
}

function ProcessDetail({ process, onUpdate, onDelete, isMobile, profile, onEditProfile, resumes, onManageResumes }) {
  const [tab, setTab] = useState("overview");
  useEffect(()=>setTab("overview"),[process.id]);

  const tabs = [
    { id:"overview",  label:"Overview" },
    { id:"timeline",  label:"Timeline" },
    { id:"messages",  label:"Respostas" },
    { id:"ai",        label:"AI" },
    { id:"curriculo", label:"Currículo" },
  ];
  // No mobile: 100dvh menos header (56px) + tabs header (112px) + bottom nav (52px) + tab pills (48px) + safe area
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
        {tab==="messages"  && <div style={{ height:tabH }}><MessagesTab process={process} isMobile={isMobile}/></div>}
        {tab==="ai"        && <div style={{ height:tabH }}><AITab process={process} isMobile={isMobile}/></div>}
        {tab==="curriculo" && (
          <div style={{ height:tabH, display:"flex", flexDirection:"column" }}>
            {/* Botão de editar perfil no topo da aba */}
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

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ padding:"16px 14px", background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:color, opacity:0.8 }}/>
      <div style={{ fontSize:32, fontWeight:800, color, lineHeight:1, letterSpacing:"-0.04em", fontFamily:"'Outfit',sans-serif" }}>{value}</div>
      <div style={{ ...T.label, marginTop:8 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function Dashboard({ processes }) {
  const active = processes.filter(p=>!["rejected","archived"].includes(p.stage));
  const m = {
    active: active.length,
    interviews: active.filter(p=>["interview","technical"].includes(p.stage)).length,
    offers: active.filter(p=>p.stage==="offer").length,
    urgent: active.filter(p=>{ const d=daysDiff(p.nextStepDate); return d!==null&&d>=0&&d<=2; }).length,
  };
  const byStage = ACTIVE_STAGES.map(s=>({ stage:s, count:processes.filter(p=>p.stage===s).length, bar:STAGE[s].bar }));
  const recentActivity = processes.flatMap(p=>p.steps.map(s=>({...s,company:p.company,role:p.role}))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  const starred = processes.filter(p=>p.starred&&!["rejected","archived"].includes(p.stage));

  return (
    <div style={{ overflowY:"auto", padding:"28px 24px", height:"100%" }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:26, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>Dashboard</h1>
        <div style={{ color:"var(--t2)", fontSize:13, marginTop:4 }}>Visão geral dos processos seletivos</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        <MetricCard label="Ativos"      value={m.active}     color="var(--acc)"/>
        <MetricCard label="Entrevistas" value={m.interviews}  color="var(--amb)" sub="interview + técnica"/>
        <MetricCard label="Propostas"   value={m.offers}      color="var(--grn)" sub={m.offers>0?"Parabéns!":""}/>
        <MetricCard label="Urgentes"    value={m.urgent}      color="var(--red)" sub="próximas 48h"/>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ ...T.label, marginBottom:16 }}>Funil de processos</div>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
          {byStage.map(({stage,count,bar})=>{
            const max = Math.max(...byStage.map(b=>b.count),1);
            const h = count===0?6:Math.max(20,(count/max)*100);
            return (
              <div key={stage} style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:800, color:count>0?bar:"var(--t4)", fontFamily:"'Outfit',sans-serif", marginBottom:6, letterSpacing:"-0.04em" }}>{count}</div>
                <div style={{ height:h, borderRadius:"4px 4px 0 0", background:count>0?`${bar}20`:"var(--bg-s)", border:`1px solid ${count>0?`${bar}40`:"var(--border)"}`, transition:"height 0.3s" }}/>
                <div style={{ ...T.label, marginTop:6, fontSize:9 }}>{STAGE[stage]?.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:18 }}>
          <div style={{ ...T.label, color:"#F5A623", display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
            <Ic n="starF" s={12} c="#F5A623"/>Prioridades
          </div>
          {starred.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>Nenhum processo marcado</div> : starred.map(p=>(
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize:13, color:"var(--t1)", fontWeight:600 }}>{p.company}</div>
                <div style={{ fontSize:11, color:"var(--t2)" }}>{p.role}</div>
              </div>
              <Badge stage={p.stage}/>
            </div>
          ))}
        </div>
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:18 }}>
          <div style={{ ...T.label, marginBottom:14 }}>Atividade recente</div>
          {recentActivity.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>Nenhuma atividade ainda</div> : recentActivity.map((a,i)=>(
            <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:STAGE[a.type]?.bar||"var(--t4)", marginTop:4, flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  <strong style={{color:"var(--t1)"}}>{a.company}</strong> · {a.note}
                </div>
                <div style={{ fontSize:10, color:"var(--t4)", ...T.mono, marginTop:2 }}>{fmtDate(a.date)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileDashboard({ processes }) {
  const active = processes.filter(p=>!["rejected","archived"].includes(p.stage));
  const m = {
    active: active.length,
    interviews: active.filter(p=>["interview","technical"].includes(p.stage)).length,
    offers: active.filter(p=>p.stage==="offer").length,
    urgent: active.filter(p=>{ const d=daysDiff(p.nextStepDate); return d!==null&&d>=0&&d<=2; }).length,
  };
  const byStage = ACTIVE_STAGES.map(s=>({ stage:s, count:processes.filter(p=>p.stage===s).length, bar:STAGE[s].bar }));
  const recent = processes.flatMap(p=>p.steps.map(s=>({...s,company:p.company}))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);

  return (
    <div style={{ padding:16, display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>Dashboard</h1>
        <div style={{ color:"var(--t2)", fontSize:12, marginTop:3 }}>Visão geral dos processos</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <MetricCard label="Ativos"      value={m.active}     color="var(--acc)"/>
        <MetricCard label="Entrevistas" value={m.interviews}  color="var(--amb)"/>
        <MetricCard label="Propostas"   value={m.offers}      color="var(--grn)"/>
        <MetricCard label="Urgentes"    value={m.urgent}      color="var(--red)"/>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:16 }}>
        <div style={{ ...T.label, marginBottom:12 }}>Funil</div>
        <div style={{ display:"flex", gap:5, alignItems:"flex-end" }}>
          {byStage.map(({stage,count,bar})=>{
            const max = Math.max(...byStage.map(b=>b.count),1);
            const h = count===0?4:Math.max(14,(count/max)*70);
            return (
              <div key={stage} style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:15, fontWeight:800, color:count>0?bar:"var(--t4)", fontFamily:"'Outfit',sans-serif", marginBottom:4, letterSpacing:"-0.04em" }}>{count}</div>
                <div style={{ height:h, borderRadius:"3px 3px 0 0", background:count>0?`${bar}20`:"var(--bg-s)", border:`1px solid ${count>0?`${bar}40`:"var(--border)"}` }}/>
                <div style={{ ...T.label, marginTop:4, fontSize:8 }}>{STAGE[stage]?.label.slice(0,5)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:16 }}>
        <div style={{ ...T.label, marginBottom:12 }}>Atividade recente</div>
        {recent.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>Nenhuma atividade ainda</div> : recent.map((a,i)=>(
          <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:STAGE[a.type]?.bar||"var(--t4)", marginTop:4, flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                <strong style={{color:"var(--t1)"}}>{a.company}</strong> · {a.note}
              </div>
              <div style={{ fontSize:10, color:"var(--t4)", ...T.mono, marginTop:2 }}>{fmtDate(a.date)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetPasswordModal({ onClose, onSuccess }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const inputFocus = e => { e.target.style.borderColor="var(--acc)"; e.target.style.boxShadow="0 0 0 3px var(--acc-d)"; };
  const inputBlur  = e => { e.target.style.borderColor="var(--border)"; e.target.style.boxShadow="none"; };

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    if (password.length < 12) { setError("A senha deve ter pelo menos 12 caracteres."); return; }
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    onSuccess?.();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:24 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:16, padding:28, width:"100%", maxWidth:380, animation:"slideUp 0.2s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:16, color:"var(--t1)", letterSpacing:"-0.02em" }}>Definir senha</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", padding:4, borderRadius:6 }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>
        {done ? (
          <div style={{ textAlign:"center", padding:"8px 0" }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"var(--grn-d)", border:"1px solid var(--grn-b)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <Ic n="check" s={20} c="var(--grn)"/>
            </div>
            <div style={{ fontWeight:700, fontSize:15, color:"var(--t1)", marginBottom:8 }}>Senha definida!</div>
            <div style={{ fontSize:13, color:"var(--t2)", marginBottom:20 }}>Nos próximos acessos use seu e-mail e senha.</div>
            <Btn onClick={onClose}>Fechar</Btn>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>Crie uma senha para entrar diretamente sem precisar de link mágico.</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ ...T.label, display:"block", marginBottom:6 }}>Nova senha</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ ...T.label, display:"block", marginBottom:6 }}>Confirmar senha</label>
              <input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repita a senha" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
            </div>
            {error && <div style={{ padding:"8px 12px", borderRadius:8, background:"var(--red-d)", border:"1px solid var(--red-b)", color:"var(--red)", fontSize:12, marginBottom:14 }}>{error}</div>}
            <Btn full disabled={loading || !password || !confirm}>
              {loading ? "Salvando…" : "Definir senha"}
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}

function NewProcessModal({ onClose, onSave, isMobile }) {
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

// ══════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════
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
  const filtered = sortProcesses(listSrc.filter(p=>{ const q=search.toLowerCase(); return (stageFilter==="all"||p.stage===stageFilter)&&(!q||p.company.toLowerCase().includes(q)||p.role.toLowerCase().includes(q)||p.tags.some(t=>t.toLowerCase().includes(q))); }), sortBy);
  const urgent = active.filter(p=>{ const d=daysDiff(p.nextStepDate); return d!==null&&d>=0&&d<=2; }).length;

  const GLOBAL_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { font-family: 'Outfit', sans-serif; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-md); border-radius: 99px; }
    @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    input[type='date']::-webkit-calendar-picker-indicator { filter: var(--date-picker-filter); opacity:0.5; }
    select option { background: var(--bg-r); color: var(--t1); }
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
      outline: 2px solid var(--acc); outline-offset: 2px;
    }
    .nav-btn:hover { background: var(--bg-s) !important; }
    .nav-btn.active:hover { background: var(--acc-d) !important; }
    .icon-btn:hover { background: var(--bg-s) !important; }
    .card-hover:hover { border-color: var(--border-md) !important; }
    .process-card:hover { border-color: var(--border-md) !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .process-card { transition: all 0.15s ease !important; }
    .tab-btn:hover { color: var(--t1) !important; }
    .quick-action:hover { background: var(--bg-s) !important; border-color: var(--border-md) !important; }
    .channel-btn:hover { opacity: 0.85; }
    .scenario-btn:hover { background: var(--bg-s) !important; border-color: var(--border-md) !important; }
    .mobile-tab:hover { opacity: 0.8; }
    .bottom-nav-btn { transition: color 0.15s; min-height: 52px; }
    .bottom-nav-btn:active { opacity: 0.7; }
  `;

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
                  const active = stageFilter===p.id;
                  return (
                    <div key={p.id} onClick={()=>setStageFilter(p.id)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:`1px solid ${active?"var(--acc-b)":"var(--border)"}`, background:active?"var(--acc-d)":"var(--bg-r)", color:active?"var(--acc)":"var(--t3)", fontSize:12, cursor:"pointer", fontFamily:"'Outfit',sans-serif", whiteSpace:"nowrap", fontWeight:active?600:400, transition:"all 0.15s" }}>{p.label}</div>
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
