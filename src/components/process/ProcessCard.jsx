import { useRef } from "react";
import { STAGE } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";
import Badge from "../ui/Badge.jsx";
import Ic from "../ui/Ic.jsx";

const CHANNEL_ICONS = { linkedin:"linkedin", email:"email", whatsapp:"whatsapp", indicacao:"star" };
const LONG_PRESS_MS = 500;

export function ProcessCard({ process, onClick, selected, isMobile, selectionMode, isSelected, onLongPress }) {
  const s = STAGE[process.stage] || STAGE.archived;
  const diff = daysDiff(process.nextStepDate);
  const urgent = diff !== null && diff >= 0 && diff <= 2;
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);

  const handleTouchStart = () => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress?.();
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleClick = () => {
    if (didLongPress.current) return;
    onClick();
  };

  return (
    <div
      data-testid="card-wrapper"
      style={{ position:"relative", marginBottom:6 }}
    >
      <div
        data-testid="process-card"
        className="process-card"
        onClick={handleClick}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onTouchMove={isMobile ? () => clearTimeout(longPressTimer.current) : undefined}
        style={{
          background:"var(--bg-r)",
          border:`1.5px solid ${isSelected ? "var(--red-b, #7f1d1d)" : selected ? "var(--acc-b)" : "var(--border)"}`,
          borderLeft:`3px solid ${isSelected ? "var(--red, #FF6A6A)" : s.bar}`,
          borderRadius:12,
          padding:"12px 14px", cursor:"pointer",
          transition:"border 0.15s, background 0.15s",
          background: isSelected ? "var(--red-d, rgba(255,106,106,0.08))" : "var(--bg-r)",
          position:"relative",
          userSelect:"none",
          WebkitUserSelect:"none",
        }}
      >
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
          {/* Checkbox in selection mode */}
          {selectionMode && (
            <div style={{
              width:20, height:20, borderRadius:6, flexShrink:0, marginRight:2, marginTop:1,
              border:`2px solid ${isSelected ? "var(--red, #FF6A6A)" : "var(--border-md)"}`,
              background: isSelected ? "var(--red, #FF6A6A)" : "transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.15s",
            }}>
              {isSelected && <Ic n="check" s={11} c="#fff"/>}
            </div>
          )}

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
