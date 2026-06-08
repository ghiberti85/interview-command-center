import { useState } from "react";
import { supabase } from "../../supabase.js";
import { T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

const STRINGS = {
  en: {
    tagline: "Command Center",
    signIn: "Sign in",
    signInSub: "Enter your email and password to access.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    forgotLink: "Forgot password?",
    signingIn: "Signing in…",
    signInBtn: "Sign in",
    magicLink: "Sign in without password",
    magicTitle: "Magic link",
    magicSub: "We'll send a sign-in link to your email.",
    sendLink: "Send link",
    sending: "Sending…",
    backToPassword: "Back to password login",
    forgotTitle: "Reset password",
    forgotSub: "We'll send you a link to create a new password.",
    sendReset: "Send reset email",
    sentMagicTitle: "Link sent!",
    sentMagicSub: "Check your inbox at",
    sentForgotTitle: "Email sent!",
    sentForgotSub: "Check the recovery instructions at",
    backToLogin: "Back to login",
    demo: "Try a demo without signing up →",
    invalidCreds: "Invalid email or password.",
    langToggle: "Português",
  },
  pt: {
    tagline: "Command Center",
    signIn: "Entrar",
    signInSub: "Use seu e-mail e senha para acessar.",
    emailLabel: "E-mail",
    emailPlaceholder: "seu@email.com",
    passwordLabel: "Senha",
    forgotLink: "Esqueci minha senha",
    signingIn: "Entrando…",
    signInBtn: "Entrar",
    magicLink: "Entrar sem senha (link mágico)",
    magicTitle: "Link mágico",
    magicSub: "Receba um link de acesso no seu e-mail.",
    sendLink: "Enviar link",
    sending: "Enviando…",
    backToPassword: "Voltar ao login com senha",
    forgotTitle: "Recuperar senha",
    forgotSub: "Enviaremos um link para você criar uma nova senha.",
    sendReset: "Enviar e-mail de recuperação",
    sentMagicTitle: "Link enviado!",
    sentMagicSub: "Verifique seu e-mail em",
    sentForgotTitle: "E-mail enviado!",
    sentForgotSub: "Verifique as instruções de recuperação em",
    backToLogin: "Voltar ao login",
    demo: "Ver demonstração sem cadastro →",
    invalidCreds: "E-mail ou senha incorretos.",
    langToggle: "English",
  },
};

export function LoginScreen({ onDemo }) {
  const [lang, setLang]       = useState("en");
  const [mode, setMode]       = useState("password");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const s = STRINGS[lang];
  const switchMode = m => { setMode(m); setError(null); setSent(false); };
  const toggleLang = () => { setLang(l => l === "en" ? "pt" : "en"); setError(null); };

  const inputFocus = e => { e.target.style.borderColor="var(--acc)"; e.target.style.boxShadow="0 0 0 3px var(--acc-d)"; };
  const inputBlur  = e => { e.target.style.borderColor="var(--border)"; e.target.style.boxShadow="none"; };

  async function handlePassword(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(err.message === "Invalid login credentials" ? s.invalidCreds : err.message);
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

  const ErrorBox = () => error ? (
    <div style={{ padding:"8px 12px", borderRadius:8, background:"var(--red-d)", border:"1px solid var(--red-b)", color:"var(--red)", fontSize:12, marginBottom:14 }}>{error}</div>
  ) : null;

  const SentBox = ({ title, subtitle }) => (
    <div style={{ textAlign:"center", padding:"8px 0" }}>
      <div style={{ width:44, height:44, borderRadius:12, background:"var(--grn-d)", border:"1px solid var(--grn-b)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
        <Ic n="send" s={20} c="var(--grn)"/>
      </div>
      <div style={{ fontWeight:700, fontSize:16, color:"var(--t1)", marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.6 }}>
        {subtitle} <strong style={{ color:"var(--t1)" }}>{email}</strong>
      </div>
      <button onClick={() => switchMode("password")} style={{ marginTop:20, background:"none", border:"none", color:"var(--acc-text)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
        {s.backToLogin}
      </button>
    </div>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100dvh", background:"var(--bg)", padding:"24px 16px", position:"relative" }}>

      {/* Language toggle — top right */}
      <button
        onClick={toggleLang}
        style={{ position:"fixed", top:16, right:16, display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:20, border:"1px solid var(--border-md)", background:"var(--bg-s)", color:"var(--t2)", fontSize:11, fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.04em", cursor:"pointer", transition:"all 0.15s", zIndex:10 }}
        onMouseEnter={e => { e.currentTarget.style.color="var(--t1)"; e.currentTarget.style.borderColor="var(--border-str)"; }}
        onMouseLeave={e => { e.currentTarget.style.color="var(--t2)"; e.currentTarget.style.borderColor="var(--border-md)"; }}
        title={lang === "en" ? "Mudar para Português" : "Switch to English"}
      >
        <span style={{ fontSize:13 }}>{lang === "en" ? "🇧🇷" : "🇺🇸"}</span>
        {s.langToggle}
      </button>

      <div style={{ width:"100%", maxWidth:380, animation:"fadeIn 0.3s ease" }}>

        {/* Logo */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:32 }}>
          <div style={{ width:52, height:52, borderRadius:15, background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
            <Ic n="pipeline" s={24} c="#fff"/>
          </div>
          <div style={{ fontWeight:800, fontSize:22, color:"var(--t1)", letterSpacing:"-0.03em", fontFamily:"'Outfit',sans-serif" }}>Interview OS</div>
          <div style={{ fontSize:11, color:"var(--t3)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:4 }}>{s.tagline}</div>
        </div>

        {/* Card */}
        <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:16, padding:"28px 24px" }}>

          {sent && mode === "magic"  && <SentBox title={s.sentMagicTitle}  subtitle={s.sentMagicSub}  />}
          {sent && mode === "forgot" && <SentBox title={s.sentForgotTitle} subtitle={s.sentForgotSub} />}

          {!sent && mode === "password" && (
            <form onSubmit={handlePassword}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>{s.signIn}</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>{s.signInSub}</div>
              <div style={{ marginBottom:12 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>{s.emailLabel}</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder={s.emailPlaceholder} style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <div style={{ marginBottom:6 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>{s.passwordLabel}</label>
                <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <div style={{ textAlign:"right", marginBottom:16 }}>
                <button type="button" onClick={() => switchMode("forgot")} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11, fontFamily:"'Outfit',sans-serif" }}>
                  {s.forgotLink}
                </button>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim() || !password}>
                {loading ? s.signingIn : s.signInBtn}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={() => switchMode("magic")} style={{ background:"none", border:"none", color:"var(--acc-text)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  {s.magicLink}
                </button>
              </div>
            </form>
          )}

          {!sent && mode === "magic" && (
            <form onSubmit={handleMagicLink}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>{s.magicTitle}</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>{s.magicSub}</div>
              <div style={{ marginBottom:16 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>{s.emailLabel}</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder={s.emailPlaceholder} style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim()}>
                {loading ? s.sending : <><Ic n="send" s={14} c="#fff"/>{s.sendLink}</>}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={() => switchMode("password")} style={{ background:"none", border:"none", color:"var(--acc-text)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  {s.backToPassword}
                </button>
              </div>
            </form>
          )}

          {!sent && mode === "forgot" && (
            <form onSubmit={handleForgot}>
              <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:4, letterSpacing:"-0.02em" }}>{s.forgotTitle}</div>
              <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>{s.forgotSub}</div>
              <div style={{ marginBottom:16 }}>
                <label style={{ ...T.label, display:"block", marginBottom:6 }}>{s.emailLabel}</label>
                <input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder={s.emailPlaceholder} style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
              </div>
              <ErrorBox/>
              <Btn full disabled={loading || !email.trim()}>
                {loading ? s.sending : <><Ic n="send" s={14} c="#fff"/>{s.sendReset}</>}
              </Btn>
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button type="button" onClick={() => switchMode("password")} style={{ background:"none", border:"none", color:"var(--acc-text)", cursor:"pointer", fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                  {s.backToLogin}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Demo button */}
        <button
          onClick={onDemo}
          style={{ width:"100%", marginTop:12, padding:"12px", borderRadius:12, border:"1px dashed var(--border)", background:"transparent", color:"var(--t2)", cursor:"pointer", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:500, transition:"all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor="var(--border-md)"; e.currentTarget.style.color="var(--t1)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)";    e.currentTarget.style.color="var(--t2)"; }}
        >
          {s.demo}
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;
