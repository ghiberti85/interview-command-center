import { useState, useRef } from "react";
import JSZip from "jszip";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { callAI } from "../../lib/ai.js";
import { supabase } from "../../supabase.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";
import Badge from "../ui/Badge.jsx";

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

export function ImportChatGPTModal({ onClose, onImport, isMobile, isDemo }) {
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

export default ImportChatGPTModal;
