import { STAGE } from "../../utils/constants.js";

export function Badge({ stage }) {
  const s = STAGE[stage] || STAGE.archived;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:10, fontWeight:600, background:s.badgeBg, color:s.badgeColor, border:`1px solid ${s.badgeBorder}`, whiteSpace:"nowrap" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.badgeColor, flexShrink:0 }}/>
      {s.label}
    </span>
  );
}

export default Badge;
