# Estratégia de Testes — Interview Command Center

---

## 1. Estado atual

**253 testes passando. Zero falhas.**

| Camada | Arquivos | Testes |
|---|---|---|
| Unit | 9 arquivos | ~195 |
| Component | 6 arquivos | ~58 |
| Integration | 1 arquivo | — |
| **Total** | **17 arquivos** | **253** |

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
│   ├── buildPrompt.test.js       # buildCVPrompt — montagem de prompt de adaptação de CV
│   ├── channel.test.js           # CONTACT_CHANNELS — valores e ícones
│   ├── constants.test.js         # STAGE, ACTIVE_STAGES, CHANNELS, SCENARIOS
│   ├── dateUtils.test.js         # fmtDate, daysDiff — formatação e diff de datas
│   ├── edgeFunction.test.js      # anthropic-proxy — rate limit, CORS, validação de payload
│   ├── extractTextFromPdf.test.js # extractTextFromPdf — extração de texto de PDFs
│   ├── filterProcesses.test.js   # filterProcesses — busca e filtro por stage
│   ├── importHelpers.test.js     # parseCSV, normalizeProcess, detectFormat
│   ├── sort.test.js              # sortProcesses — urgência, empresa, stage, recente
│   └── supabase.test.js          # rowToProcess, processToRow — mapeadores snake_case ↔ camelCase
│
├── components/
│   ├── CVTab.test.jsx             # CVTab — fluxo 4 etapas (input → analyzing → review → result)
│   ├── InlineTags.test.jsx        # InlineTags — adicionar, remover, tecla Enter/Escape
│   ├── ProcessCard.test.jsx       # ProcessCard — render, urgência, swipe mobile, ações
│   ├── ProfileSetupModal.test.jsx # ProfileSetupModal — abas, salvar, upload PDF
│   ├── RecruiterMessageModal.test.jsx # RecruiterMessageModal — fluxo 3 etapas
│   └── ResumesModal.test.jsx      # ResumesModal — listagem, criar, editar, excluir
│
└── integration/
    └── resumes.test.js            # useResumes hook — CRUD completo com Supabase mockado (MSW)
```

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
        /    E2E  (0)      \    ← planejado, ainda não implementado
       /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
      /  Integration (~10)   \  RTL + MSW — Supabase mockado
     /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
    /      Unit + Component    \  Vitest puro — funções e componentes isolados
   /       (~243 testes)        \
  /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

---

## 7. Testes E2E planejados (Playwright)

Quando implementados, cobrirão:

| Fluxo | Prioridade |
|---|---|
| Login email+senha → ver lista de processos | Alta |
| Modo demonstração → navegar entre processos | Alta |
| Criar processo via RecruiterMessageModal | Alta |
| Swipe to archive no mobile (viewport 390px) | Média |
| Encerrar e excluir processo no desktop | Média |
| Upload de PDF no perfil | Média |
| Dark/light mode — persistência no reload | Baixa |
| Auth — magic link (requer email real) | Baixa |

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
| 2026-05-30 | 253 | 0 | Correção: constants.test (ACTIVE_STAGES 4 itens), ProfileSetupModal (mock extractTextFromPdf, label aba "CV") |
| Sessão anterior | 252 | 8 | ACTIVE_STAGES esperava 5 itens; ProfileSetupModal mockava pdfjs diretamente (não funcionava com lazy import) |
