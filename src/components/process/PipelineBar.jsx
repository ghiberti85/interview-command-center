import { STAGE, ACTIVE_STAGES } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { stageLabel } from "../../utils/i18n.js";

export function PipelineBar({ stage, onStageClick, lang = "pt" }) {
  const idx = ACTIVE_STAGES.indexOf(stage);
  return (
    <div>
      <div style={{ display:"flex", gap:3, marginBottom:4 }}>
        {ACTIVE_STAGES.map((s,i) => {
          const done = i < idx, current = i === idx;
          const bar = STAGE[s]?.bar||"var(--t4)";
          return <div key={s} onClick={()=>onStageClick(s)} title={stageLabel(s, lang)} style={{ flex:1, height:4, borderRadius:2, background:done||current?bar:"var(--bg-s)", boxShadow:current?`0 0 6px ${bar}80`:"none", cursor:"pointer", transition:"all 0.15s" }}/>;
        })}
      </div>
      <div style={{ display:"flex", gap:3 }}>
        {ACTIVE_STAGES.map((s,i) => {
          const done = i < idx, current = i === idx;
          const bar = STAGE[s]?.bar||"var(--t4)";
          return <div key={s} onClick={()=>onStageClick(s)} style={{ flex:1, textAlign:"center", ...T.label, fontSize:9, color:done||current?bar:"var(--t4)", cursor:"pointer", transition:"color 0.15s" }}>{stageLabel(s, lang)}</div>;
        })}
      </div>
    </div>
  );
}

export default PipelineBar;
