import { useState, useEffect, useRef } from "react";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import Ic from "../ui/Ic.jsx";

export function AITab({ process, isMobile, navH = "0px" }) {
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
      <div style={{ padding:isMobile?"10px 14px":"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ ...T.label, marginBottom:6, display:"flex", alignItems:"center", gap:6, color:"var(--acc-text)" }}>
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
      <div style={{ padding:isMobile?"10px 14px":"12px 16px", paddingBottom:isMobile?`calc(10px + ${navH})`:"12px", borderTop:"1px solid var(--border)", display:"flex", gap:8, flexShrink:0, background:"var(--bg-r)" }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send(input)} placeholder={isMobile?"Pergunte sobre a empresa...":"Pergunte sobre a empresa, prepare respostas..."} style={{ ...T.input, flex:1, fontSize:13 }}/>
        <button onClick={()=>send(input)} disabled={loading||!input.trim()} style={{ padding:"10px 14px", borderRadius:10, border:"none", background:loading||!input.trim()?"var(--bg-s)":"var(--acc)", color:loading||!input.trim()?"var(--t3)":"#fff", cursor:loading||!input.trim()?"not-allowed":"pointer", fontSize:16, fontWeight:700, transition:"all 0.15s", flexShrink:0 }}>→</button>
      </div>
    </div>
  );
}

export default AITab;
