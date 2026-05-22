import { useState } from "react";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

export function CVTab({ process, profile, isMobile, resumes, onManageResumes }) {
  const [jd, setJd] = useState("");
  const [step, setStep] = useState("input"); // input | analyzing | review | result
  const [analysis, setAnalysis] = useState(null);
  const [approved, setApproved] = useState({});
  const [authorized, setAuthorized] = useState({});
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState("profile");
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
    <div data-testid="no-profile" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center", gap:16 }}>
      <div style={{ opacity:0.15 }}><Ic n="edit" s={36} c="var(--t2)"/></div>
      <div>
        <div style={{ fontSize:15, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>Configure seu perfil primeiro</div>
        <div style={{ fontSize:13, color:"var(--t3)", lineHeight:1.6 }}>Para adaptar o currículo com segurança, precisamos saber quais tecnologias você realmente domina.</div>
      </div>
    </div>
  );

  if (step==="input") return (
    <div data-testid="step-input" style={{ display:"flex", flexDirection:"column", height:"100%", gap:0 }}>
      <div style={{ flex:1, overflowY:"auto", padding:isMobile?"14px":"20px", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ padding:"12px 14px", background:"var(--acc-d)", border:"1px solid var(--acc-b)", borderRadius:10, display:"flex", gap:10, alignItems:"flex-start" }}>
          <Ic n="info" s={14} c="var(--acc)" style={{ flexShrink:0, marginTop:2 }}/>
          <div style={{ fontSize:12, color:"var(--acc)", lineHeight:1.6 }}>
            A IA usará <strong>somente tecnologias do seu perfil</strong>. Itens fora da sua stack serão sinalizados e precisarão de autorização explícita sua antes de serem incluídos.
          </div>
        </div>
        <div style={{ padding:"12px 14px", background:"var(--bg-o)", borderRadius:10, border:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ ...T.label }}>Currículo base para adaptação</div>
            <button data-testid="btn-manage-resumes" onClick={onManageResumes} style={{ fontSize:11, color:"var(--acc)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Outfit',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
              <Ic n="edit" s={11} c="var(--acc)"/>Gerenciar
            </button>
          </div>
          <select
            data-testid="select-resume"
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
          <textarea data-testid="textarea-jd" value={jd} onChange={e=>setJd(e.target.value)} rows={isMobile?8:11} placeholder={`Cole aqui o texto completo da vaga de ${process.role} na ${process.company}...`} style={{ ...T.input, resize:"vertical", lineHeight:1.65, fontSize:13 }}/>
        </div>
        <div style={{ padding:"10px 12px", background:"var(--bg-o)", borderRadius:8, border:"1px solid var(--border)" }}>
          <div style={{ ...T.label, marginBottom:4 }}>Stack do perfil</div>
          <div data-testid="stack-preview" style={{ fontSize:12, color:"var(--t2)" }}>{profile.stack.slice(0,8).join(" · ")}{profile.stack.length>8?` · +${profile.stack.length-8} mais`:""}</div>
        </div>
      </div>
      <div style={{ padding:isMobile?"12px 14px":"14px 20px", borderTop:"1px solid var(--border)", paddingBottom:isMobile?"env(safe-area-inset-bottom, 14px)":"14px" }}>
        <Btn data-testid="btn-analyze" onClick={analyze} full disabled={!jd.trim()}>Analisar job description</Btn>
      </div>
    </div>
  );

  if (step==="analyzing") return (
    <div data-testid="step-analyzing" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:16 }}>
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
      <div data-testid="step-review" style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ flex:1, overflowY:"auto", padding:isMobile?"14px":"20px", display:"flex", flexDirection:"column", gap:16 }}>
          <div data-testid="matched-section">
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--grn)" }}/>
              <span style={{ ...T.label, color:"var(--grn)" }}>Encontrado no seu perfil ({matchedItems.length})</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {matchedItems.map(item=>(
                <label key={item} data-testid={`matched-${item}`} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background: approved[item]?"var(--grn-d, rgba(34,198,122,0.08))":"var(--bg-o)", border:`1px solid ${approved[item]?"rgba(34,198,122,0.25)":"var(--border)"}`, borderRadius:8, cursor:"pointer", transition:"all 0.15s" }}>
                  <input data-testid={`check-matched-${item}`} type="checkbox" checked={!!approved[item]} onChange={e=>setApproved(a=>({...a,[item]:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--grn)", cursor:"pointer", flexShrink:0 }}/>
                  <span style={{ fontSize:13, color: approved[item]?"var(--grn)":"var(--t2)", fontFamily:"'JetBrains Mono',monospace", fontWeight: approved[item]?500:400 }}>{item}</span>
                </label>
              ))}
            </div>
          </div>
          {unauthorizedItems.length > 0 && (
            <div data-testid="unauthorized-section">
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--amb)" }}/>
                <span style={{ ...T.label, color:"var(--amb)" }}>Não confirmado no seu perfil ({unauthorizedItems.length})</span>
              </div>
              <div style={{ fontSize:11, color:"var(--t3)", marginBottom:8 }}>Marque apenas o que você realmente domina e deseja incluir no currículo.</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {unauthorizedItems.map(item=>(
                  <label key={item} data-testid={`unauthorized-${item}`} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background: authorized[item]?"rgba(245,166,35,0.08)":"var(--bg-o)", border:`1px solid ${authorized[item]?"rgba(245,166,35,0.25)":"var(--border)"}`, borderRadius:8, cursor:"pointer", transition:"all 0.15s" }}>
                    <input data-testid={`check-unauthorized-${item}`} type="checkbox" checked={!!authorized[item]} onChange={e=>setAuthorized(a=>({...a,[item]:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--amb)", cursor:"pointer", flexShrink:0 }}/>
                    <span style={{ fontSize:13, color: authorized[item]?"var(--amb)":"var(--t3)", fontFamily:"'JetBrains Mono',monospace" }}>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
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
          <div data-testid="counts-label" style={{ fontSize:11, color:"var(--t3)", textAlign:"center" }}>
            {approvedCount} confirmado{approvedCount!==1?"s":""} · {authorizedCount} autorizado{authorizedCount!==1?"s":""}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn data-testid="btn-back-to-input" variant="ghost" onClick={()=>setStep("input")} size="sm"><Ic n="back" s={13} c="var(--t2)"/></Btn>
            <Btn data-testid="btn-generate" onClick={generate} full disabled={approvedCount+authorizedCount===0}>Gerar currículo adaptado</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (step==="result") return (
    <div data-testid="step-result" style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ flex:1, overflowY:"auto", padding:isMobile?"14px":"20px" }}>
        <div data-testid="result-text" style={{ whiteSpace:"pre-wrap", fontSize:13, color:"var(--t1)", lineHeight:1.75, padding:"16px", background:"var(--bg-o)", borderRadius:12, border:"1px solid var(--border)" }}>
          {result}
        </div>
      </div>
      <div style={{ padding:isMobile?"12px 14px":"14px 20px", borderTop:"1px solid var(--border)", paddingBottom:isMobile?"env(safe-area-inset-bottom, 14px)":"14px", display:"flex", gap:8 }}>
        <Btn data-testid="btn-back-to-review" variant="ghost" onClick={()=>setStep("review")} size="sm"><Ic n="back" s={13} c="var(--t2)"/></Btn>
        <Btn data-testid="btn-copy" onClick={copyResult} full variant={copied?"secondary":"primary"}>
          <Ic n={copied?"check":"copy"} s={14} c={copied?"var(--grn)":"#fff"}/>{copied?"Copiado!":"Copiar texto"}
        </Btn>
        <Btn data-testid="btn-new-analysis" variant="ghost" size="sm" onClick={()=>{ setStep("input"); setJd(""); setAnalysis(null); setResult(""); }}>Nova análise</Btn>
      </div>
    </div>
  );

  return null;
}

export default CVTab;
