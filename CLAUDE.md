# CLAUDE.md — Guia para desenvolvimento assistido por IA

Este arquivo orienta o Claude (e outros assistentes de IA como Cursor, GitHub Copilot) sobre a arquitetura, convenções e contexto do projeto **Interview Command Center**.

---

## Visão geral do projeto

Aplicação React de gestão de processos seletivos para profissionais de tecnologia. O usuário central é um **Senior Full-Stack Engineer / Front-End Tech Lead** que é frequentemente contactado por recrutadores (inbound) e precisa gerenciar múltiplos processos simultaneamente.

**Stack:** React 19 + Vite 6 + Anthropic Claude API (Sonnet 4)

---

## Arquitetura atual

### Arquivo principal

Todo o código vive em `src/App.jsx` — uma escolha intencional para facilitar iterações rápidas com IA. **Não fragmente sem necessidade.** Se a componentização for necessária, veja a seção [Refatoração](#refatoração).

### Design System — Signal DS

O projeto usa um design system próprio chamado **Signal**, aplicado via CSS custom properties injetadas dinamicamente no `document.documentElement`.

**Nunca use valores hardcoded de cor, espaçamento ou tipografia.** Sempre use as variáveis definidas:

```js
// ✅ Correto
style={{ color: "var(--t1)", background: "var(--bg-r)", borderRadius: 14 }}

// ❌ Errado
style={{ color: "#EFEFEF", background: "#17171A" }}
```

#### Tokens de cor disponíveis

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
| `--acc-d` | `rgba(124,106,255,0.14)` | `rgba(91,71,255,0.10)` | Accent dim (backgrounds) |
| `--acc-b` | `rgba(124,106,255,0.30)` | `rgba(91,71,255,0.25)` | Accent border |
| `--grn` | `#22C67A` | `#16A05E` | Success / green |
| `--amb` | `#F5A623` | `#C07A00` | Warning / amber |
| `--red` | `#FF6A6A` | `#CC3333` | Danger / red |
| `--cyan` | `#22D3EE` | `#0891B2` | Cyan (stage "Contactado") |

#### Tokens de stage

Cada stage tem uma cor de barra (`bar`), cor de badge e background/border. Nunca crie cores de stage hardcoded — sempre use `STAGE[stageName]`:

```js
const STAGE = {
  contacted: { label: "Contactado", bar: "#22D3EE", badgeBg: "var(--cyan-d)", ... },
  screening: { label: "Conversa",   bar: "#7C6AFF", ... },
  interview: { label: "Entrevista", bar: "#F5A623", ... },
  technical: { label: "Técnica",    bar: "#A78BFA", ... },
  offer:     { label: "Proposta",   bar: "#22C67A", ... },
  rejected:  { label: "Encerrado",  bar: "#FF6A6A", ... },
  archived:  { label: "Arquivado",  bar: "var(--t3)", ... },
}
```

#### Tipografia

- **Outfit** — todo o UI (labels, botões, texto, headings)
- **JetBrains Mono** — dados numéricos, timestamps, tags, labels técnicos

```js
// Sempre use o objeto T para estilos recorrentes
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
// n = nome do ícone, s = size, c = color
```

Ícones disponíveis: `target`, `pipeline`, `chart`, `archive`, `plus`, `search`, `back`, `star`, `starF`, `edit`, `close`, `trash`, `cal`, `alert`, `copy`, `check`, `refresh`, `send`, `msg`, `ai`, `sun`, `moon`, `linkedin`, `email`, `whatsapp`, `info`.

Para adicionar um novo ícone, adicione no objeto `P` dentro de `Ic`.

### `Btn` — botão

```jsx
<Btn variant="primary" size="md" full onClick={fn}>Texto</Btn>
// variant: primary | secondary | ghost | danger
// size: sm | md | lg
// full: boolean (width: 100%)
```

### `Badge` — badge de stage

```jsx
<Badge stage="interview" />
// Renderiza pill com dot colorido e label do stage
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
  contactedDate: string         // ISO date "YYYY-MM-DD"
  nextStepDate: string | null
  nextStepNote: string
  jobUrl: string
  tags: string[]
  notes: string
  steps: Step[]
  aiContext: string             // reservado para uso futuro
  starred: boolean
}

type Step = {
  date: string                  // ISO date "YYYY-MM-DD"
  type: keyof typeof STAGE
  note: string
}
```

---

## Chamadas à API Anthropic

**Sempre use o modelo `claude-sonnet-4-20250514`.** Não altere sem necessidade — é o modelo calibrado para as tarefas do app.

```js
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // Em produção: use variável de ambiente
    // No artifact do claude.ai: sem x-api-key (injetado automaticamente)
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: systemPrompt,
    messages,
  }),
});
```

Para respostas estruturadas (gerador de respostas), sempre peça JSON sem markdown:

```js
// No system prompt ou na instrução final:
`Responda EXATAMENTE neste JSON (sem markdown, sem texto fora do JSON):
{"body": "mensagem completa aqui"}`

// Parse defensivo:
const raw = data.content?.find(b => b.type === "text")?.text || "{}";
const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
```

---

## Responsividade

O app tem dois layouts completamente separados, determinados por `useIsMobile()` (breakpoint: 768px):

- **Desktop:** sidebar fixa (268px) + painel de detalhe principal
- **Mobile:** header + stack de telas (lista → detalhe) + bottom navigation fixa

**Nunca use media queries CSS** — toda a responsividade é controlada via JS com `useIsMobile()`.

```jsx
const isMobile = useIsMobile();

return isMobile
  ? <MobileLayout ... />
  : <DesktopLayout ... />;
```

---

## Convenções de código

### Nomenclatura
- Componentes: PascalCase (`ProcessCard`, `MessagesTab`)
- Hooks: camelCase com prefixo `use` (`useIsMobile`, `useTheme`)
- Constantes: SCREAMING_SNAKE_CASE (`STAGE`, `CHANNELS`, `ACTIVE_STAGES`)
- Funções utilitárias: camelCase (`fmtDate`, `daysDiff`)

### Estado
- Estado global simples: `useState` no componente raiz + prop drilling
- Não use Context, Redux ou Zustand na versão atual
- Para estado derivado complexo, use `useMemo`

### Efeitos
- `useEffect` apenas para efeitos reais (listeners, injeção de CSS vars)
- Nunca use `useEffect` para transformações de dados — compute direto no render

### Inline styles
O projeto usa 100% inline styles (sem CSS externo, sem Tailwind). Isso é intencional para facilitar a iteração com IA — o estilo fica visível e editável diretamente no JSX.

---

## O que NÃO fazer

- ❌ Não instale novas dependências sem necessidade — o projeto é propositalmente zero-dependency além do React
- ❌ Não quebre o arquivo único em múltiplos sem seguir o plano de componentização do ROADMAP
- ❌ Não use valores de cor hardcoded — sempre use as CSS vars do Signal DS
- ❌ Não adicione `localStorage` sem implementar a estratégia completa de persistência (veja ROADMAP v1.1)
- ❌ Não altere o modelo de IA para versões mais novas sem testar — pode quebrar os prompts calibrados
- ❌ Não adicione autenticação sem implementar o backend proxy de API simultaneamente

---

## Tarefas frequentes

### Adicionar um novo stage

1. Adicione em `STAGE` com `label`, `bar`, `badgeBg`, `badgeColor`, `badgeBorder`
2. Se for um stage ativo, adicione em `ACTIVE_STAGES`
3. Não é necessário atualizar mais nada — os componentes usam `STAGE` dinamicamente

### Adicionar um novo cenário no gerador de respostas

Adicione em `SCENARIOS`:
```js
{ id: "novo_cenario", label: "Label do cenário" }
```

O prompt é construído dinamicamente com base no `id` e `label`.

### Adicionar um novo quick action no AI tab

Adicione no array `quickActions` dentro de `AITab`:
```js
{ label: "Texto do botão", prompt: `Prompt detalhado para a IA...` }
```

### Adicionar um novo ícone

Adicione no objeto `P` dentro de `Ic`:
```jsx
novoIcone: <><path d="..." stroke={c} strokeWidth="1.5" .../></>,
```

---

## Contexto do usuário (para calibrar prompts)

- **Nome:** Fernando
- **Cargo:** Senior Full-Stack Engineer / Front-End Tech Lead
- **Stack principal:** React, Next.js, Node.js, TypeScript, Supabase, Duda CMS
- **Experiência:** 10+ anos, liderança de times
- **Perfil de processo seletivo:** predominantemente inbound — é contactado por recrutadores, não aplica ativamente
- **Canais de comunicação com recrutadores:** LinkedIn (principal), E-mail, WhatsApp
- **Idioma:** português brasileiro em todos os textos e prompts

---

## Histórico de decisões

| Decisão | Motivo |
|---|---|
| Arquivo único `App.jsx` | Facilita iteração rápida com IA — todo contexto em um lugar |
| Inline styles | Sem fricção com CSS externo, fácil de editar por IA |
| Sem localStorage (v1.0) | MVP focado em funcionalidade — persistência planejada para v1.1 |
| Sem backend proxy (v1.0) | Reduz complexidade inicial — documentado como risco em SECURITY.md |
| `useIsMobile` com JS | Permite layouts completamente distintos, não apenas ajustes de estilo |
| Signal DS com CSS vars | Suporta dark/light mode com uma única fonte de verdade |
| Claude Sonnet 4 | Custo-benefício ideal para as tarefas do app (geração de texto, coaching) |
