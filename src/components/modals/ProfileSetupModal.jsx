import { useState, useRef, useEffect } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap.js";
import { T } from "../../constants/index.js";
import { t } from "../../utils/i18n.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";
import { extractTextFromPdf, callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";

function AiExtractingBanner({ lang }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, background:"var(--acc-d)", border:"1px solid var(--acc-b)" }}>
      <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid var(--acc-b)", borderTopColor:"var(--acc)", animation:"spin 0.7s linear infinite", flexShrink:0 }}/>
      <span style={{ fontSize:12, color:"var(--acc-text)", fontFamily:"'Outfit',sans-serif" }}>{t(lang, "aiExtractingBanner")}</span>
    </div>
  );
}

export function ProfileSetupModal({ onClose, onSave, isMobile, initial, isDemo, lang = "pt" }) {
  const [stack, setStack] = useState((initial?.stack||[]).join(", "));
  const [summary, setSummary] = useState(initial?.summary||"");
  const [cvText, setCvText] = useState(initial?.cvText||"");
  const [tab, setTab] = useState("cvText");
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiExtractMsg, setAiExtractMsg] = useState(null); // { ok, text }
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pdfRef = useRef();
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);

  useEffect(() => {
    dialogRef.current?.querySelector("button, input, textarea")?.focus();
  }, [tab]);

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
      if (!text) { setPdfError(t(lang, "noPdfText")); return; }
      setCvText(text);
      extractProfileFromCV(text);
    } catch {
      setPdfError(t(lang, "resumeExtractError"));
    } finally {
      setPdfLoading(false);
    }
  };

  const extractProfileFromCV = async (text) => {
    setAiExtracting(true);
    setAiExtractMsg(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) throw new Error(t(lang, "sessionNotFoundError"));
      const system = "Você é um assistente que analisa currículos. Responda SOMENTE com JSON válido, sem markdown, sem texto extra.";
      const prompt = `Analise o currículo abaixo e retorne um JSON com exatamente dois campos:
- "summary": resumo profissional em português (2-3 frases, primeira pessoa, baseado no perfil real do CV)
- "stack": lista das tecnologias e ferramentas encontradas no CV, separadas por vírgula (ex: "React, Node.js, TypeScript, PostgreSQL")

CV:
${text.slice(0, 6000)}`;
      const raw = await callAI([{ role: "user", content: prompt }], system, s.access_token);
      const cleaned = raw.replace(/```json\n?|```/g, "").trim();
      let parsed;
      try { parsed = JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
      if (!parsed) throw new Error(t(lang, "aiExtractFailed"));
      if (parsed?.summary) setSummary(parsed.summary);
      if (parsed?.stack) setStack(parsed.stack);
      setAiExtractMsg({ ok: true, text: t(lang, "aiExtractSuccess") });
      setTimeout(() => setTab("stack"), 800);
    } catch (e) {
      setAiExtractMsg({ ok: false, text: e.message || t(lang, "aiExtractFailed") });
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
    if (newPassword.length < 6) { setPwdMsg({ ok:false, text:t(lang, "passwordMinLength") }); return; }
    if (newPassword !== confirmPassword) { setPwdMsg({ ok:false, text:t(lang, "passwordMismatch") }); return; }
    setPwdLoading(true);
    setPwdMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdMsg({ ok:false, text:t(lang, "passwordUpdateError") });
    } else {
      setPwdMsg({ ok:true, text:t(lang, "passwordUpdateSuccess") });
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwdLoading(false);
  };

  const TABS = [
    ["cvText", t(lang, "tabCv")],
    ["summary", t(lang, "tabSummary")],
    ["stack", t(lang, "tabStack")],
    ...(!isDemo ? [["senha", t(lang, "tabPassword")]] : []),
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(6px)" }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="profile-title" style={{ background:"var(--bg-r)", border:"1px solid var(--border-md)", borderRadius:isMobile?"20px 20px 0 0":16, padding:isMobile?"20px 16px 28px":"28px", width:isMobile?"100%":560, maxHeight:isMobile?"90dvh":"85vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
        {isMobile && <div style={{ width:36, height:4, background:"var(--border-md)", borderRadius:2, margin:"0 auto -4px" }}/>}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 id="profile-title" style={{ margin:0, fontSize:17, fontWeight:700, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>{t(lang, "profilePrefs")}</h3>
            <div style={{ fontSize:12, color:"var(--t3)", marginTop:3 }}>{t(lang, "profilePrefsSub")}</div>
          </div>
          <button aria-label={t(lang, "close")} onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>

        <div style={{ display:"flex", gap:4, background:"var(--bg-o)", borderRadius:10, padding:4 }}>
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"7px 10px", borderRadius:7, border:"none", background:tab===id?"var(--bg-r)":"transparent", color:tab===id?"var(--t1)":"var(--t3)", fontSize:12, fontWeight:tab===id?600:400, cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all 0.15s", boxShadow:tab===id?"0 1px 3px rgba(0,0,0,0.2)":"none" }}>{label}</button>
          ))}
        </div>

        {tab==="stack" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {aiExtracting && <AiExtractingBanner lang={lang} />}
            <label style={{ ...T.label }}>{t(lang, "stackLabel")}</label>
            <textarea value={stack} onChange={e=>setStack(e.target.value)} rows={6} placeholder={"React, Next.js, TypeScript, Node.js, Supabase, PostgreSQL,\nREST API, GraphQL, Jest, Cypress, Docker,\nFigma, Storybook, Tailwind CSS, CSS Modules..."} style={{ ...T.input, resize:"vertical", lineHeight:1.7, fontSize:13 }}/>
            <div style={{ fontSize:11, color:"var(--t3)" }}>{t(lang, "stackHint")}</div>
          </div>
        )}

        {tab==="summary" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {aiExtracting && <AiExtractingBanner lang={lang} />}
            <label style={{ ...T.label }}>{t(lang, "summaryLabel")}</label>
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
                  {pdfLoading ? t(lang, "importCvPdfLoading") : t(lang, "importCvPdf")}
                </div>
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>{t(lang, "importCvPdfHint")}</div>
              </div>
              <input ref={pdfRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={e=>handlePdf(e.target.files[0])}/>
            </div>
            {pdfError && (
              <div style={{ padding:"8px 12px", borderRadius:8, background:"var(--red-d)", border:"1px solid var(--red-b)", fontSize:12, color:"var(--red)" }}>{pdfError}</div>
            )}
            {aiExtracting && <AiExtractingBanner lang={lang} />}
            {aiExtractMsg && (
              <div style={{ padding:"8px 12px", borderRadius:8, fontSize:12,
                background: aiExtractMsg.ok ? "rgba(34,198,122,0.08)" : "rgba(255,106,106,0.08)",
                border: `1px solid ${aiExtractMsg.ok ? "rgba(34,198,122,0.25)" : "rgba(255,106,106,0.25)"}`,
                color: aiExtractMsg.ok ? "var(--grn)" : "var(--red)" }}>
                {aiExtractMsg.text}
              </div>
            )}
            <label style={{ ...T.label }}>{t(lang, "cvTextLabel")}</label>
            <textarea value={cvText} onChange={e=>setCvText(e.target.value)} rows={10} placeholder={t(lang, "cvTextPlaceholder")} style={{ ...T.input, resize:"vertical", lineHeight:1.6, fontSize:12 }}/>
            {cvText.trim().length > 100 && !aiExtracting && (
              <button
                onClick={() => extractProfileFromCV(cvText)}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"1px solid var(--acc-b)", background:"var(--acc-d)", color:"var(--acc-text)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"opacity 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >
                <Ic n="ai" s={13} c="var(--acc)"/>{t(lang, "extractStackBtn")}
              </button>
            )}
          </div>
        )}

        {tab==="senha" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:13, color:"var(--t3)", lineHeight:1.6 }}>{t(lang, "passwordChangeSub")}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <label style={{ ...T.label }}>{t(lang, "newPasswordLabel")}</label>
              <input
                type="password"
                value={newPassword}
                onChange={e=>{ setNewPassword(e.target.value); setPwdMsg(null); }}
                placeholder={t(lang, "newPasswordPlaceholder")}
                style={{ ...T.input }}
              />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <label style={{ ...T.label }}>{t(lang, "confirmPasswordLabel")}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e=>{ setConfirmPassword(e.target.value); setPwdMsg(null); }}
                placeholder={t(lang, "confirmPasswordPlaceholder")}
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
              {pwdLoading ? t(lang, "saving") : t(lang, "updatePassword")}
            </Btn>
          </div>
        )}

        {tab !== "senha" && (
          <div style={{ display:"flex", gap:8, paddingTop:4 }}>
            <Btn onClick={save} full>{t(lang, "saveProfile")}</Btn>
            <Btn variant="ghost" onClick={onClose}>{t(lang, "cancel")}</Btn>
          </div>
        )}
        {tab === "senha" && (
          <Btn variant="ghost" onClick={onClose} full>{t(lang, "close")}</Btn>
        )}
      </div>
    </div>
  );
}

export default ProfileSetupModal;
