import { useState } from "react";
import { supabase } from "../../supabase.js";
import { T } from "../../constants/index.js";
import Ic from "../ui/Ic.jsx";
import Btn from "../ui/Btn.jsx";

export function SetPasswordModal({ onClose, onSuccess }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const inputFocus = e => { e.target.style.borderColor="var(--acc)"; e.target.style.boxShadow="0 0 0 3px var(--acc-d)"; };
  const inputBlur  = e => { e.target.style.borderColor="var(--border)"; e.target.style.boxShadow="none"; };

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    if (password.length < 12) { setError("A senha deve ter pelo menos 12 caracteres."); return; }
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    onSuccess?.();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:24 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"var(--bg-r)", border:"1px solid var(--border)", borderRadius:16, padding:28, width:"100%", maxWidth:380, animation:"slideUp 0.2s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:16, color:"var(--t1)", letterSpacing:"-0.02em" }}>Definir senha</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", padding:4, borderRadius:6 }}><Ic n="close" s={16} c="var(--t3)"/></button>
        </div>
        {done ? (
          <div style={{ textAlign:"center", padding:"8px 0" }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"var(--grn-d)", border:"1px solid var(--grn-b)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <Ic n="check" s={20} c="var(--grn)"/>
            </div>
            <div style={{ fontWeight:700, fontSize:15, color:"var(--t1)", marginBottom:8 }}>Senha definida!</div>
            <div style={{ fontSize:13, color:"var(--t2)", marginBottom:20 }}>Nos próximos acessos use seu e-mail e senha.</div>
            <Btn onClick={onClose}>Fechar</Btn>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>Crie uma senha para entrar diretamente sem precisar de link mágico.</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ ...T.label, display:"block", marginBottom:6 }}>Nova senha</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ ...T.label, display:"block", marginBottom:6 }}>Confirmar senha</label>
              <input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repita a senha" style={{ ...T.input, fontSize:14 }} onFocus={inputFocus} onBlur={inputBlur}/>
            </div>
            {error && <div style={{ padding:"8px 12px", borderRadius:8, background:"var(--red-d)", border:"1px solid var(--red-b)", color:"var(--red)", fontSize:12, marginBottom:14 }}>{error}</div>}
            <Btn full disabled={loading || !password || !confirm}>
              {loading ? "Salvando…" : "Definir senha"}
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}

export default SetPasswordModal;
