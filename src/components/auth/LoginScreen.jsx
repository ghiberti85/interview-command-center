import { useState } from "react";
import { supabase } from "../../supabase.js";
import { T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

export function LoginScreen({ onDemo }) {
  const [mode, setMode] = useState("password"); // "password" | "magic" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inputFocus = e => { e.target.style.borderColor="var(--acc)"; e.target.style.boxShadow="0 0 0 3px var(--acc-d)"; };
  const inputBlur  = e => { e.target.style.borderColor="var(--border)"; e.target.style.boxShadow="none"; };
  const switchMode = m => { setMode(m); setError(null); setSent(false); };

  async function handlePassword(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
  }

  async function handleMagicLink(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  async function handleForgot(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  const Logo = () => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:32 }}>
      <div style={{ width:52, height:52, borderRadius:15, background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
        <Ic n="target" s={24} c="#fff"/>
      </div>
      <div style={{ fontWeight:800, fontSize:22, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>Interview OS</div>
      <div style={{ fontSize:11, color:"var(--t3)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:4 }}>Command Center</div>
    </div>
  );

  const ErrorBox = () => error ? (
    <div style={{ padding:"8px 12px", borderRadius:8, background:"var(--red-d)", border:"1px solid var(--red-b)", color:"var(--red)", fontSize:12, marginBottom:14 }}>{error}</div>
  ) : null;

  const SentBox = ({ title, subtitle }) => (
    <div style={{ textAlign:"center", padding:"8px 0" }}>
      <div style={{ width:44, height:44, borderRadius:12, background:"var(--grn-d)", border:"1px solid var(--grn-b)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
        <Ic n="send" s={20} c="var(--grn)"/>
      </div>
      <div style={{ fontWeight:700, fontSize:16, color:"var(--t1)", marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.6 }}>{subtitle} <strong style={{ color:"var(--t1)" }}>{email}</strong></div>
      <button onClick={()=>switchMode("password")} style={{ marginTop:20, background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
        Voltar ao login
      </button>
    </div>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"var(--bg)", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380, animation:"fadeIn 0.3s ease" }}>
        <Logo/>
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:16, padding:28 }}>
          {sent && mode === "magic" && <SentBox title="Link enviado!" subtitle="Verifique seu e-mail em"/>}
          {sent && mode === "forgot" && <SentBox title="E-mail enviado!" subtitle="Verifique as instruções de recuperação em"/>}

          {!sent && mode === "password" && (
            <form onSubmit={handlePassword}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>Entrar</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>Use seu e-mail e senha para acessar.</div>
              <div style={{ marginBottom:12 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>E-mail</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <div style={{ marginBottom:6 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>Senha</label>
                <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <div style={{ textAlign:"right", marginBottom:16 }}>
                <button type="button" onClick={()=>switchMode("forgot")} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11, fontFamily:"'Outfit',sans-serif" }}>
                  Esqueci minha senha
                </button>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim() || !password}>
                {loading ? "Entrando…" : "Entrar"}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={()=>switchMode("magic")} style={{ background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  Entrar sem senha (link mágico)
                </button>
              </div>
            </form>
          )}

          {!sent && mode === "magic" && (
            <form onSubmit={handleMagicLink}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>Link mágico</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>Receba um link de acesso no seu e-mail.</div>
              <div style={{ marginBottom:16 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>E-mail</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim()}>
                {loading ? "Enviando…" : <><Ic n="send" s={14} c="#fff"/>Enviar link</>}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={()=>switchMode("password")} style={{ background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  Voltar ao login com senha
                </button>
              </div>
            </form>
          )}

          {!sent && mode === "forgot" && (
            <form onSubmit={handleForgot}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>Recuperar senha</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>Enviaremos um link para você criar uma nova senha.</div>
              <div style={{ marginBottom:16 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>E-mail</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim()}>
                {loading ? "Enviando…" : <><Ic n="send" s={14} c="#fff"/>Enviar e-mail de recuperação</>}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={()=>switchMode("password")} style={{ background:"none", border:"none", color:"var(--acc)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  Voltar ao login
                </button>
              </div>
            </form>
          )}
        </div>

        <button onClick={onDemo} style={{ width:"100%", marginTop:12, padding:"12px", borderRadius:12, border:"1px dashed var(--border)", background:"transparent", color:"var(--t2)", cursor:"pointer", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:500, transition:"all 0.15s" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-md)";e.currentTarget.style.color="var(--t1)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--t2)";}}
        >
          Ver demonstração sem cadastro →
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;
