# CLAUDE.md — Guia para desenvolvimento assistido por IA

Este arquivo orienta o Claude (e outros assistentes de IA) sobre a arquitetura, convenções e estado atual do projeto **Interview Command Center**.

---

## ⚠️ Regras obrigatórias de engenharia

### 1. Testes antes de qualquer entrega

**Toda nova funcionalidade DEVE ter testes na mesma sessão/PR:**
- Lógica pura → unit test em `src/__tests__/unit/`
- Componente React → component test em `src/__tests__/components/`
- Integração com Supabase/proxy IA → integration test em `src/__tests__/integration/` com MSW

**Antes de commitar:** rode `npm run test:run` e certifique-se de que todos os testes passam. Nunca envie código com testes falhando.

**Se remover uma funcionalidade:** remova também os testes correspondentes e atualize os testes que dependiam do comportamento antigo.

### 2. Fluxo obrigatório para cada mudança

```
1. Implementar a mudança
2. Escrever/atualizar testes (npm run test:run — zero falhas)
3. npm run build (zero erros)
4. git commit com mensagem descritiva
5. git push para a branch de sessão E para main
6. Abrir PR (se não existir) e fazer merge
7. Confirmar deploy na Vercel
8. Atualizar CLAUDE.md + ROADMAP.md + TESTING.md
```

### 3. Atualização de documentação

**Após toda implementação, correção ou mudança de comportamento:**

1. **`CLAUDE.md`** — atualizar arquitetura, convenções, histórico de decisões, tarefas frequentes
2. **`ROADMAP.md`** — marcar itens concluídos, adicionar itens descobertos, atualizar status das fases
3. **`TESTING.md`** — documentar novos testes, cenários cobertos, status de cobertura

### 4. Limpeza ao remover funcionalidades

Ao remover uma feature, **obrigatoriamente** remova também:
- Arquivos de componentes/hooks/utils que não são mais usados
- Testes dos componentes removidos
- Referências na documentação (CLAUDE.md, ROADMAP.md, TESTING.md)
- Imports órfãos em outros arquivos

### 5. Segurança — regras invioláveis

- **Nunca** adicione fallback `|| "https://api.anthropic.com/..."` no `AI_PROXY_URL`
- **Nunca** exiba `error.message` do Supabase diretamente na UI
- **Nunca** renderize `<a href={jobUrl}>` sem validar protocolo `https?://`
- **Sempre** passe `user_id: session?.user?.id` em INSERT e UPSERT
- **Nunca** chame a API Anthropic diretamente do frontend — use sempre o proxy com JWT
- **Nunca** adicione nova tabela sem criar as 4 políticas RLS (`auth.uid() = user_id`)

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

### Estrutura de arquivos

```
src/
├── App.jsx                    # Orquestrador — estado global + lógica de negócio (~426 linhas)
├── supabase.js                # Client Supabase + mapeadores rowToProcess / processToRow
├── main.jsx                   # Entry point React
├── index.css                  # Reset CSS mínimo + safe area vars
│
├── components/
│   ├── ui/                    # Primitivos do Signal DS
│   │   ├── Ic.jsx             # Ícone SVG inline
│   │   ├── Btn.jsx            # Botão com variantes (primary/secondary/ghost/danger)
│   │   └── Badge.jsx          # Badge de stage colorido
│   ├── process/               # Elementos de processo seletivo
│   │   ├── ProcessCard.jsx    # Card na lista (com swipe to archive no mobile)
│   │   ├── PipelineBar.jsx    # Barra de progresso do pipeline
│   │   ├── InlineTags.jsx     # Tags editáveis inline
│   │   └── Tabs.jsx           # Navegação de abas do processo
│   ├── tabs/                  # Conteúdo das abas do processo (3 abas)
│   │   ├── ConversaTab.jsx    # Thread de conversa: mensagens do recrutador + respostas geradas
│   │   ├── VagaTab.jsx        # Dados da vaga + próxima etapa com auto-stage + notas
│   │   └── CVTab.jsx          # Adaptação de currículo por JD
│   ├── layout/                # Estrutura de tela
│   │   ├── Dashboard.jsx      # Dashboard desktop + mobile (painel de métricas)
│   │   └── ProcessDetail.jsx  # Painel de detalhes (desktop sidebar + mobile screen)
│   ├── auth/
│   │   └── LoginScreen.jsx    # Login (senha / magic link / forgot password + demo)
│   └── modals/
│       ├── NewProcessModal.jsx
│       ├── SetPasswordModal.jsx
│       ├── ProfileSetupModal.jsx  # upload de PDF na aba "CV Completo" (pdfjs lazy)
│       ├── ResumesModal.jsx
│       ├── ImportModal.jsx        # importação genérica: JSON/CSV/PDF/ZIP/texto colado
│       └── RecruiterMessageModal.jsx  # colar msg LinkedIn → IA extrai campos → cria processo + draft
│
├── hooks/
│   ├── useAuth.js             # Sessão Supabase + detecção PASSWORD_RECOVERY
│   ├── useIsMobile.js         # Breakpoint 768px via ResizeObserver
│   ├── useTheme.js            # Dark/light com persistência localStorage
│   ├── useUserProfile.js      # Perfil (stack, resumo, CV base) em localStorage
│   ├── useResumes.js          # CRUD de currículos na tabela `resumes` do Supabase
│   └── useCVAdaptations.js    # CRUD de adaptações de CV na tabela `cv_adaptations`
│
├── constants/
│   └── index.js               # DARK_VARS, LIGHT_VARS, GLOBAL_CSS, DEMO_PROCESSES, T, iconBtn
│
├── utils/
│   ├── constants.js           # STAGE, ACTIVE_STAGES
│   ├── sort.js                # sortProcesses (urgencia/empresa/stage/recente)
│   ├── filterProcesses.js     # filterProcesses (busca + filtro de stage)
│   ├── dateUtils.js           # fmtDate, daysDiff
│   └── buildPrompt.js         # buildCVPrompt para o CVTab
│
└── lib/
    └── ai.js                  # callAI — helper de chamada ao proxy Anthropic

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

`App.jsx` é o orquestrador: mantém o estado global (`processes`, `selected`, `view`, `session`, etc.), funções de CRUD e a composição do layout. A lógica de UI foi extraída para os módulos acima. **Não fragmente `App.jsx` além do necessário** — ele deve permanecer legível como entry point.

### Autenticação

O app usa **Supabase Auth** com o hook `useAuth()` em `src/hooks/useAuth.js`:

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
| `--acc` | `#7C6AFF` | `#5B47FF` | Accent violet (fills: botões, nav ativo) |
| `--acc-text` | `#B0A5FF` | `#5B47FF` | Accent violet para texto — contraste WCAG AA |
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

> As regras de segurança invioláveis estão na seção **Regras obrigatórias de engenharia** no topo deste arquivo.

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

### Tabela Supabase (`cv_adaptations`)

Colunas: `id` (uuid PK), `user_id` (uuid FK → auth.users), `process_id` (text FK → processes.id ON DELETE CASCADE), `content` (text — CV adaptado gerado), `jd_snapshot` (text nullable — JD usada), `qa_answers` (jsonb nullable — respostas do Q&A), `created_at`, `updated_at` (trigger automático).

4 políticas RLS: SELECT/INSERT/UPDATE/DELETE com `auth.uid() = user_id`.

Mappers: `rowToCVAdaptation(row)` e `cvAdaptationToRow(a)` em `supabase.js`.

### Storage (`cv-files`)

Bucket privado para uploads de PDF de currículo base. Path: `{user_id}/base/{resume_id}.pdf`.
Políticas de leitura/escrita: `auth.uid()::text = (storage.foldername(name))[1]`.

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

O projeto tem estratégia de testes documentada em `TESTING.md`. As regras de cobertura obrigatória estão na seção **Regras obrigatórias de engenharia** no topo deste arquivo.

**Stack atual:** Vitest + React Testing Library + MSW (unit/integration) / Playwright (E2E planejado).

**Estado atual:** 253 testes passando (unit + component + integration). CI roda `npm run test:run` antes do `npm run build` em todo PR e push para `main`.

---

## O que NÃO fazer

- ❌ Não instale dependências novas sem necessidade
- ❌ Não use cores hardcoded — sempre use CSS vars do Signal DS
- ❌ Não chame a API Anthropic diretamente do frontend — use sempre o proxy com token
- ❌ Não altere o modelo de IA (`claude-sonnet-4-20250514`) sem testar os prompts
- ❌ Não adicione nova tabela sem criar as 4 políticas RLS por `auth.uid() = user_id`
- ❌ Não exiba `error.message` do Supabase diretamente na UI
- ❌ Não renderize links `href` sem validar protocolo `https?://`
- ❌ Não adicione fallback de URL da API Anthropic no frontend
- ❌ Não faça commit com testes falhando — rode `npm run test:run` antes
- ❌ Não remova funcionalidades sem remover os testes e imports correspondentes
- ❌ Não faça deploy sem PR + merge documentado

---

## Tarefas frequentes

### Adicionar um novo stage
1. Adicione em `STAGE` com `label`, `bar`, `badgeBg`, `badgeColor`, `badgeBorder`
2. Se for stage ativo, adicione em `ACTIVE_STAGES`
3. Atualize `STAGE_ORDER` em `sortProcesses` se quiser controlar a ordenação

### Ordenação da lista

`sortProcesses(list, sortBy)` é uma função pura exportada acima do componente raiz. Valores de `sortBy`:
- `"urgencia"` — `nextStepDate` mais próxima primeiro (nulls por último)
- `"empresa"` — alfabético por `company` (case-insensitive)
- `"stage"` — ordem do pipeline definida em `STAGE_ORDER`
- `"recente"` — `contactedDate` mais recente primeiro

O estado `sortBy` vive no App root junto com `search` e `stageFilter`.

### Canal do primeiro contato

`channel` é um campo do tipo `text` na tabela `processes` (nullable). Valores: `"linkedin"` | `"email"` | `"whatsapp"` | `"indicacao"` | `""`.

Mapeadores já tratam: `rowToProcess` → `channel: row.channel || ""`, `processToRow` → `channel: p.channel || null`.

A constante `CONTACT_CHANNELS` define os valores disponíveis com label e ícone. O seletor aparece no `VagaTab` (somente quando `origin === "inbound"`) e no `NewProcessModal`.

### Tags editáveis inline

`InlineTags` é um componente standalone que recebe `process` e `onUpdate`. Renderiza tags com botão × para remover e input inline para adicionar. Chama `onUpdate` diretamente. Usado no `VagaTab`.

### Swipe to archive (mobile)

`ProcessCard` aceita props opcionais `isMobile` e `onSwipeAction`. Quando `isMobile=true`, touch handlers rastreiam o drag horizontal — swipe ≥ 80px para a esquerda aciona `onSwipeAction`. A lista mobile passa `onSwipeAction={()=>updateProcess({...p,stage:"rejected"})}` para cada card.

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
| `ImportModal` genérico substituindo `ImportChatGPTModal` | Suporta múltiplos formatos (JSON/CSV/PDF/ZIP/texto) sem prender o usuário ao ChatGPT |
| `importHelpers.js` separado do modal | Funções puras (`parseCSV`, `normalizeProcess`, etc.) ficam testáveis sem montar o componente |
| `RecruiterMessageModal` independente do `NewProcessModal` | Fluxo completamente diferente — Cole→Extrair→Revisar→Criar não cabe como tab do modal existente |
| CVTab com Q&A em vez de checkboxes de tech | Mais intuitivo e gera contexto rico: a pergunta é direta ("Você usou X?") e a resposta vai no payload da 2ª chamada IA |
| Duas chamadas IA no CVTab (perguntas → CV) | Separa responsabilidades — usuário revisa antes da geração final; evita CV com techs não confirmadas |
| `cv_adaptations.content` como text, não arquivo | Conteúdo gerado por IA não precisa de Storage — o usuário pode copiar e exportar manualmente |
| `process_id` em `cv_adaptations` como `text` | Coluna `id` da tabela `processes` é `text`, não `uuid` — FK deve ter tipo compatível |
| Integração ICC→DIL via query params, sem banco | Unidirecional e zero acoplamento — ICC abre DIL com `?role=&company=&stack=` e DIL lê sem depender de API compartilhada |
| `buildDILUrl` em `OverviewTab` usa tags como stack | Tags já representam as tecnologias do processo; reutilizá-las evita campo extra e mantém o modelo de dados simples |
| `RecruiterMessageModal` 3 etapas em vez de 4 | `paste→working→result` — review e draft colapsados; draft gerado em paralelo com a exibição dos campos; menos friction |
| Draft do recruiter em plain text, não JSON | `DRAFT_SYSTEM` explícito retorna só o texto — elimina parse frágil que causava draft vazio em produção |
| `initialMsg` prop no `RecruiterMessageModal` | Permite pré-preencher a mensagem via `EmptyState` ou qualquer outro ponto de entrada sem estado global extra |
| `EmptyState` com área de cole inline | Primeira ação do usuário (colar mensagem LinkedIn) está disponível diretamente na tela inicial, sem precisar abrir modal |
| 3 abas em vez de 5 (Conversa / Vaga / Currículo) | Reduz complexidade cognitiva — Overview + Timeline + Messages + AI colapsados em 2 abas naturais |
| `ConversaTab` como thread cronológico | Mensagem do recrutador + resposta gerada ficam no mesmo contexto visual — mais natural que abas separadas |
| `VagaTab` com auto-stage via meeting type | Selecionar o tipo da próxima etapa já atualiza o stage — zero esforço para manter o pipeline sincronizado |
| Cards sem preview de nota | Menos ruído visual — a nota fica na aba Vaga, não no card da lista |
| `buildDILUrl` movido para `VagaTab` | Segue o componente que exibe dados da vaga — mais coeso que ficar no OverviewTab removido |

---

## Contexto do usuário

- **Nome:** Fernando
- **Cargo:** Senior Full-Stack Engineer / Front-End Tech Lead
- **Stack:** React, Next.js, Node.js, TypeScript, Supabase, Duda CMS
- **Experiência:** 10+ anos, liderança de times
- **Perfil:** predominantemente inbound — é contactado por recrutadores, não aplica ativamente
- **Canais:** LinkedIn (principal), E-mail, WhatsApp
- **Idioma:** português brasileiro em todos os textos e prompts
