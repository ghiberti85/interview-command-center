import { useState } from "react";

export function Btn({ children, variant="primary", size="md", full, onClick, disabled, style={}, ...rest }) {
  const [hov, setHov] = useState(false);
  const base = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, borderRadius:10, fontFamily:"'Outfit',sans-serif", fontWeight:600, cursor:disabled?"not-allowed":"pointer", border:"none", transition:"all 0.15s", letterSpacing:"-0.01em", opacity:disabled?0.5:1, ...style };
  const sizes = { sm:{padding:"6px 14px",fontSize:12,borderRadius:8}, md:{padding:"10px 20px",fontSize:13}, lg:{padding:"13px 24px",fontSize:14,borderRadius:12} };
  const variants = {
    primary:   { background: hov&&!disabled ? "var(--acc)" : "var(--acc)", color:"#fff", filter: hov&&!disabled ? "brightness(1.12)" : "none" },
    secondary: { background: hov&&!disabled ? "var(--acc-d)" : "transparent", color:"var(--acc)", border:"1px solid var(--acc-b)" },
    ghost:     { background: hov&&!disabled ? "var(--bg-s)" : "transparent", color:"var(--t2)", border:"1px solid var(--border)" },
    danger:    { background: hov&&!disabled ? "var(--red-d)" : "transparent", color:"var(--red)", border:"1px solid var(--red-b)" },
  };
  return (
    <button onClick={onClick} disabled={disabled} {...rest}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...(full?{width:"100%"}:{}) }}>
      {children}
    </button>
  );
}

export default Btn;
