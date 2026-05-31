import { useState, useRef } from "react";
import { T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";
import { extractTextFromPdf, callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";

function AiExtractingBanner() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, background:"var(--acc-d)", border:"1px solid var(--acc-b)" }}>
      <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid var(--acc-b)", borderTopColor:"var(--acc)", animation:"spin 0.7s linear infinite", flexShrink:0 }}/>
      <span style={{ fontSize:12, color:"var(--acc-text)", fontFamily:"'Outfit',sans-serif" }}>IA extraindo informações do CV...</span>
    </div>
  );
}

export function ProfileSetupModal({ onClose, onSave, isMobile, initial, isDemo }) {
  const [stack, setStack] = useState((initial?.stack||[]).join(", "));
  const [summary, setSummary] = useState(initial?.summary||"");
  const [cvText, setCvText] = useState(initial?.cvText||"");
  const [tab, setTab] = useState("cvText");
  const [aiExtracting, setAiExtracting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pdfRef = useRef();

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null); // { ok: bool, text: string }

  const handlePdf = async (file) => {
    if (!file) return;
    setPdfLoading(true);
    setPdfError("");
    try {
      const text = await extractTextFromPdf(file);
      if (!text) throw new Error("Nenhum texto encontrado no PDF.");
      setCvText(text);
      extractProfileFromCV(text);
    } catch (e) {
      setPdfError(e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const extractProfileFromCV = async (text) => {
    setAiExtracting(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const system = "Você é um assistente que analisa currículos. Responda SOMENTE com JSON válido, sem markdown, sem texto extra.";
      const prompt = `Analise o currículo abaixo e retorne um JSON com exatamente dois campos:
- "summary": resumo profissional em português (2-3 frases, primeira pessoa, baseado no perfil real do CV)
- "stack": lista das tecnologias e ferramentas encontradas no CV, separadas por vírgula

CV:
${text.slice(0, 6000)}`;
      const raw = await callAI([{ role: "user", content: prompt }], system, s?.access_token);
      const cleaned = raw.replace(/```json\n?|```/g, "").trim();
      let parsed;
      try { parsed = JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
      if (parsed?.summary) setSummary(parsed.summary);
      if (parsed?.stack) setStack(parsed.stack);
    } catch {
      // silent — user can fill manually
    } finally {
      setAiExtracting(false);
    }
  };

  const save = () => {
    const stackArr = stack.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
    onSave({ stack: stackArr, summary, cvText });
    onClose();
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { setPwdMsg({ ok:false, text:"A senha precisa ter ao menos 6 caracteres." }); return; }
    if (newPassword !== confirmPassword) { setPwdMsg({ ok:false, text:"As senhas não conferem." }); return; }
    setPwdLoading(true);
    setPwdMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdMsg({ ok:false, text:"Erro ao atualizar senha. Tente novamente." });
    } else {
      setPwdMsg({ ok:true, text:"Senha atualizada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwdLoading(false);
  };

  const TABS = [
    ["cvText","CV"],
    ["summary","Resumo"],
    ["stack","Stack"],
    ...(!isDemo ? [["senha","Senha"]] : []),
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border-md)", borderRadius:isMobile?"20px 20px 0 0":16, padding:isMobile?"20px 16px 28px":"28px", width:isMobile?"100%":560, maxHeight:isMobile?"90dvh":"85vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
        {isMobile && <div style={{ width:36, height:4, background:"var(--border-md)", borderRadius:2, margin:"0 auto -4px" }}/>}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>Perfil & preferências</h3>
            <div style={{ fontSize:12, color:"var(--t3)", marginTop:3 }}>Usado para adaptar o currículo com precisão</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>

        <div style={{ display:"flex", gap:4, background:"var(--bg-o)", borderRadius:10, padding:4 }}>
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"7px 10px", borderRadius:7, border:"none", background:tab===id?"var(--bg-r)":"transparent", color:tab===id?"var(--t1)":"var(--t3)", fontSize:12, fontWeight:tab===id?600:400, cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all 0.15s", boxShadow:tab===id?"0 1px 3px rgba(0,0,0,0.2)":"none" }}>{label}</button>
          ))}
        </div>

        {tab==="stack" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {aiExtracting && <AiExtractingBanner />}
            <label style={{ ...T.label }}>Tecnologias e ferramentas (separadas por vírgula ou enter)</label>
            <textarea value={stack} onChange={e=>setStack(e.target.value)} rows={6} placeholder={"React, Next.js, TypeScript, Node.js, Supabase, PostgreSQL,\nREST API, GraphQL, Jest, Cypress, Docker,\nFigma, Storybook, Tailwind CSS, CSS Modules..."} style={{ ...T.input, resize:"vertical", lineHeight:1.7, fontSize:13 }}/>
            <div style={{ fontSize:11, color:"var(--t3)" }}>A IA só mencionará tecnologias desta lista ao adaptar o currículo.</div>
          </div>
        )}

        {tab==="summary" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {aiExtracting && <AiExtractingBanner />}
            <label style={{ ...T.label }}>Resumo profissional (texto base para reescritas)</label>
            <textarea value={summary} onChange={e=>setSummary(e.target.value)} rows={6} placeholder="Senior Full-Stack Engineer com 10+ anos de experiência em desenvolvimento React/Next.js e Node.js. Front-End Tech Lead com histórico de liderança de times, design systems e performance em escala..." style={{ ...T.input, resize:"vertical", lineHeight:1.7, fontSize:13 }}/>
          </div>
        )}

        {tab==="cvText" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div
              onClick={()=>pdfRef.current?.click()}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{ e.preventDefault(); handlePdf(e.dataTransfer.files[0]); }}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, border:"1.5px dashed var(--border-md)", background:"var(--bg-o)", cursor:"pointer", transition:"all 0.15s", flexShrink:0 }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--acc-b)";e.currentTarget.style.background="var(--acc-d)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border-md)";e.currentTarget.style.background="var(--bg-o)"}}
            >
              <div style={{ width:36, height:36, borderRadius:9, background:"var(--bg-s)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {pdfLoading
                  ? <div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid var(--border)", borderTopColor:"var(--acc)", animation:"spin 0.7s linear infinite" }}/>
                  : <Ic n="upload" s={16} c="var(--t2)"/>
                }
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>
                  {pdfLoading ? "Extraindo texto do PDF..." : "Importar CV em PDF"}
                </div>
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>Arraste ou clique · O texto será extraído e preenchido abaixo</div>
              </div>
              <input ref={pdfRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={e=>handlePdf(e.target.files[0])}/>
            </div>
            {pdfError && (
              <div style={{ padding:"8px 12px", borderRadius:8, background:"var(--red-d)", border:"1px solid var(--red-b)", fontSize:12, color:"var(--red)" }}>{pdfError}</div>
            )}
            <label style={{ ...T.label }}>CV completo (ou cole manualmente)</label>
            <textarea value={cvText} onChange={e=>setCvText(e.target.value)} rows={12} placeholder="Cole aqui o texto do seu currículo atual, ou importe um PDF acima. Quanto mais contexto, melhor a adaptação." style={{ ...T.input, resize:"vertical", lineHeight:1.6, fontSize:12 }}/>
          </div>
        )}

        {tab==="senha" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:13, color:"var(--t3)", lineHeight:1.6 }}>Defina ou altere a senha da sua conta.</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <label style={{ ...T.label }}>Nova senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={e=>{ setNewPassword(e.target.value); setPwdMsg(null); }}
                placeholder="Mínimo 6 caracteres"
                style={{ ...T.input }}
              />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <label style={{ ...T.label }}>Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e=>{ setConfirmPassword(e.target.value); setPwdMsg(null); }}
                placeholder="Repita a nova senha"
                style={{ ...T.input }}
              />
            </div>
            {pwdMsg && (
              <div style={{ padding:"8px 12px", borderRadius:8, fontSize:12,
                background: pwdMsg.ok ? "rgba(34,198,122,0.08)" : "rgba(255,106,106,0.08)",
                border: `1px solid ${pwdMsg.ok ? "rgba(34,198,122,0.25)" : "rgba(255,106,106,0.25)"}`,
                color: pwdMsg.ok ? "var(--grn)" : "var(--red)" }}>
                {pwdMsg.text}
              </div>
            )}
            <Btn onClick={changePassword} disabled={pwdLoading || !newPassword} full>
              {pwdLoading ? "Salvando..." : "Atualizar senha"}
            </Btn>
          </div>
        )}

        {tab !== "senha" && (
          <div style={{ display:"flex", gap:8, paddingTop:4 }}>
            <Btn onClick={save} full>Salvar perfil</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          </div>
        )}
        {tab === "senha" && (
          <Btn variant="ghost" onClick={onClose} full>Fechar</Btn>
        )}
      </div>
    </div>
  );
}

export default ProfileSetupModal;
