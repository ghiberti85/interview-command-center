import { useState, useRef } from "react";
import { T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

import { getPdfjs } from "../../lib/ai.js";

async function extractPdfText(file) {
  const lib = await getPdfjs();
  const getDocument = lib.getDocument ?? lib.default?.getDocument;
  if (!getDocument) throw new Error("Biblioteca PDF indisponível.");
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items
      .filter(item => typeof item.str === "string")
      .map(item => item.str)
      .join(" ") + "\n";
  }
  return text.trim();
}

export function ProfileSetupModal({ onClose, onSave, isMobile, initial }) {
  const [stack, setStack] = useState((initial?.stack||[]).join(", "));
  const [summary, setSummary] = useState(initial?.summary||"");
  const [cvText, setCvText] = useState(initial?.cvText||"");
  const [tab, setTab] = useState("stack");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pdfRef = useRef();

  const handlePdf = async (file) => {
    if (!file) return;
    setPdfLoading(true);
    setPdfError("");
    try {
      const text = await extractPdfText(file);
      if (!text) throw new Error("Nenhum texto encontrado no PDF.");
      setCvText(text);
    } catch (e) {
      setPdfError(e.message);
    } finally {
      setPdfLoading(false);
    }
  };

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
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* PDF upload area */}
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

        <div style={{ display:"flex", gap:8, paddingTop:4 }}>
          <Btn onClick={save} full>Salvar perfil</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

export default ProfileSetupModal;
