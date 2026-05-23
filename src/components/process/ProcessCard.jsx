import { useRef, useState } from "react";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";
import Badge from "../ui/Badge.jsx";
import Ic from "../ui/Ic.jsx";

const CHANNEL_ICONS = { linkedin:"linkedin", email:"email", whatsapp:"whatsapp", indicacao:"star" };

export function ProcessCard({ process, onClick, selected, onSwipeAction, isMobile, onQuickReply }) {
  const s = STAGE[process.stage] || STAGE.archived;
  const diff = daysDiff(process.nextStepDate);
  const urgent = diff !== null && diff >= 0 && diff <= 2;
  const touchStartX = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    if (dx > 0) setSwipeOffset(Math.min(dx, 110));
  };
  const handleTouchEnd = () => {
    if (swipeOffset >= 80 && onSwipeAction) onSwipeAction();
    setSwipeOffset(0);
    touchStartX.current = null;
  };

  return (
    <div data-testid="card-wrapper" style={{ position:"relative", marginBottom:6, borderRadius:12, overflow:"hidden" }}>
      {isMobile && onSwipeAction && (
        <div data-testid="swipe-bg" style={{ position:"absolute", inset:0, background:"var(--red)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:20 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <Ic n="close" s={18} c="#fff"/>
            <span style={{ fontSize:10, color:"#fff", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em", textTransform:"uppercase" }}>Encerrar</span>
          </div>
        </div>
      )}
    <div
      data-testid="process-card"
      className="process-card"
      onClick={onClick}
      onTouchStart={isMobile&&onSwipeAction?handleTouchStart:undefined}
      onTouchMove={isMobile&&onSwipeAction?handleTouchMove:undefined}
      onTouchEnd={isMobile&&onSwipeAction?handleTouchEnd:undefined}
      style={{ background:"var(--bg-r)", border:`1.5px solid ${selected?"var(--acc-b)":"var(--border)"}`, borderLeft:`3px solid ${s.bar}`, borderRadius:12, padding:"12px 14px", cursor:"pointer", transform:`translateX(-${swipeOffset}px)`, transition:swipeOffset===0?"transform 0.2s":"none", position:"relative" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span data-testid="company" style={{ fontWeight:700, fontSize:14, color:"var(--t1)", letterSpacing:"-0.02em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{process.company}</span>
            {process.starred && <Ic n="starF" s={12} c="#F5A623"/>}
            {process.channel && CHANNEL_ICONS[process.channel] && (
              <Ic n={CHANNEL_ICONS[process.channel]} s={11} c="var(--t3)"/>
            )}
          </div>
          <div style={{ fontSize:12, color:"var(--t2)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{process.role}</div>
        </div>
        <Badge stage={process.stage}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8, gap:8 }}>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", minWidth:0 }}>
          {process.tags.slice(0,2).map(t=>(
            <span key={t} style={{ padding:"2px 7px", borderRadius:6, background:"var(--bg-s)", color:"var(--t3)", fontSize:10, ...T.mono, whiteSpace:"nowrap" }}>{t}</span>
          ))}
        </div>
        {process.nextStepDate && (
          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:7, background:urgent?"var(--red-d)":"var(--bg-s)", border:`1px solid ${urgent?"var(--red-b)":"var(--border)"}`, flexShrink:0 }}>
            <Ic n={urgent?"alert":"cal"} s={10} c={urgent?"var(--red)":"var(--t3)"}/>
            <span style={{ fontSize:10, color:urgent?"var(--red)":"var(--t3)", ...T.mono }}>
              {fmtDate(process.nextStepDate)}{diff!==null&&` · ${diff===0?"hoje":diff<0?`${Math.abs(diff)}d atrás`:`em ${diff}d`}`}
            </span>
          </div>
        )}
      </div>
      {process.nextStepNote && (
        <div style={{ marginTop:8, fontSize:11, color:"var(--t3)", borderTop:"1px solid var(--border)", paddingTop:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{process.nextStepNote}</div>
      )}
      {isMobile && onQuickReply && (
        <div style={{ marginTop:10, borderTop:"1px solid var(--border)", paddingTop:10 }}>
          <button
            onClick={e=>{ e.stopPropagation(); onQuickReply(); }}
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%", padding:"8px 0", borderRadius:8, border:"1px solid var(--acc-b)", background:"var(--acc-d)", color:"var(--acc)", fontSize:13, fontWeight:600, fontFamily:"'Outfit',sans-serif", cursor:"pointer" }}
          >
            <Ic n="msg" s={13} c="var(--acc)"/>
            Gerar resposta
          </button>
        </div>
      )}
    </div>
    </div>
  );
}

export default ProcessCard;
