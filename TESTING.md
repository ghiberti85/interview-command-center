# Estratégia de Testes — Interview Command Center

---

## 1. Estado atual

**204 testes passando. Zero falhas.**

| Camada | Arquivos | Testes |
|---|---|---|
| Unit | 9 arquivos | ~172 |
| Component | 7 arquivos | ~22 |
| Integration | 1 arquivo | ~10 |
| **Total** | **17 arquivos** | **204** |

**CI:** `npm run test:run` executa antes de `npm run build` em todo PR e push para `main`. Build só acontece se todos os testes passarem.

---

## 2. Stack

| Ferramenta | Papel |
|---|---|
| **Vitest** | Runner principal — integração nativa com Vite |
| **React Testing Library** | Testes de componente — comportamento, não implementação |
| **@testing-library/user-event** | Interações realistas (foco, digitação, eventos de teclado) |
| **MSW** | Mock de rede — intercepta fetch (Supabase + proxy IA) |
| **Playwright** | E2E — planejado (ver seção 6) |

---

## 3. Estrutura de arquivos

```
src/__tests__/
├── unit/
│   ├── buildPrompt.test.js        # buildCVPrompt — montagem de prompt de adaptação de CV
│   ├── channel.test.js            # CONTACT_CHANNELS — valores e ícones
│   ├── constants.test.js          # STAGE, ACTIVE_STAGES, CHANNELS, SCENARIOS
│   ├── dateUtils.test.js          # fmtDate, daysDiff — formatação e diff de datas
│   ├── edgeFunction.test.js       # anthropic-proxy — rate limit, CORS, validação de payload
│   ├── extractTextFromPdf.test.js # extractTextFromPdf — extração de texto de PDFs
│   ├── filterProcesses.test.js    # filterProcesses — busca e filtro por stage
│   ├── sort.test.js               # sortProcesses — urgência, empresa, stage, recente
│   ├── supabase.test.js           # rowToProcess, processToRow — mapeadores snake_case ↔ camelCase
│   ├── useDebounce.test.js        # useDebounce — delay, atualização, cleanup de timeout (6 testes)
│   └── useProcesses.test.js       # useProcesses — CRUD demo/autenticado, Supabase mockado (12 testes)
│
├── components/
│   ├── CVTab.test.jsx             # CVTab — fluxo 4 etapas (input → analyzing → review → result)
│   ├── InlineTags.test.jsx        # InlineTags — adicionar, remover, tecla Enter/Escape
│   ├── ProcessCard.test.jsx       # ProcessCard — render, urgência, swipe mobile, ações
│   ├── ProfileSetupModal.test.jsx # ProfileSetupModal — abas, salvar, upload PDF
│   └── ResumesModal.test.jsx      # ResumesModal — listagem, criar, editar, excluir
│
└── integration/
    └── resumes.test.js            # useResumes hook — CRUD completo com Supabase mockado (MSW)
```

**Removidos nesta sessão:**
- `importHelpers.test.js` — removido junto com `importHelpers.js` (código morto)
- `RecruiterMessageModal.test.jsx` — removido junto com `RecruiterMessageModal.jsx` (código morto)

---

## 4. Regra: testes com toda nova funcionalidade

**Toda feature nova DEVE ter testes na mesma sessão/PR.**

| Tipo de mudança | Onde testar |
|---|---|
| Função pura (utils, mappers, helpers) | `src/__tests__/unit/` |
| Componente React novo ou modificado | `src/__tests__/components/` |
| Hook com Supabase ou proxy IA | `src/__tests__/integration/` com MSW |
| Feature removida | Remover testes correspondentes + atualizar este arquivo |

**Ao remover uma feature:** apague os testes do componente/módulo removido e atualize a tabela acima.

---

## 5. Comandos

```bash
npm run test:run          # roda todos os testes uma vez (usado no CI)
npm run test              # modo watch (desenvolvimento)
npm run test:coverage     # cobertura com relatório lcov
npm run test:e2e          # Playwright E2E (requer servidor rodando)
npm run test:e2e:ui       # Playwright com UI interativa
```

---

## 6. Pirâmide atual

```
         /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
        /  E2E Playwright  \   ← 5 spec files (login, demo, crud, mobile, theme)
       /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
      /  Integration (~10)   \  RTL + MSW — Supabase mockado
     /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
    /      Unit + Component    \  Vitest puro — funções e componentes isolados
   /          (194 testes)      \
  /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

---

## 7. Testes E2E — Playwright (implementados)

Arquivos em `e2e/`. Usar `npm run test:e2e` com servidor rodando (`npm run preview`).

| Spec | Fluxos cobertos |
|---|---|
| `login.spec.ts` | Tela login, email+senha, erro de credenciais, magic link, esqueci senha |
| `demo.spec.ts` | Banner demo, processos fake visíveis, sair do demo retorna ao login |
| `crud.spec.ts` | Criar processo, editar stage via PipelineBar, marcar como favorito |
| `mobile.spec.ts` | Viewport mobile, bottom nav, long-press para seleção |
| `theme.spec.ts` | Toggle dark/light, persistência no reload |

Config em `playwright.config.ts`: base URL `http://localhost:4173`, Chromium + iPhone 12, `webServer` com `npm run preview`.

---

## 8. Mocks e convenções

### Supabase
```js
vi.mock("../../supabase.js", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));
```

### Proxy IA (callAI / extractTextFromPdf)
```js
vi.mock("../../lib/ai.js", () => ({
  callAI: vi.fn().mockResolvedValue("Resposta mockada"),
  extractTextFromPdf: vi.fn().mockResolvedValue("Texto extraído"),
}));
```

### Variáveis de ambiente
Configuradas em `vitest.config.js` via `define` — sem necessidade de `.env` nos testes.

---

## 9. CI — GitHub Actions

O workflow `.github/workflows/deploy.yml` tem dois jobs:

1. **test** — `npm run test:run` — falha bloqueia o build
2. **build** — `npm run build` — só executa se testes passarem

Todo push para `main` e todo PR disparam esse pipeline. O deploy na Vercel só acontece se o build passar.

---

## 10. Histórico de cobertura

| Data | Testes | Falhas | Observação |
|---|---|---|---|
| 2026-06-28 | 204 | 0 | i18n ResumesModal + ProfileSetupModal; ARIA aria-labels (close/back/edit/delete/compose); ErrorBoundary root; ProfileSetupModal.test atualizado para string i18n |
| 2026-06-28 | 204 | 0 | Boas práticas 2026: useDebounce (6), useProcesses (12); hooks useFocusTrap, useMemo, lazy() modals; translateAIError; CVTab inline errors; jobUrl sanitize; Playwright E2E scaffold (5 specs) |
| 2026-06-07 | 187 | 0 | Remoção de código morto: ImportModal, ImportChatGPTModal, NewProcessModal, RecruiterMessageModal, importHelpers, isUrgent; VagaTab accordion; InlineTags compact |
| 2026-05-30 | 253 | 0 | Correção: constants.test (ACTIVE_STAGES 4 itens), ProfileSetupModal (mock extractTextFromPdf, label aba "CV") |
| Sessão anterior | 252 | 8 | ACTIVE_STAGES esperava 5 itens; ProfileSetupModal mockava pdfjs diretamente (não funcionava com lazy import) |
