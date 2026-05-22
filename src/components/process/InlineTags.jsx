import { useState } from "react";
import Ic from "../ui/Ic.jsx";

export function InlineTags({ process, onUpdate }) {
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
        <span key={t} data-testid={`tag-${t}`} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px 3px 10px", borderRadius:6, background:"var(--bg-s)", border:"1px solid var(--border)", color:"var(--t3)", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
          {t}
          <button aria-label={`remover ${t}`} onClick={()=>removeTag(t)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", lineHeight:1 }}>
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

export default InlineTags;
