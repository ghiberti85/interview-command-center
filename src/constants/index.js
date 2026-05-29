// Re-export from utils/constants.js for backward compat + add extra constants
export { STAGE, ACTIVE_STAGES, CHANNELS, SCENARIOS } from "../utils/constants.js";

// Stage ordering for sort
export const STAGE_ORDER = { contacted:0, screening:1, interview:2, technical:3, offer:4, rejected:5, archived:6 };

// Contact channels
export const CONTACT_CHANNELS = [
  { value:"linkedin",  label:"LinkedIn",  icon:"linkedin" },
  { value:"email",     label:"E-mail",    icon:"email"    },
  { value:"whatsapp",  label:"WhatsApp",  icon:"whatsapp" },
  { value:"indicacao", label:"Indicação", icon:"star"     },
];

// Demo data
export const DEMO_PROCESSES = [
  { id:"demo1", company:"Nubank", role:"Senior Front-End Engineer", stage:"interview", location:"Remoto", salary:"R$ 22.000 – 28.000", recruiter:"Ana Paula Costa", recruiterEmail:"ana.costa@nubank.com.br", origin:"inbound", contactedDate:"2026-05-01", nextStepDate:"2026-05-22", nextStepNote:"Entrevista técnica com o time de plataforma", jobUrl:"", tags:["fintech","react","typescript"], notes:"Vaga para o time de design system. Stack: React, TypeScript, Storybook.", steps:[{date:"2026-05-01",type:"contacted",note:"Contato via LinkedIn"},{date:"2026-05-08",type:"screening",note:"Conversa com recruiter — 30min"},{date:"2026-05-15",type:"interview",note:"Entrevista com o gestor de engenharia"}], aiContext:"", starred:true, channel:"linkedin" },
  { id:"demo2", company:"Mercado Livre", role:"Front-End Tech Lead", stage:"screening", location:"São Paulo (híbrido)", salary:"R$ 30.000 – 38.000", recruiter:"Carlos Mendes", recruiterEmail:"carlos@meli.com", origin:"inbound", contactedDate:"2026-05-05", nextStepDate:"2026-05-23", nextStepNote:"Ligação de alinhamento com Head de Eng", jobUrl:"", tags:["lead","react","scale"], notes:"Liderança de time de 8 pessoas. Foco em performance e micro-frontends.", steps:[{date:"2026-05-05",type:"contacted",note:"Mensagem pelo LinkedIn"},{date:"2026-05-12",type:"screening",note:"Entrevista de fit cultural"}], aiContext:"", starred:false, channel:"linkedin" },
  { id:"demo3", company:"Itaú Unibanco", role:"Especialista UI/UX Engineering", stage:"technical", location:"São Paulo (presencial)", salary:"R$ 18.000 – 22.000", recruiter:"Fernanda Lima", recruiterEmail:"fernanda.lima@itau.com.br", origin:"inbound", contactedDate:"2026-04-20", nextStepDate:"2026-05-21", nextStepNote:"Apresentação do case técnico", jobUrl:"", tags:["banco","next.js","design-system"], notes:"Case: construir componente de input com validação e acessibilidade.", steps:[{date:"2026-04-20",type:"contacted",note:"Indicação interna"},{date:"2026-04-28",type:"screening",note:"Triagem com RH"},{date:"2026-05-10",type:"interview",note:"Entrevista comportamental"},{date:"2026-05-18",type:"technical",note:"Recebeu o case técnico"}], aiContext:"", starred:true, channel:"indicacao" },
  { id:"demo4", company:"Spotify", role:"Senior Software Engineer — Web", stage:"offer", location:"Remoto (global)", salary:"USD 140k – 160k", recruiter:"James Harrington", recruiterEmail:"j.harrington@spotify.com", origin:"outbound", contactedDate:"2026-04-10", nextStepDate:"2026-05-25", nextStepNote:"Prazo para aceitar ou recusar a proposta", jobUrl:"", tags:["global","typescript","streaming"], notes:"Proposta formal recebida. Equity + RSU incluídos. Analisar junto ao advogado.", steps:[{date:"2026-04-10",type:"contacted",note:"Aplicação direta no site"},{date:"2026-04-18",type:"screening",note:"Recruiter screen"},{date:"2026-04-28",type:"interview",note:"System design interview"},{date:"2026-05-08",type:"technical",note:"Coding challenge — 4h"},{date:"2026-05-15",type:"offer",note:"Proposta recebida por e-mail"}], aiContext:"", starred:true, channel:"" },
  { id:"demo5", company:"Stone", role:"Front-End Engineer", stage:"rejected", location:"Rio de Janeiro (híbrido)", salary:"R$ 15.000 – 18.000", recruiter:"Mariana Souza", recruiterEmail:"mariana@stone.com.br", origin:"inbound", contactedDate:"2026-04-05", nextStepDate:null, nextStepNote:"", jobUrl:"", tags:["fintech","vue"], notes:"Feedack: buscavam experiência com Vue. Recontato possível no futuro.", steps:[{date:"2026-04-05",type:"contacted",note:"Contato via LinkedIn"},{date:"2026-04-12",type:"screening",note:"Triagem técnica"},{date:"2026-04-22",type:"rejected",note:"Feedack recebido por e-mail"}], aiContext:"", starred:false, channel:"email" },
  { id:"demo6", company:"Creditas", role:"Senior React Developer", stage:"contacted", location:"Remoto", salary:"R$ 16.000 – 20.000", recruiter:"Roberto Alves", recruiterEmail:"roberto.alves@creditas.com", origin:"inbound", contactedDate:"2026-05-18", nextStepDate:"2026-05-27", nextStepNote:"Aguardando retorno para agendar conversa inicial", jobUrl:"", tags:["fintech","react","node"], notes:"Primeiro contato recebido hoje. Vaga para o time de crédito.", steps:[{date:"2026-05-18",type:"contacted",note:"Mensagem no LinkedIn"}], aiContext:"", starred:false, channel:"whatsapp" },
];

// Theme CSS vars
export const DARK_VARS = {
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
  "--acc-text":   "#B0A5FF",
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
export const LIGHT_VARS = {
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
  "--acc-text":   "#5B47FF",
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

// Typography tokens
export const T = {
  label: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)" },
  mono:  { fontFamily:"'JetBrains Mono',monospace" },
  card:  { background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, transition:"border-color 0.15s" },
  input: { width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-o)", color:"var(--t1)", fontSize:14, outline:"none", fontFamily:"'Outfit',sans-serif", transition:"border-color 0.15s, box-shadow 0.15s" },
};

// Icon button style helper
export const iconBtn = (extra={}) => ({ display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:8, border:"none", background:"transparent", cursor:"pointer", transition:"background 0.15s", flexShrink:0, ...extra });

// Global CSS string
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Outfit', sans-serif; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  input, select, button, textarea, a { touch-action: manipulation; }
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
  @media (max-width: 768px) {
    input, textarea, select { font-size: 16px !important; }
  }
`;
