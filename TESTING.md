# Estratégia de Testes — Interview Command Center

Plano completo de testes para o projeto, baseado na análise do código atual.

---

## 1. Diagnóstico atual

**Estado:** zero cobertura. Não há runner, scripts de teste, dependências ou mocks configurados. Apenas ESLint como análise estática.

**Implicações:**
- Funções puras (`fmtDate`, `daysDiff`, `rowToProcess`, `processToRow`) são testáveis imediatamente — ponto de entrada mais fácil
- `callAI` e chamadas Supabase estão misturadas ao código dos componentes, sem camadas de abstração — aumenta o esforço de mock
- O arquivo único `App.jsx` não impede testes, mas exige **3 extrações mínimas** de funções antes de cobrir os casos de maior valor (ver seção 6)

---

## 2. Stack recomendada

| Ferramenta | Papel | Motivo |
|---|---|---|
| **Vitest** | Runner principal | Integração nativa com Vite, suporte a ES modules, API compatível com Jest, modo `jsdom` |
| **React Testing Library** | Testes de componente | Testa comportamento visível, não implementação; funciona com inline styles |
| **@testing-library/user-event** | Interações realistas | Simula foco, digitação caractere a caractere, eventos de teclado |
| **MSW** | Mock de rede | Intercepta `fetch` na camada de rede — cobre Supabase e AI proxy com um único mecanismo |
| **Playwright** | E2E | Suporte a múltiplos browsers, viewport mobile, múltiplos tabs (magic link), clipboard API |
| **@vitest/coverage-v8** | Cobertura | Sem dependência extra, relatório lcov para integração futura com CI |

---

## 3. Pirâmide de testes

```
         /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
        /    E2E  (8)      \    Playwright — fluxos críticos reais
       /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
      /  Integration (18)    \  RTL + MSW — Supabase e proxy mockados
     /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
    /      Unit  (35+)         \  Vitest puro — funções e componentes isolados
   /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

**Proporção:** 60% unit / 30% integration / 10% E2E.

Justificativa: a lógica de negócio (mapeadores, filtros, cálculos de data, prompt builder) tem ROI imediato em unit tests. O E2E cobre fluxos que seriam caros de mockar, como redirect de auth e clipboard.

---

## 4. Casos de teste por camada

### 4.1 Unit tests — funções puras

#### `fmtDate`

```
fmtDate("2026-05-20") → "20 mai."
fmtDate(null)         → "—"
fmtDate("")           → "—"
fmtDate("2026-01-01") → "01 jan."  — confirmar que sufixo T12:00:00 evita off-by-one de timezone
```

> **Crítico:** sem `T12:00:00`, `new Date("2026-05-20")` retorna meia-noite UTC, que em UTC-3 cai no dia 19. O teste deve garantir que o resultado nunca é o dia anterior.

#### `daysDiff`

Requer `vi.setSystemTime` para fixar "hoje".

```
daysDiff(null)         → null
daysDiff(hoje)         → 0
daysDiff(amanhã)       → 1
daysDiff(ontem)        → -1
daysDiff("2026-05-22") → 2  (com hoje fixado em 2026-05-20)
```

#### `rowToProcess` — `src/supabase.js`

```
campo completo:
  row.recruiter_email  → processo.recruiterEmail
  row.contacted_date   → processo.contactedDate
  row.next_step_date   → processo.nextStepDate
  row.starred = true   → processo.starred === true

campos ausentes/nulos:
  sem recruiter_email  → ""
  sem tags             → []
  sem steps            → []
  sem starred          → false
  sem origin           → "inbound"
```

#### `processToRow` — `src/supabase.js`

```
round-trip: processToRow(rowToProcess(row)) reproduz snake_case original
jobUrl         → job_url
recruiterEmail → recruiter_email
nextStepDate   → next_step_date (null quando vazio, não "")
contactedDate  → contacted_date (null quando vazio)
```

#### `buildPrompt` *(extrair de `MessagesTab` antes de testar)*

```
channel="linkedin", origin="inbound"  → contém '"""' (bloco do recrutador) e JSON {"body":"..."}
channel="email"                       → contém {"subject":"assunto","body":"..."}
origin="outbound"                     → contém "Fernando se candidatou ativamente"
origin="inbound"                      → contém "Fernando foi contactado pelo recrutador"
sem recruiterMsg                      → NÃO contém '"""'
```

#### `filterProcesses` *(extrair do `App.jsx` linha ~1294 antes de testar)*

```
busca "nubank"          → retorna apenas processos com company "Nubank"
busca "react"           → retorna processos com tags incluindo "react"
stageFilter="interview" → retorna apenas stage interview
stageFilter="all" + ""  → retorna todos
busca vazia + "offer"   → apenas offers
busca case-insensitive  → "NUBANK" encontra "Nubank"
```

#### Urgência (`daysDiff` aplicado a `nextStepDate`)

```
diff = 0  → urgente
diff = 1  → urgente
diff = 2  → urgente
diff = 3  → não urgente
diff = -1 → não urgente
diff = null → não urgente
```

#### Constantes — `STAGE` e `ACTIVE_STAGES`

```
STAGE tem exatamente as chaves: contacted, screening, interview, technical, offer, rejected, archived
Todo entry de STAGE tem: label, bar, badgeBg, badgeColor, badgeBorder
ACTIVE_STAGES tem 5 itens
ACTIVE_STAGES não contém "rejected" nem "archived"
Todo item de ACTIVE_STAGES existe em STAGE
```

#### Edge Function — `checkRateLimit` *(extrair para `utils.ts` antes de testar)*

```
1ª chamada de "user1"              → true
20ª chamada de "user1" no minuto   → true
21ª chamada                        → false
após reset de 60s (vi.setSystemTime) → true
"user1" não afeta limite de "user2"
```

#### Edge Function — `corsHeaders`

```
ALLOWED_ORIGIN="*", origin="https://app.com"          → retorna origin como Allow-Origin
ALLOWED_ORIGIN="https://app.com", origin="evil.com"   → retorna ALLOWED_ORIGIN, não o origin malicioso
```

---

### 4.2 Component tests (RTL)

#### `Badge`

```
<Badge stage="interview"/> → texto "Entrevista"
<Badge stage="offer"/>     → texto "Proposta"
<Badge stage="rejected"/>  → texto "Encerrado"
<Badge stage="xyz"/>       → fallback sem crash
Badge renderiza dot (border-radius 50%)
```

#### `Btn`

```
variant="primary"  → renderiza e chama onClick ao clicar
disabled           → tem atributo disabled; onClick não é chamado
variant="danger"   → smoke test sem crash
size sm/md/lg      → smoke test sem crash
children renderizado corretamente
```

#### `Ic`

```
<Ic n="plus" s={16} c="red"/> → SVG com width=16 height=16
ícone desconhecido             → renderiza sem crash
```

#### `ProcessCard`

```
Renderiza company, role, Badge correto para o stage
nextStepDate=hoje (diff=0) → indicador urgente visível
starred=true               → ícone starF visível
tags=["react","typescript","node"] → exibe apenas as 2 primeiras
onClick → chama callback
selected=true vs false → border diferente visualmente
```

#### `Tabs`

```
active="a" → botão "a" com fontWeight 600
clicar tab "b" → onChange chamado com "b"
```

#### `LoginScreen`

```
Modo "password": formulário email + senha visível
Botão "Entrar" desabilitado sem credenciais
Botão habilitado com email + senha preenchidos
Clicar "Entrar sem senha"     → modo "magic"
Clicar "Esqueci minha senha"  → modo "forgot"
Clicar "Voltar ao login"      → volta para "password"
Submit com credenciais inválidas (MSW → erro) → "E-mail ou senha incorretos."
Submit magic link com sucesso (MSW → ok)      → "Link enviado!"
Clicar "Ver demonstração" → chama onDemo
```

#### `SetPasswordModal`

```
Campos "Nova senha" e "Confirmar senha" renderizados
Senhas diferentes    → "As senhas não coincidem."
Senha < 12 chars     → "A senha deve ter pelo menos 12 caracteres."
Senha válida + match (MSW → ok) → "Senha definida!"
Clicar fora do modal → chama onClose
```

#### `NewProcessModal`

```
Sem company ou role → botão "Adicionar Processo" desabilitado
Com ambos preenchidos → botão habilitado
Tags "react, typescript" → split por vírgula, trim, filter empty
Origem "inbound" selecionada por padrão
Salvar → onSave chamado com id (uuid), contactedDate (hoje), steps[0]
Cancelar → onClose chamado
```

#### `PipelineBar`

```
stage="interview" (idx=2 de 5):
  barras 0 e 1 preenchidas (contacted, screening)
  barra 2 com glow (current)
  barras 3 e 4 vazias
Clicar barra "offer" → onStageClick("offer") chamado
```

#### `OverviewTab`

```
Modo leitura: company, role, salary, recruiter, nextStepDate formatado visíveis
Clicar "Editar" → campos de edição aparecem
Alterar salary + "Salvar" → onUpdate chamado com dados atualizados
"Cancelar" → volta ao modo leitura sem chamar onUpdate
jobUrl "https://..." → renderiza link "↗ Vaga"
jobUrl "" ou "javascript:..." → link não renderizado
role + company presentes → botão "Praticar para esta vaga" visível com URL correta
role ou company ausente → botão não renderizado
tags viram stack= na URL do DevInterviewLab
```

#### `TimelineTab`

```
Steps renderizados em ordem reversa (mais recente primeiro)
Note vazia → addStep não chamado
Note preenchida + clicar "+" → onUpdate com step adicionado
Enter no input → aciona addStep
Badge correto para cada step
```

#### `Dashboard`

```
Com 2 ativos, 1 interview, 1 offer, 1 urgente:
  MetricCard "Ativos" → 2
  MetricCard "Entrevistas" → 1
  MetricCard "Propostas" → 1
  MetricCard "Urgentes" → 1
starred não-encerrados → listados em "Prioridades"
```

#### `useIsMobile`

```
innerWidth=1024 → false
innerWidth=375  → true
resize 1024→375 → true
```

#### `useTheme`

```
localStorage sem "icc-theme" → dark=true (default)
localStorage com "light"     → dark=false
toggle() → inverte e persiste no localStorage
```

---

### 4.3 Integration tests (RTL + MSW)

#### Auth — login com senha

```
1. App renderizado (session=null)
2. LoginScreen visível
3. Preencher email + senha
4. Clicar "Entrar"
5. MSW retorna session → App transita para layout autenticado
6. Sidebar e pipeline visíveis
```

#### Auth — credenciais inválidas

```
MSW retorna {error:"Invalid login credentials"}
→ "E-mail ou senha incorretos." exibido
→ botão habilitado novamente
```

#### Auth — password recovery

```
1. App recebe evento PASSWORD_RECOVERY (simulado via onAuthStateChange)
2. SetPasswordModal aparece automaticamente (isRecovery=true)
3. Preencher senha válida (≥12 chars)
4. MSW → updateUser ok
5. Tela de sucesso; clearRecovery chamado após salvar (não antes)
```

#### Modo demo

```
1. App com session=null
2. Clicar "Ver demonstração"
3. DEMO_PROCESSES carregados em memória
4. Banner âmbar "Modo demonstração" visível
5. ProcessCard "Nubank" visível
6. Editar stage → local apenas, sem request para Supabase
7. Clicar "Sair" → LoginScreen reaparece
```

#### CRUD — criar processo

```
1. App autenticado, lista vazia (MSW)
2. Clicar "Novo Processo" → modal
3. Preencher company="VTEX", role="Senior Engineer"
4. MSW intercepta POST /rest/v1/processes → 201
5. ProcessCard "VTEX" aparece na lista
6. selected é o novo processo
```

#### CRUD — atualizar processo

```
1. Processo selecionado
2. OverviewTab → "Editar" → alterar salary
3. "Salvar" → MSW intercepta PATCH → 200
4. UI mostra salary atualizado sem reload
```

#### CRUD — deletar processo

```
1. Processo selecionado
2. "Excluir" → MSW intercepta DELETE → 204
3. Processo removido da lista; selected passa para o próximo
```

#### Busca e filtro

```
3 processos: Nubank(interview), Spotify(offer), Stone(contacted)
Digitar "nu"            → apenas Nubank
Filtro "Proposta"       → apenas Spotify
Clicar "Todos"          → os 3 voltam
view="archived"         → apenas rejected/archived
```

#### AI — MessagesTab (gerador de respostas)

```
1. Tab "Respostas" aberta
2. Selecionar LinkedIn + cenário
3. MSW → {"body":"Olá Fernando..."}
4. Clicar "Gerar resposta"
5. Loading state aparece
6. Card com resposta renderizado
7. Clicar "copiar" → clipboard.writeText chamado com o body
8. Botão muda para "Copiado!" por 2s
```

#### AI — erro (rate limit 429)

```
MSW retorna 429 → generated.body exibe "Erro ao gerar. Tente novamente."
loading=false após erro
```

#### TimelineTab — adicionar step

```
1. Selecionar type="technical", data, note="Case técnico"
2. Clicar "+"
3. MSW → PATCH 200
4. Novo step no topo da lista
5. Badge "Técnica" visível
```

---

### 4.4 E2E tests (Playwright)

#### E2E-1: Login + navegação básica

```
/ → tela de login visível
Preencher email + senha de conta de teste
Clicar "Entrar" → sidebar com "Pipeline" visível
Clicar em ProcessCard → ProcessDetail abre
Clicar estrela → starred toggle visual imediato
```

#### E2E-2: Criar e editar processo

```
Clicar "Novo Processo" → modal abre
Preencher "TestCo E2E" + "Dev" → Adicionar
Card "TestCo E2E" visível na sidebar
Clicar barra "Entrevista" no PipelineBar → Badge muda
Recarregar → stage persiste no Supabase
Excluir processo (limpeza)
```

#### E2E-3: Magic link (requer Mailpit local)

```
"Entrar sem senha" → preencher email → "Enviar link"
Acessar link no Mailpit via API → seguir redirect
App abre com sessão ativa
```

Alternativa para CI sem Mailpit: verificar apenas "Link enviado!" aparecer.

#### E2E-4: Password reset

```
"Esqueci minha senha" → email → "Enviar e-mail de recuperação"
"E-mail enviado!" visível
(Com Mailpit) Seguir link → app com ?type=recovery
SetPasswordModal aparece automaticamente
Preencher nova senha ≥12 chars → "Definir senha"
Modal fecha, usuário logado
```

#### E2E-5: Mobile (viewport iPhone 12)

```
Playwright.use(devices["iPhone 12"])
Login → bottom navigation visível (min-height 52px)
Filtro "Entrevista" → apenas interviews
Clicar card → detail com animação slideUp
Botão "Voltar" → volta para lista
Header "Interview OS" visível
Botões de ação com 44px de touch target
```

#### E2E-6: Gerador de IA (staging com proxy real)

```
Abrir processo → tab "Respostas"
Selecionar LinkedIn + cenário
Clicar "Gerar resposta" → loading state ≥500ms
Card com resposta aparece
Texto não vazio e não é "Erro."
Clicar "copiar" → sem erro
```

#### E2E-7: Demo mode

```
Tela de login → "Ver demonstração"
Banner "Modo demonstração" visível
6 ProcessCards visíveis (DEMO_PROCESSES)
Nubank selecionado por padrão
Clicar "Sair" → LoginScreen
```

#### E2E-8: Tema dark/light

```
Login → clicar botão sol/lua
Background-color do body muda
Recarregar → tema persiste (localStorage)
```

---

## 5. Configuração e instalação

### Pacotes

```bash
npm install -D vitest @vitest/coverage-v8 \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  jsdom msw \
  @playwright/test
npx playwright install chromium
```

### `vite.config.js` — adicionar bloco `test`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
    },
  },
})
```

### `src/test/setup.js`

```js
import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => { cleanup(); server.resetHandlers() })
afterAll(() => server.close())
```

### `src/test/mocks/server.js`

```js
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
export const server = setupServer(...handlers)
```

### `src/test/mocks/handlers.js`

```js
import { http, HttpResponse } from 'msw'

const SUPABASE_URL = 'https://sumzkwjthwcdtjqheehn.supabase.co'
const AI_PROXY_URL = 'https://sumzkwjthwcdtjqheehn.supabase.co/functions/v1/anthropic-proxy'

export const handlers = [
  // Auth — login com senha
  http.post(`${SUPABASE_URL}/auth/v1/token`, () =>
    HttpResponse.json({ access_token: 'mock-token', user: { id: 'user-1', email: 'test@example.com' } })
  ),
  // Auth — magic link
  http.post(`${SUPABASE_URL}/auth/v1/otp`, () => HttpResponse.json({})),
  // Auth — password reset
  http.post(`${SUPABASE_URL}/auth/v1/recover`, () => HttpResponse.json({})),
  // Auth — update user (set password)
  http.put(`${SUPABASE_URL}/auth/v1/user`, () => HttpResponse.json({ id: 'user-1' })),
  // Processes — GET
  http.get(`${SUPABASE_URL}/rest/v1/processes`, () => HttpResponse.json([])),
  // Processes — INSERT
  http.post(`${SUPABASE_URL}/rest/v1/processes`, () => HttpResponse.json({}, { status: 201 })),
  // Processes — UPSERT / UPDATE
  http.patch(`${SUPABASE_URL}/rest/v1/processes`, () => HttpResponse.json({}, { status: 200 })),
  // Processes — DELETE
  http.delete(`${SUPABASE_URL}/rest/v1/processes`, () => new HttpResponse(null, { status: 204 })),
  // AI proxy
  http.post(AI_PROXY_URL, () =>
    HttpResponse.json({
      content: [{ type: 'text', text: '{"body":"Olá Fernando, obrigado pelo contato."}' }]
    })
  ),
]
```

### `src/test/mocks/fixtures.js`

```js
export const mockProcesses = [
  { id: 'p1', company: 'Nubank', role: 'Senior FE', stage: 'interview',
    location: 'Remoto', salary: 'R$ 22k', recruiter: 'Ana', recruiterEmail: 'ana@nu.com',
    origin: 'inbound', contactedDate: '2026-05-01', nextStepDate: '2026-05-22',
    nextStepNote: 'Entrevista técnica', jobUrl: '', tags: ['react'], notes: '',
    steps: [], aiContext: '', starred: true },
  { id: 'p2', company: 'Spotify', role: 'SWE', stage: 'offer',
    location: 'Remoto', salary: 'USD 140k', recruiter: 'James', recruiterEmail: 'j@spotify.com',
    origin: 'outbound', contactedDate: '2026-04-10', nextStepDate: '2026-05-25',
    nextStepNote: 'Prazo proposta', jobUrl: 'https://spotify.com/jobs/1', tags: ['typescript'],
    notes: '', steps: [], aiContext: '', starred: true },
  { id: 'p3', company: 'Stone', role: 'FE Engineer', stage: 'rejected',
    location: 'RJ', salary: 'R$ 15k', recruiter: 'Mariana', recruiterEmail: 'm@stone.com',
    origin: 'inbound', contactedDate: '2026-04-05', nextStepDate: null,
    nextStepNote: '', jobUrl: '', tags: ['vue'], notes: '', steps: [], aiContext: '', starred: false },
]
```

### `.env.test`

```env
VITE_SUPABASE_URL=https://sumzkwjthwcdtjqheehn.supabase.co
VITE_SUPABASE_ANON_KEY=mock-anon-key
VITE_AI_PROXY_URL=https://sumzkwjthwcdtjqheehn.supabase.co/functions/v1/anthropic-proxy
```

### `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',   use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Scripts no `package.json`

```json
"scripts": {
  "test":          "vitest",
  "test:ui":       "vitest --ui",
  "test:coverage": "vitest run --coverage",
  "test:e2e":      "playwright test",
  "test:e2e:ui":   "playwright test --ui"
}
```

---

## 6. Refatorações mínimas necessárias

Três extrações que desbloqueiam os unit tests de maior valor. Nenhuma quebra o código existente.

### 1. Extrair `buildPrompt` de `MessagesTab`

```js
// src/utils/buildPrompt.js
export function buildPrompt({ process, channel, channelHint, scenario, recruiterMsg, extra }) {
  // ... lógica atual da função buildPrompt dentro de MessagesTab
}
```

### 2. Extrair `filterProcesses` do corpo do App

```js
// src/utils/filterProcesses.js
export function filterProcesses(list, search, stageFilter) {
  const q = search.toLowerCase();
  return list.filter(p =>
    (stageFilter === "all" || p.stage === stageFilter) &&
    (!q || p.company.toLowerCase().includes(q) ||
           p.role.toLowerCase().includes(q) ||
           p.tags.some(t => t.toLowerCase().includes(q)))
  );
}
```

### 3. Extrair `checkRateLimit` e `corsHeaders` da Edge Function

```ts
// supabase/functions/anthropic-proxy/utils.ts
export function checkRateLimit(map: Map<string, { count: number; resetAt: number }>, userId: string): boolean { ... }
export function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> { ... }
```

---

## 7. Prioridade de implementação

| Fase | O quê | Esforço | Prioridade |
|---|---|---|---|
| **1** | Configurar Vitest + RTL + MSW + setup files | 2–3h | Bloqueante |
| **2** | Unit tests de funções puras (`fmtDate`, `daysDiff`, `rowToProcess`, `processToRow`) | 3–4h | Alta — risco real de bug de timezone |
| **3** | Component tests críticos (`LoginScreen`, `SetPasswordModal`, `Badge`, `Btn`) | 3–4h | Alta — porta de entrada do app |
| **4** | Integration tests de auth (login, demo, recovery) | 4–5h | Alta — bug aqui torna o app inacessível |
| **5** | Integration tests de CRUD + busca/filtro | 4–5h | Média |
| **6** | E2E básico (E2E-1, E2E-2, E2E-7) | 4–5h | Média |
| **7** | Component tests restantes (`OverviewTab`, `TimelineTab`, `ProcessCard`, `Dashboard`) | 4–6h | Média |
| **8** | Unit tests de Edge Function (`checkRateLimit`, `corsHeaders`) | 1–2h | Média |
| **9** | E2E avançado (mobile, magic link com Mailpit, AI real em staging) | 6–8h | Baixa |

**MVP de testes (fases 1–5):** ~20–22h — cobre 80% do risco com 40% do esforço total.

---

## 8. Estimativa de esforço

| Grupo | Estimativa |
|---|---|
| Configuração e infra | 2–3h |
| Unit tests — funções puras + constantes + Edge Function | 5–6h |
| Component tests — todos os componentes | 14–18h |
| Integration tests — auth + CRUD + AI | 10–13h |
| E2E básico (3 cenários) | 4–5h |
| E2E avançado (5 cenários) | 6–8h |
| **Total MVP (fases 1–5)** | **~20–22h** |
| **Total completo** | **~45–55h** |

---

## 9. Estrutura de arquivos esperada

```
src/
├── test/
│   ├── setup.js
│   └── mocks/
│       ├── server.js
│       ├── handlers.js
│       └── fixtures.js
├── utils/
│   ├── buildPrompt.js        ← extrair de MessagesTab
│   └── filterProcesses.js   ← extrair de App.jsx
└── __tests__/
    ├── unit/
    │   ├── fmtDate.test.js
    │   ├── daysDiff.test.js
    │   ├── supabase.test.js        (rowToProcess, processToRow)
    │   ├── buildPrompt.test.js
    │   ├── filterProcesses.test.js
    │   └── constants.test.js       (STAGE, ACTIVE_STAGES)
    ├── components/
    │   ├── Badge.test.jsx
    │   ├── Btn.test.jsx
    │   ├── Ic.test.jsx
    │   ├── ProcessCard.test.jsx
    │   ├── Tabs.test.jsx
    │   ├── PipelineBar.test.jsx
    │   ├── LoginScreen.test.jsx
    │   ├── SetPasswordModal.test.jsx
    │   ├── NewProcessModal.test.jsx
    │   ├── OverviewTab.test.jsx
    │   ├── TimelineTab.test.jsx
    │   └── Dashboard.test.jsx
    └── integration/
        ├── auth.test.jsx
        ├── crud.test.jsx
        ├── search-filter.test.jsx
        └── ai-calls.test.jsx

e2e/
├── login.spec.ts
├── crud.spec.ts
├── mobile.spec.ts
├── demo.spec.ts
├── ai.spec.ts
└── theme.spec.ts

supabase/functions/anthropic-proxy/
├── index.ts
└── utils.ts    ← extrair checkRateLimit e corsHeaders
```

---

## Adições v1.4 — UX rápida (sort, tags inline, swipe, canal)

### Novos testes unitários

#### `sortProcesses` — `src/__tests__/unit/sort.test.js` ✅
```
sortProcesses(list, "urgencia") — nextStepDate nula vai para o final
sortProcesses(list, "urgencia") — mais próxima primeiro
sortProcesses(list, "empresa") — ordem alfabética case-insensitive
sortProcesses(list, "stage") — ordem do pipeline (STAGE_ORDER)
sortProcesses(list, "recente") — contactedDate mais recente primeiro
```

#### `channel` nos mappers — `src/__tests__/unit/channel.test.js` ✅
```
rowToProcess({ channel: "linkedin" }) → process.channel === "linkedin"
rowToProcess({ channel: null }) → process.channel === ""
processToRow({ channel: "email" }) → row.channel === "email"
processToRow({ channel: "" }) → row.channel === null
```

### Novos testes de componente

#### `InlineTags` — `src/__tests__/components/InlineTags.test.jsx` ✅
```
Renderiza tags existentes
Clicar × remove a tag (onUpdate chamado com lista sem aquela tag)
Digitar nova tag + Enter → onUpdate com tag adicionada
Blur com texto → adiciona tag
Tag duplicada não adiciona
Input em branco não adiciona
```

#### `ProcessCard` — `src/__tests__/components/ProcessCard.test.jsx` ✅
```
channel="linkedin" → ícone linkedin visível no card
channel="" → sem ícone de canal
swipe left ≥ 80px → onSwipeAction chamado
swipe left < 80px → onSwipeAction NÃO chamado
```

---

## Adições v1.3.1 — Armazenamento de Currículos e CI

### Status de implementação

**IMPLEMENTADOS e passando (172 testes totais — 14 suítes):**

#### `extractTextFromPdf` — `src/__tests__/unit/extractTextFromPdf.test.js` ✅
```
PDF 1 página   → texto correto extraído
PDF 3 páginas  → páginas separadas por \n\n
PDF sem itens  → string vazia por página
múltiplos itens na página → joined com espaço
pdfjs rejeitando → propaga erro
```

#### `ResumesModal` — `src/__tests__/components/ResumesModal.test.jsx` ✅ (19 testes)
```
Lista vazia → mensagem "Nenhum currículo salvo" visível
loading=true → spinner exibido
Lista com 2 currículos → nome e idioma renderizados (Português/English)
Botão "Adicionar" → formulário "Novo Currículo" aparece
Botão Fechar → onClose chamado
Validação: nome vazio → "Nome e conteúdo são obrigatórios."
Validação: só nome preenchido → mesmo erro
Salvar novo → onAdd chamado com dados corretos
Salvar bem-sucedido → volta para lista
Erro do servidor → "Erro ao salvar. Tente novamente."
Cancelar formulário → volta para lista
Editar → formulário preenchido com nome/idioma/conteúdo corretos
Editar + salvar → onUpdate chamado com id correto
Excluir com confirm=true → onDelete chamado
Excluir com confirm=false → onDelete NÃO chamado
Upload .txt → file.text() preenche textarea, nome auto-preenchido
Upload .pdf → extractTextFromPdf chamado, textarea preenchida
Erro na extração → "Não foi possível extrair o texto..."
```

#### `CVTab` — `src/__tests__/components/CVTab.test.jsx` ✅ (20 testes)
```
stack=[] e summary="" → "Configure seu perfil primeiro"
stack preenchida sem summary → step-input renderizado
summary preenchido sem stack → step-input renderizado
Step input renderizado com perfil válido
Botão Analisar desabilitado com JD vazia
Botão Analisar habilitado com JD preenchida
Dropdown inclui "Perfil (CV completo)"
Dropdown inclui currículos da lista de resumes
Stack do perfil exibida
JD vazia: callAI NÃO chamado
Gerenciar → onManageResumes chamado
Analisar JD → step review (via MSW callAI mockado)
Matched items pré-checados no review
Unauthorized items desmarcados no review
Gerar desabilitado quando nenhum aprovado
Erro na análise → volta para step-input
Gerar currículo → step-result com texto
Copiar → clipboard.writeText chamado com o texto
Nova análise → step-input
Voltar do result → step-review
```

#### `useResumes` — `src/__tests__/integration/resumes.test.js` ✅ (9 testes)
```
Fetch inicial com session → 2 resumes carregados
Sem session → loading=false, resumes=[]
API retorna null → resumes=[]
add() → prepende à lista local
add() → retorna { data, error }
add() com erro → lista não muda
update() → item correto atualizado na lista
remove() → item removido da lista
remove() com erro → lista não muda
```

**Abordagem de mock adotada:** `vi.mock("../../supabase.js")` com um stub de cliente Supabase
totalmente controlável via `_setTerminal()`. Essa abordagem é necessária porque o arquivo `.env`
usa URLs placeholder e o MSW não consegue interceptar o cliente Supabase JS em jsdom.

#### CI — build validation

```
npm run build sem VITE_ env vars → deve passar (Vite usa "" para vars ausentes em build)
npm run build com env vars configuradas → bundle gerado sem erros
chunk principal < 2500 kB (chunkSizeWarningLimit configurado)
pdfjs-dist chunk separado do bundle principal (lazy import)
```

---

## Adições v1.3 — PWA e Mobile AI Tab

### Novos cenários E2E a cobrir

#### E2E-PWA-1: Service Worker registrado
- Acessar app em HTTPS
- `navigator.serviceWorker.controller` deve ser não-nulo após reload
- Assets estáticos (JS/CSS) devem ser servidos do cache na 2ª visita (network offline)

#### E2E-PWA-2: Manifest detectado
- Verificar que `<link rel="manifest">` está presente e acessível
- Verificar que `theme-color` meta tag está no `<head>`

#### Mobile AI Tab — unit/component

- `AITab` com `isMobile=true` deve renderizar quick actions com `overflowX:auto` (scroll horizontal)
- `AITab` com `isMobile=false` deve renderizar quick actions com `flexWrap:wrap`
- Input de envio deve exibir `paddingBottom` com `env(safe-area-inset-bottom)` no mobile
- Placeholder deve ser encurtado no mobile
- Bolhas de mensagem devem ter `maxWidth:90%` no mobile vs `85%` no desktop

---

## Adições v1.4 — Componentização

### Status

A componentização de `App.jsx` não criou novos testes unitários (os módulos extraídos já eram cobertos pelos testes existentes), mas os testes existentes foram atualizados para importar dos novos caminhos modulares.

**Testes atualizados para novos caminhos:**
- `src/__tests__/components/CVTab.test.jsx` — importa de `src/components/tabs/CVTab.jsx`
- `src/__tests__/components/InlineTags.test.jsx` — importa de `src/components/process/InlineTags.jsx`
- `src/__tests__/components/ProcessCard.test.jsx` — importa de `src/components/process/ProcessCard.jsx`
- `src/__tests__/unit/sort.test.js` — importa de `src/utils/sort.js`

**Suite completa:** 172 testes, 14 arquivos, todos passando.

### Cenários a cobrir em v1.5 (pendente)

- `useAuth` — mock de `supabase.auth.getSession` + `onAuthStateChange` para testar fluxo de recovery
- `useTheme` — persistência no localStorage + toggle
- `useIsMobile` — breakpoint 768px via ResizeObserver mock
- `callAI` (src/lib/ai.js) — erro HTTP, token ausente, resposta malformada
- `buildPrompt` (src/utils/buildPrompt.js) — geração correta do prompt com diferentes inputs

---

## Adições v1.5 — Mensagem de recrutador + CV adaptado por processo

### Novos arquivos de teste criados

#### `RecruiterMessageModal` — `src/__tests__/components/RecruiterMessageModal.test.jsx` ✅ (18 testes — reescrito para fluxo 3 etapas)
```
Step paste: textarea renderizado, botão Extrair desabilitado sem texto, habilitado com texto
Cancelar → onClose chamado
Extração bem-sucedida → step review com campos preenchidos (empresa, recrutador, cargo)
Extração com erro → mensagem de erro exibida
Campos do review são editáveis
Criar processo → onProcessCreated chamado com stage="contacted", origin="inbound", channel="linkedin"
Rascunho de resposta exibido no step draft
Botão Copiar → clipboard.writeText com draft
Tags criadas a partir da stack extraída
Notas incluem mensagem original colada
Botão Abrir processo → onClose chamado
Botão Voltar no review → retorna ao step paste
```

#### `CVTab` — `src/__tests__/components/CVTab.test.jsx` ✅ (23 testes — reescrito para Q&A)
```
Fluxo Q&A:
- Analisar JD → step-qa com perguntas geradas pela IA
- Perguntas exibem texto correto
- Botão Gerar desabilitado quando perguntas sem resposta
- Botão Gerar habilitado após responder todas
- Clicar Sim destaca a pergunta
- Botão Voltar no Q&A retorna para step-input
- Erro na análise → step-input
Fluxo result:
- step-result com texto gerado pela IA
- Copiar → clipboard.writeText
- Botão Salvar adaptação → onSaveAdaptation com (content, jdText, qaAnswers[])
- Nova análise → step-input
- Voltar do result → step-qa
Banner de adaptação salva quando adaptation prop presente
```

### Novos hooks e mappers (sem testes unitários isolados — cobertos via componentes)

- `useCVAdaptations` — CRUD hook (fetch, save via upsert, clear) para tabela `cv_adaptations`
- `rowToCVAdaptation` / `cvAdaptationToRow` — mappers em `supabase.js`

### Banco de dados

Tabela `cv_adaptations` criada via migração com 4 políticas RLS.
Bucket `cv-files` criado no Storage com políticas por `user_id`.

**Suite completa:** 247 testes, 17 arquivos, todos passando.

---

## Adições v1.5.1 — UX Simplification (3-tab flow)

### Componentes removidos (testes obsoletos)

Os seguintes arquivos foram deletados e seus testes se tornam obsoletos:
- `src/components/tabs/MessagesTab.jsx` → removido
- `src/components/tabs/AITab.jsx` → removido
- `src/components/tabs/OverviewTab.jsx` → removido
- `src/components/tabs/TimelineTab.jsx` → removido

Arquivos de teste existentes que referenciam estes componentes devem ser:
- `src/__tests__/components/OverviewTab.test.jsx` — renomear/reescrever para `VagaTab.test.jsx`
- `src/__tests__/components/TimelineTab.test.jsx` — remover (funcionalidade eliminada)
- `src/__tests__/integration/ai-calls.test.jsx` — atualizar para referenciar `ConversaTab`

### Novos cenários a cobrir

#### `ConversaTab` — `src/__tests__/components/ConversaTab.test.jsx`
```
Thread vazia → placeholder "Nenhuma mensagem ainda" visível
sentMessages preenchido → composeOpen=false por padrão
sentMessages vazio → composeOpen=true por padrão
Entrada com recruiterMsg → bubble da esquerda visível
Entrada sem recruiterMsg → apenas bubble direita
Botão "Copiar" → clipboard.writeText chamado com body
Botão "Salvar" → onUpdate chamado com sentMessages atualizado
callAI retorna JSON → bubble aparece no thread
callAI retorna erro → bubble de erro aparece
"Nova mensagem do recrutador" → abre compose
```

#### `VagaTab` — `src/__tests__/components/VagaTab.test.jsx`
```
Renderiza company, role, location, salary
Campo editável: clicar company → input aparece, blur → onUpdate chamado
Data de próxima etapa + diff ≤2 → badge URGENTE visível
Data de próxima etapa + diff ≤7 → badge EM BREVE visível
Tipo "entrevista" selecionado → onUpdate com stage="interview"
Tipo "proposta" → onUpdate com stage="offer"
Tipo "outro" → stage não muda
Link da vaga "https://..." → link "Abrir vaga" visível
Link "javascript:..." → link NÃO renderizado
notes com prefixo "Mensagem original:" → mostra contextMsg separado
Botão "Excluir processo" → onDelete chamado
```

**Suite atual:** 251 testes, 17 arquivos (alguns quebrarão até serem atualizados com novos caminhos).

---

## Adições v1.5 — Mobile UX e correção de geração de mensagens

### Correções implementadas (sem novos arquivos de teste)

- **MessagesTab** — reescrita com `MESSAGES_SYSTEM` prompt explícito e `parseAIResponse()` robusto:
  - Parse com fallback: tenta `JSON.parse` direto → regex greedy → retorna `{ body: text }` como último recurso
  - Elimina falha silenciosa quando Claude envolve JSON em markdown code block
  - Layout mobile: `flex column` com botão Gerar sticky no rodapé, resultado no topo do scroll
  - Resultado sempre visível imediatamente após geração, nunca coberto pela bottom nav

- **ProcessDetail** — `tabH` mobile corrigido de `268px` para `338px` (+70px da bottom nav fixa)

- **App.jsx (mobile)** — FAB LinkedIn flutuante na lista mobile: botão circular azul (`#0A66C2`) fixo acima da bottom nav, abre `RecruiterMessageModal` com 1 toque. Aparece apenas em `view==="pipeline"` e `mobileScreen==="list"`.

### Cenários a cobrir (pendente para suite E2E)

- `MessagesTab` — geração bem-sucedida com mock de `callAI` retornando JSON e texto plano
- `MessagesTab` — parseAIResponse com JSON envolto em markdown code block
- Mobile layout — botão Gerar sticky não coberto por bottom nav
- FAB LinkedIn abre RecruiterMessageModal

**Suite completa:** 251 testes, 17 arquivos, todos passando.
