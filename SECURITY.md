# Segurança — Interview Command Center

Checklist e referência de segurança. **Revise antes de todo PR.**

---

## Checklist de PR

Antes de abrir ou mergear qualquer PR, verifique:

### Dados e API
- [ ] Nenhuma chamada direta à API Anthropic — usa sempre `callAI()` via proxy
- [ ] `Authorization: Bearer <token>` presente em toda chamada ao proxy
- [ ] `user_id: session?.user?.id` em todo INSERT e UPSERT no Supabase
- [ ] Nenhum `error.message` do Supabase exposto na UI — só log no console

### Links e inputs
- [ ] Todo `<a href={url}>` valida protocolo: `if (/^https?:\/\//i.test(url))`
- [ ] Nenhum dado de usuário renderizado como `dangerouslySetInnerHTML`
- [ ] Inputs de texto não executam código (sem `eval`, sem `Function()`)

### Variáveis de ambiente
- [ ] Nenhum secret com prefixo `VITE_` — valores com esse prefixo são embutidos no bundle público
- [ ] `ANTHROPIC_API_KEY` vive apenas como secret da Edge Function no Supabase
- [ ] `AI_PROXY_URL` sem fallback hardcoded — falha explicitamente se não configurado

### Banco de dados
- [ ] Nova tabela tem as 4 políticas RLS (`auth.uid() = user_id` em SELECT/INSERT/UPDATE/DELETE)
- [ ] Foreign keys com tipos compatíveis (`process_id` é `text`, não `uuid`)
- [ ] Migrations aplicadas via `apply_migration`, não direto no SQL editor

### Autenticação
- [ ] Fluxo de recovery usa `clearRecovery()` só após senha salva com sucesso
- [ ] `session === undefined` exibe spinner (carregando), não tela de login
- [ ] Modo demo não acessa banco — guards `if (isDemo)` em todo CRUD

---

## Modelo de ameaças

| Vetor | Mitigação |
|---|---|
| Chave Anthropic exposta | Edge Function com `verify_jwt: true` — chave nunca sai do servidor |
| Acesso a dados de outro usuário | RLS por `auth.uid() = user_id` em todas as tabelas |
| XSS via conteúdo do recrutador | React escapa HTML por padrão — sem `dangerouslySetInnerHTML` |
| Open redirect via `jobUrl` | Validação `https?://` antes de renderizar `<a>` |
| Abuso do proxy de IA | Rate limit 20 req/min por usuário (in-memory na Edge Function) |
| CSRF | Supabase Auth usa tokens Bearer — não usa cookies de sessão |
| Clickjacking | `X-Frame-Options: DENY` em `vercel.json` |
| MIME sniffing | `X-Content-Type-Options: nosniff` em `vercel.json` |
| Referrer leak | `Referrer-Policy: strict-origin-when-cross-origin` em `vercel.json` |

---

## RLS — padrão obrigatório para toda tabela nova

```sql
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON nome_tabela
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own" ON nome_tabela
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own" ON nome_tabela
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own" ON nome_tabela
  FOR DELETE USING (auth.uid() = user_id);
```

---

## Edge Function

`supabase/functions/anthropic-proxy/index.ts` — `verify_jwt: true`

Rejeita: requests sem JWT, tokens expirados, >20 req/min por usuário.

**Secrets obrigatórios:**
- `ANTHROPIC_API_KEY`
- `ALLOWED_ORIGIN` — domínio Vercel de produção

---

## Pendências de ação manual

| Item | Onde | Prioridade |
|---|---|---|
| Configurar `ALLOWED_ORIGIN` na Edge Function | Supabase → Edge Functions → Secrets | 🔴 Alta |
| Aumentar senha mínima para 12 chars | Supabase → Auth → Password settings | 🔴 Alta |
| Rate limiting persistente (Supabase KV) | Edge Function | 🟡 Média |

---

## Regras para código gerado por IA

1. Nunca chamar `https://api.anthropic.com` diretamente — sempre via proxy
2. Nunca expor `error.message` na UI — log no console, mensagem genérica ao usuário
3. Nunca renderizar `<a href={var}>` sem validar `https?://`
4. Nunca INSERT/UPSERT sem `user_id: session?.user?.id`
5. Nunca criar tabela sem RLS — aplicar as 4 políticas na mesma migration
6. Nunca prefixar secrets com `VITE_`
