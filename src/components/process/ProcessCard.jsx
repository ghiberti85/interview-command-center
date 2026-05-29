import { useRef, useState } from "react";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";
import Badge from "../ui/Badge.jsx";
import Ic from "../ui/Ic.jsx";

const CHANNEL_ICONS = { linkedin:"linkedin", email:"email", whatsapp:"whatsapp", indicacao:"star" };

const DRAG_THRESHOLD = 100;
const ACTION_W = 140;

export function ProcessCard({ process, onClick, selected, onSwipeAction, isMobile, isArchived }) {
  const s = STAGE[process.stage] || STAGE.archived;
  const diff = daysDiff(process.nextStepDate);
  const urgent = diff !== null && diff >= 0 && diff <= 2;
  const touchStartX = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [open, setOpen] = useState(false);

  const reset = () => { setSwipeOffset(0); setOpen(false); };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    if (open) {
      // swiping right closes: offset goes from ACTION_W down toward 0
      const offset = ACTION_W - Math.max(0, -dx);
      setSwipeOffset(Math.max(0, offset));
    } else if (dx > 0) {
      setSwipeOffset(Math.min(dx, ACTION_W + 20));
    }
  };
  const handleTouchEnd = () => {
    if (open) {
      if (swipeOffset < ACTION_W * 0.6) {
        reset();
      } else {
        setSwipeOffset(ACTION_W);
      }
    } else if (swipeOffset >= DRAG_THRESHOLD) {
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

  const actionColor = isArchived ? "#991B1B" : "#DC2626";
  const actionLabel = isArchived ? "Deletar" : "Encerrar";
  const actionIcon = isArchived ? "trash" : "close";

  return (
    <div
      data-testid="card-wrapper"
      style={{ position:"relative", marginBottom:6, borderRadius:12 }}
    >
      {/* Action panel */}
      {isMobile && onSwipeAction && (
        <div
          data-testid="swipe-bg"
          style={{
            position:"absolute", top:0, bottom:0, right:0,
            width: ACTION_W,
            background: actionColor,
            borderRadius:"0 12px 12px 0",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:8,
            padding:"0 8px",
          }}
        >
          {open ? (
            <>
              <button
                data-testid="btn-confirm-archive"
                onClick={handleConfirm}
                style={{ width:"100%", padding:"10px 0", borderRadius:8, background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.35)", color:"#fff", fontSize:13, fontWeight:700, fontFamily:"'Outfit',sans-serif", cursor:"pointer" }}
              >{actionLabel}</button>
              <button
                onClick={e=>{ e.stopPropagation(); reset(); }}
                style={{ width:"100%", padding:"9px 0", borderRadius:8, background:"rgba(0,0,0,0.25)", border:"1px solid rgba(255,255,255,0.18)", color:"rgba(255,255,255,0.75)", fontSize:13, fontWeight:600, fontFamily:"'Outfit',sans-serif", cursor:"pointer" }}
              >Cancelar</button>
            </>
          ) : (
            <>
              <Ic n={actionIcon} s={20} c="#fff"/>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.85)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em", textTransform:"uppercase" }}>{actionLabel}</span>
            </>
          )}
        </div>
      )}

      {/* Card */}
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
          borderRadius: swipeOffset > 0 ? "12px 0 0 12px" : 12,
          padding:"12px 14px", cursor:"pointer",
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
      </div>
    </div>
  );
}

export default ProcessCard;
