import { useRef, useState } from "react";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";
import Badge from "../ui/Badge.jsx";
import Ic from "../ui/Ic.jsx";

const CHANNEL_ICONS = { linkedin:"linkedin", email:"email", whatsapp:"whatsapp", indicacao:"star" };

const DRAG_THRESHOLD = 140; // px to snap open
const ACTION_W = 160;       // width of the revealed action panel

export function ProcessCard({ process, onClick, selected, onSwipeAction, isMobile }) {
  const s = STAGE[process.stage] || STAGE.archived;
  const diff = daysDiff(process.nextStepDate);
  const urgent = diff !== null && diff >= 0 && diff <= 2;
  const touchStartX = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [open, setOpen] = useState(false);

  const reset = () => { setSwipeOffset(0); setOpen(false); };

  const handleTouchStart = (e) => {
    if (open) return;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    if (dx > 0) setSwipeOffset(Math.min(dx, ACTION_W + 20));
  };
  const handleTouchEnd = () => {
    if (swipeOffset >= DRAG_THRESHOLD) {
      setOpen(true);
      setSwipeOffset(ACTION_W);
    } else {
      setSwipeOffset(0);
    }
    touchStartX.current = null;
  };

  const handleConfirm = (e) => {
    e.stopPropagation();
    reset();
    onSwipeAction();
  };

  return (
    <div
      data-testid="card-wrapper"
      style={{ position:"relative", marginBottom:6, borderRadius:12, overflow:"hidden" }}
    >
      {/* Action panel — fixed width, always at right edge, revealed as card slides */}
      {isMobile && onSwipeAction && (
        <div
          data-testid="swipe-bg"
          style={{
            position:"absolute", top:0, bottom:0, right:0,
            width: ACTION_W,
            background:"#DC2626",
            borderRadius:"0 12px 12px 0",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:10,
          }}
        >
          {open ? (
            <>
              <span style={{ fontSize:12, color:"#fff", fontFamily:"'Outfit',sans-serif", fontWeight:700, textAlign:"center", lineHeight:1.3 }}>Encerrar{"\n"}processo?</span>
              <button
                data-testid="btn-confirm-archive"
                onClick={handleConfirm}
                style={{ width:120, padding:"11px 0", borderRadius:10, background:"#fff", border:"none", color:"#DC2626", fontSize:14, fontWeight:700, fontFamily:"'Outfit',sans-serif", cursor:"pointer" }}
              >Encerrar</button>
              <button
                onClick={e=>{ e.stopPropagation(); reset(); }}
                style={{ width:120, padding:"9px 0", borderRadius:10, background:"rgba(255,255,255,0.18)", border:"1px solid rgba(255,255,255,0.35)", color:"#fff", fontSize:13, fontWeight:600, fontFamily:"'Outfit',sans-serif", cursor:"pointer" }}
              >Cancelar</button>
            </>
          ) : (
            <>
              <Ic n="close" s={22} c="#fff"/>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.85)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em", textTransform:"uppercase" }}>Encerrar</span>
            </>
          )}
        </div>
      )}

      {/* Card — slides left to reveal the action panel */}
      <div
        data-testid="process-card"
        className="process-card"
        onClick={() => { if (open) { reset(); return; } onClick(); }}
        onTouchStart={isMobile && onSwipeAction ? handleTouchStart : undefined}
        onTouchMove={isMobile && onSwipeAction ? handleTouchMove : undefined}
        onTouchEnd={isMobile && onSwipeAction ? handleTouchEnd : undefined}
        style={{
          background:"var(--bg-r)",
          border:`1.5px solid ${selected ? "var(--acc-b)" : "var(--border)"}`,
          borderLeft:`3px solid ${s.bar}`,
          borderRadius:12, padding:"12px 14px", cursor:"pointer",
          transform:`translateX(-${swipeOffset}px)`,
          transition: swipeOffset === 0 || open ? "transform 0.25s ease" : "none",
          position:"relative",
        }}
      >
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
        {process.nextStepDate && (
          <div style={{ display:"flex", marginTop:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:7, background:urgent?"var(--red-d)":"var(--bg-s)", border:`1px solid ${urgent?"var(--red-b)":"var(--border)"}` }}>
              <Ic n={urgent?"alert":"cal"} s={10} c={urgent?"var(--red)":"var(--t3)"}/>
              <span style={{ fontSize:10, color:urgent?"var(--red)":"var(--t3)", ...T.mono }}>
                {fmtDate(process.nextStepDate)}{diff!==null&&` · ${diff===0?"hoje":diff<0?`${Math.abs(diff)}d atrás`:`em ${diff}d`}`}
              </span>
            </div>
          </div>
        )}
        {process.nextStepNote && (
          <div style={{ marginTop:8, fontSize:11, color:"var(--t3)", borderTop:"1px solid var(--border)", paddingTop:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{process.nextStepNote}</div>
        )}
      </div>
    </div>
  );
}

export default ProcessCard;
