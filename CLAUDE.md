# CLAUDE.md — Guia para desenvolvimento assistido por IA

Este arquivo orienta o Claude (e outros assistentes de IA) sobre a arquitetura, convenções e estado atual do projeto **Interview Command Center**.

---

## Visão geral do projeto

Aplicação React de gestão de processos seletivos para profissionais de tecnologia. O usuário central é **Fernando**, Senior Full-Stack Engineer / Front-End Tech Lead, frequentemente contactado por recrutadores (inbound) e que precisa gerenciar múltiplos processos simultaneamente.

**Stack completa:**
- **Frontend:** React 19 + Vite 6, deploy na Vercel
- **Banco de dados:** Supabase (PostgreSQL) — projeto `sumzkwjthwcdtjqheehn` (sa-east-1)
- **IA:** Anthropic Claude API (`claude-sonnet-4-20250514`), roteada via Supabase Edge Function
- **CI/CD:** GitHub Actions → Vercel (push em `main` aciona deploy automático)

---

## Arquitetura atual

### Arquivos principais

```
src/
├── App.jsx        # Todo o código da UI — arquivo único intencional (~1500 linhas)
├── supabase.js    # Client Supabase + mapeadores rowToProcess / processToRow
├── main.jsx       # Entry point React
└── index.css      # Reset CSS mínimo (4 linhas)

public/
└── favicon.svg    # Ícone de pipeline roxo (Signal DS accent)

supabase/
└── functions/
    └── anthropic-proxy/
        └── index.ts  # Edge Function — proxy seguro para API Anthropic
```

### Arquivo principal

Todo o código vive em `src/App.jsx` — escolha intencional para facilitar iterações rápidas com IA. **Não fragmente sem necessidade.** Ver seção de dívida técnica no ROADMAP.md.

### Supabase

**Client** criado em `src/supabase.js`:
```js
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

**Mapeadores** — sempre use `rowToProcess(row)` ao ler do banco e `processToRow(p)` ao escrever. O banco usa `snake_case`, o app usa `camelCase`.

**RLS atual:** política `allow_all_anon` — acesso aberto (app single-user sem auth). Quando auth for implementada, trocar para `auth.uid() = user_id`.

**CRUD padrão:**
```js
// Ler
const { data } = await supabase.from("processes").select("*").order("created_at", { ascending: false });

// Criar
await supabase.from("processes").insert(processToRow(p));

// Atualizar
await supabase.from("processes").upsert(processToRow(updated));

// Deletar
await supabase.from("processes").delete().eq("id", id);
```

### Proxy Anthropic (Edge Function)

**Nunca chame a API Anthropic diretamente do frontend.** Todas as chamadas passam pela Edge Function `anthropic-proxy`:

```js
const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || "https://api.anthropic.com/v1/messages";

async function callAI(messages, system) {
  const res = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages }),
  });
  const d = await res.json();
  return d.content?.find(b => b.type === "text")?.text || "Erro.";
}
```

A chave `ANTHROPIC_API_KEY` vive como secret na Edge Function do Supabase, nunca no frontend.

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

Ícones disponíveis: `target`, `pipeline`, `chart`, `archive`, `plus`, `search`, `back`, `star`, `starF`, `edit`, `close`, `trash`, `cal`, `alert`, `copy`, `check`, `refresh`, `send`, `msg`, `ai`, `sun`, `moon`, `linkedin`, `email`, `whatsapp`, `info`.

Para adicionar um novo ícone, adicione no objeto `P` dentro de `Ic`.

### `Btn` — botão

```jsx
<Btn variant="primary" size="md" full onClick={fn}>Texto</Btn>
// variant: primary | secondary | ghost | danger
// size: sm | md | lg
```

### `Badge` — badge de stage

```jsx
<Badge stage="interview" />
```

---

## Modelo de dados

### Process

```ts
type Process = {
  id: string                    // "p" + Date.now()
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
  jobUrl: string
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

Colunas em `snake_case`: `id`, `company`, `role`, `stage`, `location`, `salary`, `recruiter`, `recruiter_email`, `origin`, `contacted_date`, `next_step_date`, `next_step_note`, `job_url`, `tags` (TEXT[]), `notes`, `steps` (JSONB), `ai_context`, `starred`, `created_at`, `updated_at`.

---

## Responsividade

Dois layouts completamente separados, determinados por `useIsMobile()` (breakpoint: 768px):

- **Desktop:** sidebar fixa (268px) + painel de detalhe
- **Mobile:** header + stack de telas (lista → detalhe) + bottom navigation

**Nunca use media queries CSS** — toda a responsividade é controlada via JS.

---

## Variáveis de ambiente

```env
VITE_SUPABASE_URL=https://sumzkwjthwcdtjqheehn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key pública>
VITE_AI_PROXY_URL=https://sumzkwjthwcdtjqheehn.supabase.co/functions/v1/anthropic-proxy
```

Na Vercel, estas variáveis estão configuradas nas Environment Variables do projeto. Localmente, ficam em `.env` (gitignored).

---

## Convenções de código

- Componentes: PascalCase
- Hooks: `use` + camelCase
- Constantes: SCREAMING_SNAKE_CASE
- Funções utilitárias: camelCase (`fmtDate`, `daysDiff`)
- Estado global: `useState` no componente raiz + prop drilling (sem Context/Redux)
- Inline styles 100% — sem CSS externo, sem Tailwind
- Datas: sempre append `"T12:00:00"` ao parsear strings `"YYYY-MM-DD"` para evitar off-by-one de timezone

---

## O que NÃO fazer

- ❌ Não instale dependências novas sem necessidade
- ❌ Não quebre o arquivo único em múltiplos sem necessidade real
- ❌ Não use cores hardcoded — sempre use CSS vars do Signal DS
- ❌ Não chame a API Anthropic diretamente do frontend — use sempre o proxy
- ❌ Não altere o modelo de IA (`claude-sonnet-4-20250514`) sem testar os prompts
- ❌ Não adicione auth sem implementar RLS por `user_id` simultaneamente

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

---

## Histórico de decisões

| Decisão | Motivo |
|---|---|
| Arquivo único `App.jsx` | Facilita iteração rápida com IA — todo contexto em um lugar |
| Inline styles | Sem fricção com CSS externo, fácil de editar por IA |
| RLS aberta (`allow_all_anon`) | App single-user sem auth no MVP — travamento planejado para v1.3 |
| Proxy via Edge Function | Chave Anthropic nunca exposta no bundle do frontend |
| `useIsMobile` com JS | Permite layouts completamente distintos, não apenas ajustes de estilo |
| Signal DS com CSS vars | Suporta dark/light mode com uma única fonte de verdade |
| `claude-sonnet-4-20250514` | Custo-benefício ideal para as tarefas do app |
| Supabase sa-east-1 | Latência reduzida para usuário brasileiro |

---

## Contexto do usuário

- **Nome:** Fernando
- **Cargo:** Senior Full-Stack Engineer / Front-End Tech Lead
- **Stack:** React, Next.js, Node.js, TypeScript, Supabase, Duda CMS
- **Experiência:** 10+ anos, liderança de times
- **Perfil:** predominantemente inbound — é contactado por recrutadores, não aplica ativamente
- **Canais:** LinkedIn (principal), E-mail, WhatsApp
- **Idioma:** português brasileiro em todos os textos e prompts
