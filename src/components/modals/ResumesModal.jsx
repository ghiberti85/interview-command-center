import { useState, useRef } from "react";
import { T, iconBtn } from "../../constants/index.js";
import { extractTextFromPdf } from "../../lib/ai.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", gap:16, padding:40 }}>
      <div style={{ width:36, height:36, borderRadius:"50%", border:"2px solid var(--border)", borderTopColor:"var(--acc)", animation:"spin 0.7s linear infinite" }}/>
      <div style={{ fontSize:13, color:"var(--t3)", fontFamily:"'JetBrains Mono',monospace" }}>carregando...</div>
    </div>
  );
}

export function ResumesModal({ onClose, isMobile, resumes, onAdd, onUpdate, onDelete, loading }) {
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
    <div data-testid="resumes-modal" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border-md)", borderRadius:isMobile?"20px 20px 0 0":16, width:isMobile?"100%":580, maxHeight:isMobile?"92dvh":"88vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--border)", flexShrink:0, display:"flex", alignItems:"center", gap:10 }}>
          {view !== "list" && (
            <button data-testid="btn-back" onClick={()=>{ resetForm(); setView("list"); }} style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex" }}>
              <Ic n="back" s={16} c="var(--t3)"/>
            </button>
          )}
          <div style={{ flex:1 }}>
            <div data-testid="modal-title" style={{ fontSize:15, fontWeight:700, color:"var(--t1)", fontFamily:"'Outfit',sans-serif" }}>
              {view==="list" ? "Meus Currículos" : view==="new" ? "Novo Currículo" : "Editar Currículo"}
            </div>
            <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>
              {view==="list" ? `${resumes.length} salvo${resumes.length!==1?"s":""}` : "Salvos no Supabase — disponíveis em qualquer device"}
            </div>
          </div>
          <button data-testid="btn-close" onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>

          {/* List */}
          {view==="list" && (
            <div data-testid="view-list" style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:10 }}>
              {loading ? (
                <div data-testid="loading-spinner" style={{ padding:"32px 0" }}><Spinner/></div>
              ) : resumes.length === 0 ? (
                <div data-testid="empty-state" style={{ textAlign:"center", padding:"40px 20px" }}>
                  <div style={{ opacity:0.15, display:"flex", justifyContent:"center", marginBottom:12 }}><Ic n="edit" s={36} c="var(--t2)"/></div>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>Nenhum currículo salvo</div>
                  <div style={{ fontSize:12, color:"var(--t3)", lineHeight:1.6, marginBottom:16 }}>Faça upload de um PDF ou cole o texto do seu currículo. Salvo no Supabase, disponível em qualquer dispositivo.</div>
                  <Btn data-testid="btn-add-from-empty" onClick={openNew}><Ic n="plus" s={14} c="#fff"/>Adicionar currículo</Btn>
                </div>
              ) : (
                resumes.map(r => (
                  <div key={r.id} data-testid={`resume-item-${r.id}`} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"var(--bg-o)", border:"1px solid var(--border)", borderRadius:10, transition:"border-color 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border-md)"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}
                  >
                    <div style={{ flex:1, minWidth:0 }}>
                      <div data-testid={`resume-name-${r.id}`} style={{ fontSize:13, fontWeight:600, color:"var(--t1)", marginBottom:3 }}>{r.name}</div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span data-testid={`resume-lang-${r.id}`} style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:"var(--bg-s)", border:"1px solid var(--border)", color:"var(--t3)", ...T.mono }}>{langLabel[r.language]||r.language}</span>
                        <span style={{ fontSize:10, color:"var(--t4)", ...T.mono }}>{r.content.length.toLocaleString()} chars</span>
                        <span style={{ fontSize:10, color:"var(--t4)", ...T.mono }}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:4 }}>
                      <button data-testid={`btn-edit-${r.id}`} className="icon-btn" onClick={()=>openEdit(r)} style={iconBtn()}><Ic n="edit" s={14} c="var(--t3)"/></button>
                      <button data-testid={`btn-delete-${r.id}`} className="icon-btn" onClick={()=>handleDelete(r.id)} style={iconBtn()}><Ic n="trash" s={14} c="var(--red)"/></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* New / Edit form */}
          {(view==="new" || view==="edit") && (
            <div data-testid="view-form" style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:2 }}>
                  <label style={{ ...T.label, display:"block", marginBottom:6 }}>Nome do currículo</label>
                  <input data-testid="input-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: CV Tech Lead PT, CV Senior Frontend EN..." style={{ ...T.input }}/>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ ...T.label, display:"block", marginBottom:6 }}>Idioma</label>
                  <select data-testid="select-language" value={language} onChange={e=>setLanguage(e.target.value)} style={{ ...T.input, cursor:"pointer" }}>
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
                  <input data-testid="input-file" ref={fileRef} type="file" accept=".pdf,.txt,.md" style={{ display:"none" }} onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); }}/>
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
                  data-testid="textarea-content"
                  value={content}
                  onChange={e=>setContent(e.target.value)}
                  rows={isMobile?10:14}
                  placeholder="Cole aqui o texto do seu currículo, ou faça upload de um PDF acima..."
                  style={{ ...T.input, resize:"vertical", lineHeight:1.6, fontSize:12 }}
                />
              </div>

              {error && <div data-testid="form-error" style={{ padding:"10px 12px", borderRadius:8, background:"rgba(255,106,106,0.08)", border:"1px solid rgba(255,106,106,0.2)", fontSize:12, color:"var(--red)" }}>{error}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", gap:8 }}>
          {view==="list"
            ? <Btn data-testid="btn-add" onClick={openNew} full><Ic n="plus" s={14} c="#fff"/>Adicionar currículo</Btn>
            : <><Btn data-testid="btn-save" onClick={save} full disabled={saving||extracting}>{saving?"Salvando...":"Salvar"}</Btn><Btn data-testid="btn-cancel" variant="ghost" onClick={()=>{ resetForm(); setView("list"); }}>Cancelar</Btn></>
          }
        </div>
      </div>
    </div>
  );
}

export default ResumesModal;
