import { useState } from "react";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { fmtDate } from "../../utils/dateUtils.js";
import Badge from "../ui/Badge.jsx";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

export function TimelineTab({ process, onUpdate }) {
  const [type, setType] = useState("interview");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const addStep = () => {
    if (!note.trim()) return;
    onUpdate({ ...process, steps:[...process.steps,{date,type,note}] });
    setNote("");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ position:"relative", paddingLeft:22 }}>
        <div style={{ position:"absolute", left:5, top:8, bottom:8, width:1, background:"var(--border)" }}/>
        {[...process.steps].reverse().map((s,i)=>{
          const st = STAGE[s.type]||STAGE.archived;
          return (
            <div key={i} style={{ position:"relative", marginBottom:18 }}>
              <div style={{ position:"absolute", left:-17, top:2, width:10, height:10, borderRadius:"50%", background:st.bar, border:"2px solid var(--bg)", boxShadow:`0 0 5px ${st.bar}60` }}/>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:10, color:"var(--t3)", ...T.mono, paddingTop:1, whiteSpace:"nowrap" }}>{fmtDate(s.date)}</span>
                <div>
                  <Badge stage={s.type}/>
                  <div style={{ fontSize:12, color:"var(--t2)", marginTop:4, lineHeight:1.5 }}>{s.note}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding:14, background:"var(--bg-o)", borderRadius:10, border:"1px solid var(--border)" }}>
        <div style={{ ...T.label, marginBottom:10 }}>Adicionar evento</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          <select value={type} onChange={e=>setType(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-r)", color:"var(--t1)", fontSize:12, outline:"none", fontFamily:"'Outfit',sans-serif" }}>
            {Object.entries(STAGE).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-r)", color:"var(--t1)", fontSize:12, outline:"none" }}/>
          <input value={note} onChange={e=>setNote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addStep()} placeholder="Descreva o evento..." style={{ flex:1, minWidth:140, ...T.input, padding:"8px 10px", fontSize:12 }}/>
          <Btn onClick={addStep} size="sm"><Ic n="plus" s={13} c="#fff"/></Btn>
        </div>
      </div>
    </div>
  );
}

export default TimelineTab;
