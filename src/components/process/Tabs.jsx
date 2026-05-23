export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", gap:2, padding:4, background:"var(--bg-o)", borderRadius:12, border:"1px solid var(--border)", overflowX:"auto", scrollbarWidth:"none" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={()=>onChange(t.id)} className="tab-btn" style={{ flex:1, padding:"9px 12px", borderRadius:9, border:"none", background:active===t.id?"var(--bg-r)":"transparent", color:active===t.id?"var(--t1)":"var(--t3)", fontSize:13, fontWeight:active===t.id?600:400, fontFamily:"'Outfit',sans-serif", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s", boxShadow:active===t.id?"0 1px 4px rgba(0,0,0,0.12)":"none" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
