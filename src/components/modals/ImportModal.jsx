import { useState, useRef } from "react";
import JSZip from "jszip";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { T } from "../../constants/index.js";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import { isChatGPTFormat, isICCFormat, looksLikeRecruitment, parseCSV, normalizeProcess } from "../../utils/importHelpers.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";
import Badge from "../ui/Badge.jsx";

// ── ChatGPT conversation text extractor ───────────────────────────────────────
function extractConvText(conv) {
  const msgs = [];
  Object.values(conv.mapping || {}).forEach(node => {
    const msg = node?.message;
    if (!msg) return;
    const role = msg.author?.role;
    if (role !== "user" && role !== "assistant") return;
    const text = (msg.content?.parts || []).filter(p => typeof p === "string").join("\n").trim();
    if (text) msgs.push({ role, content: text, time: msg.create_time || 0 });
  });
  return msgs.sort((a, b) => a.time - b.time)
    .map(m => `[${m.role === "user" ? "Eu" : "IA"}]: ${m.content}`)
    .join("\n\n");
}

async function extractPdfText(file) {
  let pdfjsLib;
  try {
    pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  } catch { throw new Error("Falha ao carregar leitor de PDF."); }
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }
  return text;
}

const AI_SYS = `Você analisa textos e extrai informações sobre processos seletivos. Retorne APENAS JSON válido, sem markdown.`;

function buildExtractPrompt(text) {
  return `Analise o texto e extraia TODOS os processos seletivos mencionados. Retorne array JSON:
[{
  "company": "nome da empresa",
  "role": "cargo",
  "stage": "contacted|screening|interview|technical|offer|rejected|archived",
  "origin": "inbound|outbound",
  "location": "cidade ou remoto",
  "salary": "faixa salarial ou null",
  "recruiter": "nome do recrutador ou null",
  "recruiterEmail": "email ou null",
  "contactedDate": "YYYY-MM-DD ou null",
  "notes": "resumo em 2-3 linhas",
  "tags": []
}]
Se não houver processos, retorne [].

TEXTO:
${text.slice(0, 6000)}`;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function ImportModal({ onClose, onImport, isMobile, isDemo }) {
  const [tab, setTab] = useState("file");
  const [step, setStep] = useState("upload");
  const [pasteText, setPasteText] = useState("");
  const [months, setMonths] = useState(2);
  const [allConvs, setAllConvs] = useState([]);
  const [selectedConvs, setSelectedConvs] = useState({});
  const [processing, setProcessing] = useState({ current: 0, total: 0, label: "" });
  const [extracted, setExtracted] = useState([]);
  const [approved, setApproved] = useState({});
  const [error, setError] = useState("");
  const [sourceType, setSourceType] = useState(null);
  const fileRef = useRef();

  const now = new Date().toISOString().split("T")[0];

  const setReview = (results) => {
    setExtracted(results);
    const ap = {};
    results.forEach(r => { ap[r.id] = true; });
    setApproved(ap);
    setStep("review");
  };

  const handleFile = async (file) => {
    setError("");
    try {
      const name = file.name.toLowerCase();

      if (name.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);
        const jsonFile = zip.file("conversations.json");
        if (!jsonFile) throw new Error("conversations.json não encontrado no ZIP.");
        loadChatGPT(JSON.parse(await jsonFile.async("string")));
        return;
      }

      if (name.endsWith(".json")) {
        const data = JSON.parse(await file.text());
        if (isChatGPTFormat(data)) { loadChatGPT(data); return; }
        if (isICCFormat(data)) {
          setSourceType("icc-json");
          setReview((Array.isArray(data) ? data : []).map(normalizeProcess));
          return;
        }
        throw new Error("JSON não reconhecido. Use o formato ICC (array de processos com campo 'company') ou export do ChatGPT.");
      }

      if (name.endsWith(".csv")) {
        const rows = parseCSV(await file.text());
        if (!rows.length) throw new Error("Nenhuma linha válida encontrada no CSV.");
        setSourceType("csv");
        setReview(rows.map(r => normalizeProcess({ ...r, id: crypto.randomUUID() })));
        return;
      }

      if (name.endsWith(".pdf")) {
        const text = await extractPdfText(file);
        if (!text.trim()) throw new Error("Não foi possível extrair texto do PDF.");
        await extractFromText(text);
        return;
      }

      throw new Error("Formato não suportado. Use .json, .zip, .csv ou .pdf");
    } catch (e) { setError(e.message); }
  };

  const loadChatGPT = (convs) => {
    setSourceType("chatgpt");
    setAllConvs(convs);
    const cutoff = Date.now() / 1000 - months * 30 * 24 * 3600;
    const recent = convs.filter(c => (c.update_time || c.create_time || 0) >= cutoff);
    const sel = {};
    recent.forEach(c => { sel[c.id] = looksLikeRecruitment(c); });
    setSelectedConvs(sel);
    setStep("filter");
  };

  const extractFromText = async (text) => {
    setSourceType("text");
    setStep("processing");
    setProcessing({ current: 0, total: 1, label: "Analisando com IA..." });
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const reply = await callAI([{ role: "user", content: buildExtractPrompt(text) }], AI_SYS, s?.access_token);
      const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, "").trim());
      setReview((Array.isArray(parsed) ? parsed : []).map(r => normalizeProcess({ ...r, id: crypto.randomUUID() })));
    } catch (e) {
      setError("Erro ao analisar o texto. Tente novamente.");
      setStep("upload");
    }
  };

  const processChatGPT = async () => {
    const cutoff = Date.now() / 1000 - months * 30 * 24 * 3600;
    const filtered = allConvs.filter(c => (c.update_time || c.create_time || 0) >= cutoff);
    const toProcess = filtered.filter(c => selectedConvs[c.id]);
    if (!toProcess.length) return;
    setStep("processing");
    const results = [];
    const { data: { session: s } } = await supabase.auth.getSession();
    const sys = `Você analisa conversas de recrutamento. Retorne APENAS JSON válido, sem markdown.`;
    for (let i = 0; i < toProcess.length; i++) {
      const conv = toProcess[i];
      setProcessing({ current: i + 1, total: toProcess.length, label: conv.title || `Conversa ${i + 1}` });
      const text = extractConvText(conv);
      if (!text.trim()) continue;
      try {
        const prompt = `Se NÃO for recrutamento: {"is_recruitment": false}
Se FOR: {"is_recruitment": true, "company":"...","role":"...","recruiter":"...","recruiterEmail":"...","stage":"contacted|screening|interview|technical|offer|rejected|archived","origin":"inbound|outbound","location":"...","salary":"...","contactedDate":"YYYY-MM-DD","notes":"resumo 2-3 linhas","tags":[]}

CONVERSA:\n${text.slice(0, 4000)}`;
        const reply = await callAI([{ role: "user", content: prompt }], sys, s?.access_token);
        const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, "").trim());
        if (parsed.is_recruitment) {
          results.push(normalizeProcess({
            ...parsed,
            id: crypto.randomUUID(),
            convTitle: conv.title,
            contactedDate: parsed.contactedDate || new Date((conv.update_time || conv.create_time || 0) * 1000).toISOString().split("T")[0],
          }));
        }
      } catch { /* skip */ }
    }
    setReview(results);
  };

  const doImport = async () => {
    const toImport = extracted.filter(r => approved[r.id]);
    const newProcesses = toImport.map(r => ({
      id: r.id,
      company: r.company,
      role: r.role,
      stage: r.stage,
      location: r.location,
      salary: r.salary,
      recruiter: r.recruiter,
      recruiterEmail: r.recruiterEmail,
      origin: r.origin,
      contactedDate: r.contactedDate,
      nextStepDate: null,
      nextStepNote: "",
      jobUrl: "",
      tags: r.tags,
      notes: r.notes,
      steps: [{ date: r.contactedDate, type: "contacted", note: "Importado" }],
      aiContext: "",
      starred: false,
      channel: "",
    }));
    await onImport(newProcesses);
    setStep("done");
  };

  const approvedCount = Object.values(approved).filter(Boolean).length;
  const filteredConvs = allConvs.filter(c => (c.update_time || c.create_time || 0) >= Date.now() / 1000 - months * 30 * 24 * 3600);
  const selectedConvCount = Object.values(selectedConvs).filter(Boolean).length;

  const stepIndex = ["upload", "filter", "processing", "review", "done"].indexOf(step);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border-md)", borderRadius:isMobile?"20px 20px 0 0":16, width:isMobile?"100%":560, maxHeight:isMobile?"92dvh":"88vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid var(--border)", flexShrink:0, display:"flex", alignItems:"center", gap:12 }}>
          {isMobile && <div style={{ position:"absolute", top:12, left:"50%", transform:"translateX(-50%)", width:36, height:4, background:"var(--border-md)", borderRadius:2 }}/>}
          <div style={{ width:36, height:36, borderRadius:10, background:"var(--acc-d)", border:"1px solid var(--acc-b)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Ic n="upload" s={16} c="var(--acc)"/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>Importar processos</div>
            <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>
              {step==="upload" && "JSON · CSV · PDF · Colar texto"}
              {step==="filter" && `${allConvs.length} conversas encontradas`}
              {step==="processing" && `Analisando ${processing.current} de ${processing.total}...`}
              {step==="review" && `${extracted.length} processo${extracted.length!==1?"s":""} detectado${extracted.length!==1?"s":""}`}
              {step==="done" && "Importação concluída"}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>

        {/* Progress bar */}
        <div style={{ display:"flex", flexShrink:0 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ flex:1, height:2, background: stepIndex > i ? "var(--acc)" : "var(--border)", transition:"background 0.3s" }}/>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>

          {/* ── Upload ── */}
          {step==="upload" && (
            <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:16 }}>
              {/* Tabs */}
              <div style={{ display:"flex", gap:0, background:"var(--bg-o)", borderRadius:10, padding:3, border:"1px solid var(--border)" }}>
                {[{id:"file",label:"Arquivo"},{id:"text",label:"Colar texto"}].map(t => (
                  <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:tab===t.id?"var(--bg-r)":"transparent", color:tab===t.id?"var(--t1)":"var(--t3)", cursor:"pointer", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:tab===t.id?600:400, transition:"all 0.15s", boxShadow:tab===t.id?"0 1px 3px rgba(0,0,0,0.15)":"none" }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {tab==="file" && (
                <>
                  <div
                    onClick={()=>fileRef.current?.click()}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFile(f); }}
                    style={{ border:"2px dashed var(--border-md)", borderRadius:14, padding:"36px 24px", textAlign:"center", cursor:"pointer", background:"var(--bg-o)", transition:"all 0.15s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--acc-b)";e.currentTarget.style.background="var(--acc-d)"}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border-md)";e.currentTarget.style.background="var(--bg-o)"}}
                  >
                    <div style={{ fontSize:28, marginBottom:10 }}>📂</div>
                    <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>Arraste ou clique para selecionar</div>
                    <div style={{ fontSize:12, color:"var(--t3)" }}>
                      <strong style={{color:"var(--t2)"}}>JSON</strong> · <strong style={{color:"var(--t2)"}}>CSV</strong> · <strong style={{color:"var(--t2)"}}>PDF</strong> · <strong style={{color:"var(--t2)"}}>ZIP</strong>
                    </div>
                    <input ref={fileRef} type="file" accept=".json,.zip,.csv,.pdf" style={{ display:"none" }} onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); }}/>
                  </div>
                  <div style={{ background:"var(--bg-o)", borderRadius:10, border:"1px solid var(--border)", padding:14 }}>
                    <div style={{ ...T.label, marginBottom:10 }}>Formatos aceitos</div>
                    {[
                      {fmt:"JSON",desc:'Array de processos com campo "company" (formato ICC) ou export do ChatGPT'},
                      {fmt:"CSV",desc:"Colunas: company, role, stage, location, salary, recruiter, notes, tags"},
                      {fmt:"PDF",desc:"Conversa ou proposta — IA extrai os dados automaticamente"},
                      {fmt:"ZIP",desc:"Arquivo de export completo do ChatGPT (contém conversations.json)"},
                    ].map(({fmt,desc})=>(
                      <div key={fmt} style={{ display:"flex", gap:10, marginBottom:6, alignItems:"flex-start" }}>
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:"var(--bg-s)", border:"1px solid var(--border)", color:"var(--t2)", fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>{fmt}</span>
                        <span style={{ fontSize:12, color:"var(--t3)", lineHeight:1.5 }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tab==="text" && (
                <>
                  <div style={{ ...T.label, marginBottom:2 }}>Cole a conversa ou descreva o processo</div>
                  <textarea
                    value={pasteText}
                    onChange={e=>setPasteText(e.target.value)}
                    placeholder="Cole aqui uma conversa do LinkedIn, WhatsApp, email de recrutador ou qualquer texto descrevendo o processo seletivo. A IA vai extrair as informações relevantes."
                    rows={9}
                    style={{ ...T.input, resize:"vertical", minHeight:180, lineHeight:1.6 }}
                    autoFocus
                  />
                  <Btn full disabled={!pasteText.trim()} onClick={()=>extractFromText(pasteText)}>
                    <Ic n="ai" s={14} c="#fff"/>Analisar com IA
                  </Btn>
                </>
              )}

              {error && (
                <div style={{ padding:"10px 14px", borderRadius:8, background:"var(--red-d)", border:"1px solid var(--red-b)", fontSize:12, color:"var(--red)" }}>{error}</div>
              )}
            </div>
          )}

          {/* ── Filter (ChatGPT) ── */}
          {step==="filter" && (
            <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ ...T.label, marginBottom:6 }}>Período</div>
                  <select value={months} onChange={e=>setMonths(Number(e.target.value))} style={{ ...T.input, cursor:"pointer" }}>
                    <option value={1}>Último mês</option>
                    <option value={2}>Últimos 2 meses</option>
                    <option value={3}>Últimos 3 meses</option>
                    <option value={6}>Últimos 6 meses</option>
                    <option value={12}>Último ano</option>
                    <option value={999}>Tudo</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize:12, color:"var(--t3)" }}>
                <span style={{ color:"var(--acc)", fontWeight:600 }}>{selectedConvCount}</span> de <span style={{ color:"var(--t2)" }}>{filteredConvs.length}</span> conversas selecionadas
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:300, overflowY:"auto" }}>
                {filteredConvs.map(conv => {
                  const date = new Date((conv.update_time||conv.create_time||0)*1000).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
                  const isRec = looksLikeRecruitment(conv);
                  return (
                    <label key={conv.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, cursor:"pointer", background:selectedConvs[conv.id]?"var(--acc-d)":"var(--bg-o)", border:`1px solid ${selectedConvs[conv.id]?"var(--acc-b)":"var(--border)"}`, transition:"all 0.15s" }}>
                      <input type="checkbox" checked={!!selectedConvs[conv.id]} onChange={e=>setSelectedConvs(s=>({...s,[conv.id]:e.target.checked}))} style={{ width:15, height:15, accentColor:"var(--acc)", cursor:"pointer", flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:13, color:"var(--t1)" }}>{conv.title||"Sem título"}</div>
                      <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
                        {isRec && <span style={{ fontSize:9, padding:"2px 6px", borderRadius:4, background:"var(--grn-d)", color:"var(--grn)", ...T.mono }}>recrutamento</span>}
                        <span style={{ fontSize:10, color:"var(--t4)", ...T.mono }}>{date}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button onClick={()=>{ const s={}; filteredConvs.forEach(c=>s[c.id]=true); setSelectedConvs(s); }} style={{ fontSize:11, color:"var(--acc)", background:"none", border:"none", cursor:"pointer" }}>Selecionar tudo</button>
                <button onClick={()=>setSelectedConvs({})} style={{ fontSize:11, color:"var(--t3)", background:"none", border:"none", cursor:"pointer" }}>Nenhum</button>
              </div>
            </div>
          )}

          {/* ── Processing ── */}
          {step==="processing" && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", gap:20 }}>
              <div style={{ display:"flex", gap:6 }}>
                {[0,1,2].map(i=><span key={i} style={{width:9,height:9,borderRadius:"50%",background:"var(--acc)",animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:14, color:"var(--t1)", fontWeight:600, marginBottom:4 }}>Analisando com IA...</div>
                <div style={{ fontSize:13, color:"var(--t2)", marginBottom:8 }}>{processing.label}</div>
                {processing.total > 1 && <div style={{ fontSize:12, color:"var(--t3)" }}>{processing.current} de {processing.total}</div>}
              </div>
              {processing.total > 1 && (
                <div style={{ width:200, height:4, borderRadius:2, background:"var(--bg-s)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:2, background:"var(--acc)", width:`${(processing.current/processing.total)*100}%`, transition:"width 0.4s" }}/>
                </div>
              )}
            </div>
          )}

          {/* ── Review ── */}
          {step==="review" && (
            <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:10 }}>
              {extracted.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px" }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>Nenhum processo detectado</div>
                  <div style={{ fontSize:12, color:"var(--t3)" }}>Tente com outro arquivo ou um texto mais detalhado.</div>
                </div>
              ) : extracted.map(r => (
                <label key={r.id} style={{ display:"flex", gap:10, padding:"12px 14px", borderRadius:10, background:approved[r.id]?"var(--acc-d)":"var(--bg-o)", border:`1px solid ${approved[r.id]?"var(--acc-b)":"var(--border)"}`, cursor:"pointer", transition:"all 0.15s" }}>
                  <input type="checkbox" checked={!!approved[r.id]} onChange={e=>setApproved(a=>({...a,[r.id]:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--acc)", cursor:"pointer", flexShrink:0, marginTop:2 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>{r.company}</span>
                      <span style={{ fontSize:12, color:"var(--t3)" }}>·</span>
                      <span style={{ fontSize:12, color:"var(--t2)" }}>{r.role}</span>
                      <Badge stage={r.stage||"contacted"}/>
                    </div>
                    {r.convTitle && <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4, ...T.mono }}>{r.convTitle}</div>}
                    {r.notes && <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5 }}>{r.notes}</div>}
                    {r.tags?.length > 0 && (
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:6 }}>
                        {r.tags.map(t => <span key={t} style={{ padding:"2px 7px", borderRadius:5, background:"var(--bg-s)", border:"1px solid var(--border)", fontSize:10, color:"var(--t3)", ...T.mono }}>{t}</span>)}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* ── Done ── */}
          {step==="done" && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", gap:16, textAlign:"center" }}>
              <div style={{ width:52, height:52, borderRadius:14, background:"var(--grn-d)", border:"1px solid var(--grn-b)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="check" s={22} c="var(--grn)"/>
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--t1)" }}>Importação concluída!</div>
              <div style={{ fontSize:13, color:"var(--t3)" }}>{approvedCount} processo{approvedCount!==1?"s foram":" foi"} adicionado{approvedCount!==1?"s":""} ao pipeline.</div>
              <Btn onClick={onClose}>Ver pipeline</Btn>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step==="filter" || step==="review") && (
          <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", gap:8 }}>
            <Btn variant="ghost" onClick={()=>step==="review"?setStep(sourceType==="chatgpt"?"filter":"upload"):setStep("upload")} size="sm">
              <Ic n="back" s={13} c="var(--t2)"/>
            </Btn>
            {step==="filter" && (
              <Btn onClick={processChatGPT} full disabled={selectedConvCount===0}>
                Analisar {selectedConvCount} conversa{selectedConvCount!==1?"s":""}
              </Btn>
            )}
            {step==="review" && (
              <Btn onClick={doImport} full disabled={approvedCount===0||isDemo}>
                {isDemo ? "Indisponível no modo demo" : `Importar ${approvedCount} processo${approvedCount!==1?"s":""}`}
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportModal;
