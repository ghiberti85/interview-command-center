import { STAGE, ACTIVE_STAGES } from "../../utils/constants.js";
import { T } from "../../constants/index.js";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";
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

export function Dashboard({ processes }) {
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
        <h1 style={{ fontSize:26, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>Dashboard</h1>
        <div style={{ color:"var(--t2)", fontSize:13, marginTop:4 }}>Visão geral dos processos seletivos</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        <MetricCard label="Ativos"      value={m.active}     color="var(--acc)"/>
        <MetricCard label="Entrevistas" value={m.interviews}  color="var(--amb)" sub="interview + técnica"/>
        <MetricCard label="Propostas"   value={m.offers}      color="var(--grn)" sub={m.offers>0?"Parabéns!":""}/>
        <MetricCard label="Urgentes"    value={m.urgent}      color="var(--red)" sub="próximas 48h"/>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ ...T.label, marginBottom:16 }}>Funil de processos</div>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
          {byStage.map(({stage,count,bar})=>{
            const max = Math.max(...byStage.map(b=>b.count),1);
            const h = count===0?6:Math.max(20,(count/max)*100);
            return (
              <div key={stage} style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:800, color:count>0?bar:"var(--t4)", fontFamily:"'Outfit',sans-serif", marginBottom:6, letterSpacing:"-0.04em" }}>{count}</div>
                <div style={{ height:h, borderRadius:"4px 4px 0 0", background:count>0?`${bar}20`:"var(--bg-s)", border:`1px solid ${count>0?`${bar}40`:"var(--border)"}`, transition:"height 0.3s" }}/>
                <div style={{ ...T.label, marginTop:6, fontSize:9 }}>{STAGE[stage]?.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:18 }}>
          <div style={{ ...T.label, color:"#F5A623", display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
            <Ic n="starF" s={12} c="#F5A623"/>Prioridades
          </div>
          {starred.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>Nenhum processo marcado</div> : starred.map(p=>(
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize:13, color:"var(--t1)", fontWeight:600 }}>{p.company}</div>
                <div style={{ fontSize:11, color:"var(--t2)" }}>{p.role}</div>
              </div>
              <Badge stage={p.stage}/>
            </div>
          ))}
        </div>
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:18 }}>
          <div style={{ ...T.label, marginBottom:14 }}>Atividade recente</div>
          {recentActivity.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>Nenhuma atividade ainda</div> : recentActivity.map((a,i)=>(
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

export function MobileDashboard({ processes }) {
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
        <h1 style={{ fontSize:22, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>Dashboard</h1>
        <div style={{ color:"var(--t2)", fontSize:12, marginTop:3 }}>Visão geral dos processos</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <MetricCard label="Ativos"      value={m.active}     color="var(--acc)"/>
        <MetricCard label="Entrevistas" value={m.interviews}  color="var(--amb)"/>
        <MetricCard label="Propostas"   value={m.offers}      color="var(--grn)"/>
        <MetricCard label="Urgentes"    value={m.urgent}      color="var(--red)"/>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:16 }}>
        <div style={{ ...T.label, marginBottom:12 }}>Funil</div>
        <div style={{ display:"flex", gap:5, alignItems:"flex-end" }}>
          {byStage.map(({stage,count,bar})=>{
            const max = Math.max(...byStage.map(b=>b.count),1);
            const h = count===0?4:Math.max(14,(count/max)*70);
            return (
              <div key={stage} style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:15, fontWeight:800, color:count>0?bar:"var(--t4)", fontFamily:"'Outfit',sans-serif", marginBottom:4, letterSpacing:"-0.04em" }}>{count}</div>
                <div style={{ height:h, borderRadius:"3px 3px 0 0", background:count>0?`${bar}20`:"var(--bg-s)", border:`1px solid ${count>0?`${bar}40`:"var(--border)"}` }}/>
                <div style={{ ...T.label, marginTop:4, fontSize:8 }}>{STAGE[stage]?.label.slice(0,5)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:14, padding:16 }}>
        <div style={{ ...T.label, marginBottom:12 }}>Atividade recente</div>
        {recent.length===0 ? <div style={{ color:"var(--t4)", fontSize:12 }}>Nenhuma atividade ainda</div> : recent.map((a,i)=>(
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
