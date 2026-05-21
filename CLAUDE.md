# CLAUDE.md — Guia para desenvolvimento assistido por IA

Este arquivo orienta o Claude (e outros assistentes de IA) sobre a arquitetura, convenções e estado atual do projeto **Interview Command Center**.

---

## ⚠️ Regra obrigatória — Atualização de documentação

**Após toda e qualquer implementação, correção ou mudança de comportamento, você DEVE atualizar:**

1. **`CLAUDE.md`** — atualizar seções de arquitetura, convenções, histórico de decisões ou tarefas frequentes que mudaram
2. **`ROADMAP.md`** — marcar itens concluídos como feitos, adicionar novos itens descobertos, atualizar o status das fases
3. **`TESTING.md`** — documentar novos testes criados, cenários cobertos, e atualizar o status de cobertura

Esta regra vale para toda sessão, inclusive quando a mudança parece pequena. Não finalize a tarefa sem atualizar as três documentações.

---

## Visão geral do projeto

Aplicação React de gestão de processos seletivos para profissionais de tecnologia. O usuário central é **Fernando**, Senior Full-Stack Engineer / Front-End Tech Lead, frequentemente contactado por recrutadores (inbound) e que precisa gerenciar múltiplos processos simultaneamente.

**Stack completa:**
- **Frontend:** React 19 + Vite 6, deploy na Vercel
- **Banco de dados:** Supabase (PostgreSQL) — projeto `sumzkwjthwcdtjqheehn` (sa-east-1)
- **Auth:** Supabase Auth — email+senha (principal) + magic link (alternativo) + password reset
- **IA:** Anthropic Claude API (`claude-sonnet-4-20250514`), roteada via Supabase Edge Function
- **CI/CD:** GitHub Actions → Vercel (push em `main` aciona deploy automático)

---

## Arquitetura atual

### Arquivos principais

```
src/
├── App.jsx        # Todo o código da UI — arquivo único intencional (~2600 linhas)
├── supabase.js    # Client Supabase + mapeadores rowToProcess / processToRow
├── main.jsx       # Entry point React
└── index.css      # Reset CSS mínimo + safe area vars

public/
├── favicon.svg    # Ícone de pipeline roxo (Signal DS accent)
├── manifest.json  # PWA manifest (name, icons, theme_color)
├── sw.js          # Service Worker — cache-first assets, network-first navegação
└── icons/
    ├── icon-192.png
    └── icon-512.png

supabase/
└── functions/
    └── anthropic-proxy/
        └── index.ts  # Edge Function — proxy autenticado para API Anthropic

vercel.json         # Build config + security headers (CSP, X-Frame, etc.)
```

### Arquivo principal

Todo o código vive em `src/App.jsx` — escolha intencional para facilitar iterações rápidas com IA. **Não fragmente sem necessidade.** Ver seção de dívida técnica no ROADMAP.md.

### Autenticação

O app usa **Supabase Auth** com o hook `useAuth()` definido em `App.jsx`:

```js
function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = carregando
  const [isRecovery, setIsRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => setSession(error ? null : (data?.session ?? null)))
      .catch(() => setSession(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      setSession(s ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return { session, isRecovery, clearRecovery: () => setIsRecovery(false) };
}
```

**Fluxo de auth:**
- `session === undefined` → spinner (carregando)
- `session === null && !isDemo` → `<LoginScreen>`
- `session !== null || isDemo` → app completo

**LoginScreen** suporta 3 modos: `"password"` (principal), `"magic"` (link por email), `"forgot"` (reset de senha). Também tem botão de **modo demonstração** (`isDemo=true`) que carrega `DEMO_PROCESSES` sem tocar o banco.

**Password recovery:** ao detectar `PASSWORD_RECOVERY` no `onAuthStateChange`, exibe `<SetPasswordModal>`. `clearRecovery()` é chamado apenas após a senha ser salva com sucesso (não imediatamente ao detectar o evento).

### Supabase

**Client** criado em `src/supabase.js` com configuração completa de sessão:
```js
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } }
);
```

**Mapeadores** — sempre use `rowToProcess(row)` ao ler do banco e `processToRow(p)` ao escrever. O banco usa `snake_case`, o app usa `camelCase`.

**RLS ativa com isolamento por usuário.** Quatro políticas `auth.uid() = user_id` em SELECT/INSERT/UPDATE/DELETE. Toda operação de escrita inclui `user_id`:

```js
// Ler
const { data } = await supabase.from("processes").select("*").order("created_at", { ascending: false });

// Criar
const row = { ...processToRow(p), user_id: session?.user?.id };
await supabase.from("processes").insert(row);

// Atualizar — sempre inclua user_id para manter consistência com RLS
await supabase.from("processes").upsert({ ...processToRow(updated), user_id: session?.user?.id });

// Deletar
await supabase.from("processes").delete().eq("id", id);
```

**Erros de banco:** nunca exiba `error.message` diretamente na UI — log no console, mostre mensagem genérica ao usuário.

### Proxy Anthropic (Edge Function)

**Nunca chame a API Anthropic diretamente do frontend.** Todas as chamadas passam pela Edge Function `anthropic-proxy`, que exige JWT válido (`verify_jwt: true`) e aplica rate limiting (20 req/min por usuário).

```js
const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;
// Sem fallback — falha explicitamente se a env var não estiver configurada

async function callAI(messages, system, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages }),
  });
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.error || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.content?.find(b => b.type === "text")?.text || "Erro.";
}
```

**Obter token antes de chamar:**
```js
const { data: { session: s } } = await supabase.auth.getSession();
const reply = await callAI(messages, system, s?.access_token);
```

A chave `ANTHROPIC_API_KEY` vive como secret na Edge Function do Supabase, nunca no frontend. O secret `ALLOWED_ORIGIN` deve ser configurado com o domínio Vercel de produção para restringir CORS.

### Modo demonstração

`isDemo` é um `useState` booleano ativado pelo botão "Ver demonstração" na `LoginScreen`. Quando ativo:
- `DEMO_PROCESSES` (6 processos fake) são carregados em memória — zero chamadas ao Supabase
- Banner âmbar aparece no topo da sidebar/header com botão "Sair"
- Todas as operações de CRUD são bloqueadas por guards `if (!isDemo)` / `if (isDemo)`
- **Não ative `isDemo` em sessões autenticadas** — os guards são aplicados por boolean, não por exclusão mútua com a sessão

---

## Design System — Signal DS

O projeto usa um design system próprio chamado **Signal**, aplicado via CSS custom properties injetadas dinamicamente no `document.documentElement`.

**Nunca use valores hardcoded de cor, espaçamento ou tipografia.** Sempre use as variáveis:

```js
// ✅ Correto
style={{ color: "var(--t1)", background: "var(--bg-r)", borderRadius: 14 }}

// ❌ Errado
style={{ color: "#EFEFEF", background: "#17171A" }}
```

### Tokens de cor

| Var | Dark | Light | Uso |
|---|---|---|---|
| `--bg` | `#111113` | `#FAFAF9` | Background da página |
| `--bg-r` | `#17171A` | `#FFFFFF` | Cards, superfícies elevadas |
| `--bg-o` | `#1C1C20` | `#F4F4F2` | Inputs, overlays |
| `--bg-s` | `#222226` | `#EDEDEB` | Subtle backgrounds |
| `--border` | `rgba(255,255,255,0.07)` | `rgba(0,0,0,0.07)` | Bordas padrão |
| `--border-md` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.12)` | Bordas médias |
| `--t1` | `#EFEFEF` | `#111113` | Texto primário |
| `--t2` | `#9A9AA8` | `#606060` | Texto secundário |
| `--t3` | `#52525C` | `#999990` | Texto muted / labels |
| `--t4` | `#333338` | `#C8C8C0` | Texto ghost / placeholders |
| `--acc` | `#7C6AFF` | `#5B47FF` | Accent violet (primário) |
| `--acc-d` | `rgba(124,106,255,0.14)` | `rgba(91,71,255,0.10)` | Accent dim |
| `--acc-b` | `rgba(124,106,255,0.30)` | `rgba(91,71,255,0.25)` | Accent border |
| `--grn` | `#22C67A` | `#16A05E` | Success |
| `--amb` | `#F5A623` | `#C07A00` | Warning |
| `--red` | `#FF6A6A` | `#CC3333` | Danger |
| `--cyan` | `#22D3EE` | `#0891B2` | Stage "Contactado" |
| `--date-picker-filter` | `invert(1)` | `none` | Filtro do date picker nativo |

### Tokens de stage

```js
const STAGE = {
  contacted: { label: "Contactado", bar: "#22D3EE", ... },
  screening: { label: "Conversa",   bar: "#7C6AFF", ... },
  interview: { label: "Entrevista", bar: "#F5A623", ... },
  technical: { label: "Técnica",    bar: "#A78BFA", ... },
  offer:     { label: "Proposta",   bar: "#22C67A", ... },
  rejected:  { label: "Encerrado",  bar: "#FF6A6A", ... },
  archived:  { label: "Arquivado",  bar: "var(--t3)", ... },
}
```

**Nunca crie cores de stage hardcoded** — sempre use `STAGE[stageName]`.

### Tipografia

- **Outfit** — todo o UI (labels, botões, texto, headings)
- **JetBrains Mono** — dados numéricos, timestamps, tags, labels técnicos

```js
const T = {
  label: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)" },
  mono:  { fontFamily:"'JetBrains Mono',monospace" },
  input: { width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-o)", color:"var(--t1)", fontSize:14, outline:"none", fontFamily:"'Outfit',sans-serif" },
}
```

---

## Primitivos reutilizáveis

### `Ic` — ícone SVG

```jsx
<Ic n="pipeline" s={16} c="var(--acc)" />
// n = nome, s = size, c = color
```

Ícones disponíveis: `target`, `pipeline`, `chart`, `archive`, `plus`, `search`, `back`, `star`, `starF`, `edit`, `close`, `trash`, `cal`, `alert`, `copy`, `check`, `refresh`, `send`, `msg`, `ai`, `sun`, `moon`, `linkedin`, `email`, `whatsapp`, `info`, `logout`.

Para adicionar um novo ícone, adicione no objeto `P` dentro de `Ic`.

### `Btn` — botão

```jsx
<Btn variant="primary" size="md" full onClick={fn}>Texto</Btn>
// variant: primary | secondary | ghost | danger
// size: sm | md | lg
```

`Btn` tem hover state via `useState` interno — não é necessário CSS externo.

### `Badge` — badge de stage

```jsx
<Badge stage="interview" />
```

### `iconBtn()` — helper para botões de ícone

```js
// Gera um objeto de style para botão de ícone 32×32 (desktop) ou 44×44 (mobile)
const iconBtn = (extra={}) => ({
  display:"flex", alignItems:"center", justifyContent:"center",
  width:32, height:32, borderRadius:8, border:"none",
  background:"transparent", cursor:"pointer", transition:"background 0.15s",
  flexShrink:0, ...extra
});

// Uso no desktop (className="icon-btn" para hover via GLOBAL_CSS):
<button className="icon-btn" style={iconBtn()} onClick={fn}>
  <Ic n="edit" s={15} c="var(--t2)"/>
</button>

// Uso no mobile (44px touch target):
<button className="icon-btn" style={iconBtn({ width:44, height:44, borderRadius:10 })} onClick={fn}>
  <Ic n="plus" s={17} c="var(--acc)"/>
</button>
```

---

## Segurança

### Regras obrigatórias

- **Nunca** adicione fallback `|| "https://api.anthropic.com/..."` no `AI_PROXY_URL` — falhe explicitamente
- **Nunca** exiba `error.message` do Supabase diretamente na UI — log no console, mensagem genérica ao usuário
- **Nunca** renderize `<a href={jobUrl}>` sem validar o protocolo: `if (/^https?:\/\//i.test(url))`
- **Sempre** passe `user_id: session?.user?.id` em operações de INSERT e UPSERT

### RLS — Row Level Security

Tabela `processes` tem RLS ativa com 4 políticas por `auth.uid() = user_id`. A coluna `user_id uuid` é FK para `auth.users.id`. Se precisar adicionar uma nova tabela, replique o mesmo padrão de políticas antes de qualquer deploy.

### Edge Function

`anthropic-proxy` está em `supabase/functions/anthropic-proxy/index.ts` e deployada com `verify_jwt: true`. Requer:
- JWT válido no header `Authorization: Bearer <token>`
- Rate limit: 20 req/min por usuário (in-memory no isolate)
- Secret `ANTHROPIC_API_KEY` configurado no Supabase
- Secret `ALLOWED_ORIGIN` configurado com o domínio Vercel de produção

### Headers de segurança

Configurados em `vercel.json` para todas as rotas:
- `Content-Security-Policy` — restringe scripts, conexões (apenas `*.supabase.co`), frames
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — desabilita câmera, microfone, geolocalização

---

## Modelo de dados

### Process

```ts
type Process = {
  id: string                    // crypto.randomUUID()
  company: string
  role: string
  stage: keyof typeof STAGE
  location: string
  salary: string
  recruiter: string
  recruiterEmail: string
  origin: "inbound" | "outbound"
  contactedDate: string         // "YYYY-MM-DD"
  nextStepDate: string | null
  nextStepNote: string
  jobUrl: string                // sempre validar protocolo https?:// antes de renderizar
  tags: string[]
  notes: string
  steps: Step[]
  aiContext: string
  starred: boolean
}

type Step = {
  date: string   // "YYYY-MM-DD"
  type: keyof typeof STAGE
  note: string
}
```

### Tabela Supabase (`processes`)

Colunas em `snake_case`: `id`, `company`, `role`, `stage`, `location`, `salary`, `recruiter`, `recruiter_email`, `origin`, `contacted_date`, `next_step_date`, `next_step_note`, `job_url`, `tags` (TEXT[]), `notes`, `steps` (JSONB), `ai_context`, `starred`, `created_at`, `updated_at`, **`user_id` (UUID, FK → auth.users.id)**.

---

## Responsividade

Dois layouts completamente separados, determinados por `useIsMobile()` (breakpoint: 768px):

- **Desktop:** sidebar fixa (268px) + painel de detalhe
- **Mobile:** header + stack de telas (lista → detalhe) + bottom navigation (min-height 52px)

**Nunca use media queries CSS** — toda a responsividade é controlada via JS.

**Touch targets no mobile:** mínimo 44×44px para todos os botões de ação (usar `iconBtn({ width:44, height:44 })`).

**Filtro de stage:** o estado `stageFilter` (string `"all"` ou nome de stage) é compartilhado entre desktop e mobile via o `filtered` computado no componente raiz.

---

## Variáveis de ambiente

```env
VITE_SUPABASE_URL=https://sumzkwjthwcdtjqheehn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key pública>
VITE_AI_PROXY_URL=https://sumzkwjthwcdtjqheehn.supabase.co/functions/v1/anthropic-proxy
```

Na Vercel, estas variáveis estão configuradas nas Environment Variables do projeto. Localmente, ficam em `.env` (gitignored). **Não adicione valores secretos com prefixo `VITE_`** — eles são embutidos no bundle público.

---

## Convenções de código

- Componentes: PascalCase
- Hooks: `use` + camelCase
- Constantes: SCREAMING_SNAKE_CASE
- Funções utilitárias: camelCase (`fmtDate`, `daysDiff`)
- Estado global: `useState` no componente raiz + prop drilling (sem Context/Redux)
- Inline styles 100% — sem CSS externo, sem Tailwind
- Datas: sempre append `"T12:00:00"` ao parsear strings `"YYYY-MM-DD"` para evitar off-by-one de timezone
- IDs: `crypto.randomUUID()` — nunca `Date.now()` ou sequenciais

---

## Testes

O projeto tem estratégia de testes documentada em `TESTING.md`.

### ⚠️ Regra obrigatória — Testes junto com a funcionalidade

**Toda nova funcionalidade DEVE vir acompanhada de testes na mesma sessão/PR.** Nunca deixe código sem cobertura para "depois". Se o tempo não permitir implementar os testes completos, ao menos documente os cenários no TESTING.md e crie um item no ROADMAP.md com prioridade alta.

**Ao implementar qualquer funcionalidade nova:**
- Se a lógica é uma função pura → unit test em `src/__tests__/unit/`
- Se envolve um componente React → component test em `src/__tests__/components/`
- Se cruza auth, Supabase ou proxy de IA → integration test em `src/__tests__/integration/` com MSW

**Stack:** Vitest + React Testing Library + MSW (unit/integration) / Playwright (E2E).

**Refatorações pendentes antes de testar:**
- Extrair `buildPrompt` de `MessagesTab` → `src/utils/buildPrompt.ts` (após migração TS)
- Extrair `filterProcesses` do App.jsx → `src/utils/filterProcesses.ts` (após migração TS)
- Extrair `checkRateLimit` e `corsHeaders` → `supabase/functions/anthropic-proxy/utils.ts`

**Migração TypeScript planejada para v1.4:** o projeto será componentizado e migrado de `.jsx` para `.tsx` com `strict: true`. Até lá, manter o padrão `.jsx` + inline styles existente. Ver ROADMAP.md para o plano detalhado de componentização.

---

## O que NÃO fazer

- ❌ Não instale dependências novas sem necessidade
- ❌ Não quebre o arquivo único em múltiplos antes da v1.4 — componentização é uma fase dedicada, não patches incrementais
- ❌ Não use cores hardcoded — sempre use CSS vars do Signal DS
- ❌ Não chame a API Anthropic diretamente do frontend — use sempre o proxy com token
- ❌ Não altere o modelo de IA (`claude-sonnet-4-20250514`) sem testar os prompts
- ❌ Não adicione nova tabela sem criar as 4 políticas RLS por `auth.uid() = user_id`
- ❌ Não exiba `error.message` do Supabase diretamente na UI
- ❌ Não renderize links `href` sem validar protocolo `https?://`
- ❌ Não adicione fallback de URL da API Anthropic no frontend

---

## Tarefas frequentes

### Adicionar um novo stage
1. Adicione em `STAGE` com `label`, `bar`, `badgeBg`, `badgeColor`, `badgeBorder`
2. Se for stage ativo, adicione em `ACTIVE_STAGES`

### Adicionar cenário no gerador de respostas
Adicione em `SCENARIOS`:
```js
{ id: "novo_cenario", label: "Label do cenário" }
```

### Aba Currículo — perfil e currículos salvos

O perfil do usuário (`useUserProfile`) é persistido em `localStorage` com a chave `icc-user-profile`:
```js
{ stack: string[], summary: string, cvText: string }
```

Currículos adicionais são persistidos no Supabase via `useResumes(session)`:
```js
// Hook retorna:
{ resumes, loading, add, update, remove, refetch }

// Tabela: resumes (id, user_id, name, content, language, created_at, updated_at)
// RLS: 4 políticas auth.uid() = user_id (igual à tabela processes)
```

`ResumesModal` permite listar, criar, editar e excluir CVs. Suporta upload de PDF com drag & drop — o texto é extraído via `pdfjs-dist` (carregado lazy para não inflar o bundle inicial).

**Worker do pdfjs:** o worker é importado com import estático `?url` no topo do `App.jsx`:
```js
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
// Usar esta var na inicialização lazy:
_pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
```
Nunca use `new URL("...", import.meta.url)` dentro de função assíncrona — o Vite não consegue resolver o padrão em build-time.

O `CVTab` recebe `process`, `profile`, `isMobile`, `resumes` e `onManageResumes`. O fluxo tem 4 etapas: `input` (seleciona CV base + cola JD) → `analyzing` → `review` (checkboxes verde/âmbar) → `result`. A regra de segurança está no system prompt do Claude: tecnologias fora da `stack` do usuário são sinalizadas como "não confirmadas" e só entram no resultado com autorização explícita via checkbox.

### Adicionar quick action no AI tab
Adicione no array `quickActions` dentro de `AITab`:
```js
{ label: "Texto do botão", prompt: `Prompt detalhado...` }
```

### Adicionar novo ícone
Adicione no objeto `P` dentro de `Ic`:
```jsx
novoIcone: <><path d="..." stroke={c} strokeWidth="1.5" /></>,
```

### Adicionar nova tabela ao banco
1. Crie a tabela via `apply_migration` com coluna `user_id uuid references auth.users(id)`
2. Crie as 4 políticas RLS (`users_select_own`, `users_insert_own`, `users_update_own`, `users_delete_own`)
3. Adicione mapeadores `rowToX` e `xToRow` em `supabase.js`

---

## Histórico de decisões

| Decisão | Motivo |
|---|---|
| Arquivo único `App.jsx` | Facilita iteração rápida com IA — todo contexto em um lugar |
| Inline styles | Sem fricção com CSS externo, fácil de editar por IA |
| RLS por `auth.uid() = user_id` | Isolamento real de dados — cada usuário vê apenas seus registros |
| Proxy via Edge Function com JWT | Chave Anthropic nunca exposta; requests sem auth são rejeitados |
| `useIsMobile` com JS | Permite layouts completamente distintos, não apenas ajustes de estilo |
| Signal DS com CSS vars | Suporta dark/light mode com uma única fonte de verdade |
| `crypto.randomUUID()` para IDs | Não enumeráveis, sem colisão, sem vazamento de timing |
| `claude-sonnet-4-20250514` | Custo-benefício ideal para as tarefas do app |
| Supabase sa-east-1 | Latência reduzida para usuário brasileiro |
| Auth email+senha + magic link | Magic link como alternativa; senha evita dependência de email para login recorrente |
| `clearRecovery()` após salvar senha | Evita race condition onde estado some antes do modal montar |
| pdfjs worker via `import ?url` no topo | Vite só resolve `new URL()` em contexto estático; padrão dinâmico falha no build Vercel |
| CI simplificado para `npm run build` | Vercel tem integração nativa com GitHub — o workflow de deploy via Vercel CLI era redundante e quebrava por falta de secrets |
| CVs salvos no Supabase (tabela `resumes`) | Permite múltiplos CVs por idioma, reutilizáveis entre processos diferentes |

---

## Contexto do usuário

- **Nome:** Fernando
- **Cargo:** Senior Full-Stack Engineer / Front-End Tech Lead
- **Stack:** React, Next.js, Node.js, TypeScript, Supabase, Duda CMS
- **Experiência:** 10+ anos, liderança de times
- **Perfil:** predominantemente inbound — é contactado por recrutadores, não aplica ativamente
- **Canais:** LinkedIn (principal), E-mail, WhatsApp
- **Idioma:** português brasileiro em todos os textos e prompts
