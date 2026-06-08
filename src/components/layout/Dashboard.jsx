import { STAGE, ACTIVE_STAGES } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";
import { t, stageLabel } from "../../utils/i18n.js";
import Ic from "../ui/Ic.jsx";
import Badge from "../ui/Badge.jsx";

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ padding:"16px 14px", background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:color, opacity:0.8 }}/>
      <div style={{ fontSize:32, fontWeight:800, color, lineHeight:1, letterSpacing:"-0.04em", fontFamily:"'Outfit',sans-serif" }}>{value}</div>
      <div style={{ ...T.label, marginTop:8 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

export function Dashboard({ processes, lang = "pt" }) {
  const active = processes.filter(p=>!["rejected","archived"].includes(p.stage));
  const m = {
    active: active.length,
    interviews: active.filter(p=>["interview","technical"].includes(p.stage)).length,
    offers: active.filter(p=>p.stage==="offer").length,
    urgent: active.filter(p=>{ const d=daysDiff(p.nextStepDate); return d!==null&&d>=0&&d<=2; }).length,
  };
  const byStage = ACTIVE_STAGES.map(s=>({ stage:s, count:processes.filter(p=>p.stage===s).length, bar:STAGE[s].bar }));
  const recentActivity = processes.flatMap(p=>p.steps.map(s=>({...s,company:p.company,role:p.role}))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  const starred = processes.filter(p=>p.starred&&!["rejected","archived"].includes(p.stage));

  return (
    <div style={{ overflowY:"auto", padding:"28px 24px", height:"100%" }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:26, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>{t(lang, "dashTitle")}</h1>
        <div style={{ color:"var(--t2)", fontSize:13, marginTop:4 }}>{t(lang, "dashSub")}</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        <MetricCard label={t(lang, "activeLabel")}     value={m.active}     color="var(--acc)"/>
        <MetricCard label={t(lang, "interviewsLabel")} value={m.interviews}  color="var(--amb)" sub={t(lang, "interviewSub")}/>
        <MetricCard label={t(lang, "offersLabel")}     value={m.offers}      color="var(--grn)" sub={t(lang, "offerSub")(m.offers)}/>
        <MetricCard label={t(lang, "urgentLabel")}     value={m.urgent}      color="var(--red)" sub={t(lang, "urgentSub")}/>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ ...T.label, marginBottom:16 }}>{t(lang, "funnelLabel")}</div>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
          {byStage.map(({stage,count,bar})=>{
            const max = Math.max(...byStage.map(b=>b.count),1);
            const h = count===0?6:Math.max(20,(count/max)*100);
            return (
              <div key={stage} style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:800, color:count>0?bar:"var(--t4)", fontFamily:"'Outfit',sans-serif", marginBottom:6, letterSpacing:"-0.04em" }}>{count}</div>
                <div style={{ height:h, borderRadius:"4px 4px 0 0", background:count>0?`${bar}20`:"var(--bg-s)", border:`1px solid ${count>0?`${bar}40`:"var(--border)"}`, transition:"height 0.3s" }}/>
                <div style={{ ...T.label, marginTop:6, fontSize:9 }}>{stageLabel(stage, lang)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:18 }}>
          <div style={{ ...T.label, color:"#F5A623", display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
            <Ic n="starF" s={12} c="#F5A623"/>{t(lang, "prioritiesLabel")}
          </div>
          {starred.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>{t(lang, "noStarred")}</div> : starred.map(p=>(
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize:13, color:"var(--t1)", fontWeight:600 }}>{p.company}</div>
                <div style={{ fontSize:11, color:"var(--t2)" }}>{p.role}</div>
              </div>
              <Badge stage={p.stage} lang={lang}/>
            </div>
          ))}
        </div>
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:18 }}>
          <div style={{ ...T.label, marginBottom:14 }}>{t(lang, "recentLabel")}</div>
          {recentActivity.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>{t(lang, "noActivity")}</div> : recentActivity.map((a,i)=>(
            <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:STAGE[a.type]?.bar||"var(--t4)", marginTop:4, flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  <strong style={{color:"var(--t1)"}}>{a.company}</strong> · {a.note}
                </div>
                <div style={{ fontSize:10, color:"var(--t4)", ...T.mono, marginTop:2 }}>{fmtDate(a.date)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobileDashboard({ processes, lang = "pt" }) {
  const active = processes.filter(p=>!["rejected","archived"].includes(p.stage));
  const m = {
    active: active.length,
    interviews: active.filter(p=>["interview","technical"].includes(p.stage)).length,
    offers: active.filter(p=>p.stage==="offer").length,
    urgent: active.filter(p=>{ const d=daysDiff(p.nextStepDate); return d!==null&&d>=0&&d<=2; }).length,
  };
  const byStage = ACTIVE_STAGES.map(s=>({ stage:s, count:processes.filter(p=>p.stage===s).length, bar:STAGE[s].bar }));
  const recent = processes.flatMap(p=>p.steps.map(s=>({...s,company:p.company}))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);

  return (
    <div style={{ padding:16, display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>{t(lang, "dashTitle")}</h1>
        <div style={{ color:"var(--t2)", fontSize:12, marginTop:3 }}>{t(lang, "mobileDashSub")}</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <MetricCard label={t(lang, "activeLabel")}     value={m.active}     color="var(--acc)"/>
        <MetricCard label={t(lang, "interviewsLabel")} value={m.interviews}  color="var(--amb)"/>
        <MetricCard label={t(lang, "offersLabel")}     value={m.offers}      color="var(--grn)"/>
        <MetricCard label={t(lang, "urgentLabel")}     value={m.urgent}      color="var(--red)"/>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:16 }}>
        <div style={{ ...T.label, marginBottom:12 }}>{t(lang, "mobileFunnel")}</div>
        <div style={{ display:"flex", gap:5, alignItems:"flex-end" }}>
          {byStage.map(({stage,count,bar})=>{
            const max = Math.max(...byStage.map(b=>b.count),1);
            const h = count===0?4:Math.max(14,(count/max)*70);
            return (
              <div key={stage} style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:15, fontWeight:800, color:count>0?bar:"var(--t4)", fontFamily:"'Outfit',sans-serif", marginBottom:4, letterSpacing:"-0.04em" }}>{count}</div>
                <div style={{ height:h, borderRadius:"3px 3px 0 0", background:count>0?`${bar}20`:"var(--bg-s)", border:`1px solid ${count>0?`${bar}40`:"var(--border)"}` }}/>
                <div style={{ ...T.label, marginTop:4, fontSize:8 }}>{stageLabel(stage, lang).slice(0,5)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:16 }}>
        <div style={{ ...T.label, marginBottom:12 }}>{t(lang, "recentLabel")}</div>
        {recent.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>{t(lang, "noActivity")}</div> : recent.map((a,i)=>(
          <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:STAGE[a.type]?.bar||"var(--t4)", marginTop:4, flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                <strong style={{color:"var(--t1)"}}>{a.company}</strong> · {a.note}
              </div>
              <div style={{ fontSize:10, color:"var(--t4)", ...T.mono, marginTop:2 }}>{fmtDate(a.date)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
