# Erros conhecidos e corrigidos — Interview Command Center

Registro de bugs que já ocorreram em produção ou desenvolvimento, com causa raiz e solução.
**Consulte antes de alterar código relacionado — evita regressões.**

---

## ERR-001 — Safe-area retornando ~34px no browser (não apenas PWA)

**Sintoma:** Bottom nav com espaçamento inferior excessivo (~34px) ao abrir o app no Safari browser normal, não apenas como PWA instalado.

**Causa raiz:** `viewport-fit=cover` no `index.html` faz `env(safe-area-inset-bottom)` reportar o valor real do iPhone (~34px) mesmo em modo browser — não apenas em modo standalone (PWA).

**Solução aplicada:** CSS custom property `--sab` injetada via `useEffect` no `App.jsx`:
```js
document.documentElement.style.setProperty(
  "--sab",
  isPWA ? "env(safe-area-inset-bottom, 0px)" : "0px"
);
```
`isPWA` detectado via `window.matchMedia("(display-mode: standalone)")`.

**Todos os usos de safe-area devem usar `var(--sab)`**, nunca `env(safe-area-inset-bottom)` diretamente.

**Arquivos:** `src/App.jsx` — `useEffect` com `isPWA`; todos os componentes que usavam `env()` foram migrados.

---

## ERR-002 — ~~Swipe to archive removido~~ (mecanismo substituído)

**Nota:** O mecanismo de swipe para deletar/encerrar foi removido e substituído por **long-press para seleção múltipla**. Os erros ERR-002 e ERR-011 (relacionados ao painel de swipe) não são mais relevantes — o código correspondente não existe mais.

---

## ERR-003 — `--sab` com auto-referência (CSS var circular)

**Sintoma:** Bottom nav sem safe-area mesmo em PWA; `--sab` retornava valor inválido.

**Causa raiz:** Implementação inicial usava:
```js
// ❌ Auto-referência — CSS ignora e usa o valor inicial
isPWA ? "var(--sab)" : "0px"
```

**Solução aplicada:**
```js
// ✅ Correto — usa env() diretamente no valor da var
isPWA ? "env(safe-area-inset-bottom, 0px)" : "0px"
```

**Arquivo:** `src/App.jsx` — `useEffect` da `--sab`.

---

## ERR-004 — Mock de `pdfjs-dist` não funcionava no teste do ProfileSetupModal

**Sintoma:** Testes de upload de PDF no `ProfileSetupModal.test.jsx` falhavam — `textarea.value` permanecia vazio mesmo com mock configurado.

**Causa raiz:** `extractTextFromPdf` em `src/lib/ai.js` carrega `pdfjs-dist` via `await import("pdfjs-dist")` (import dinâmico). `vi.mock("pdfjs-dist", ...)` mocka o módulo estático, mas o import dinâmico cria uma instância separada que não intercepta o mock.

**Solução aplicada:** Mockar `../../lib/ai.js` diretamente, não `pdfjs-dist`:
```js
// ❌ Não funciona com import dinâmico
vi.mock("pdfjs-dist", () => ({ getDocument: mockGetDocument }));

// ✅ Correto
vi.mock("../../lib/ai.js", () => ({
  extractTextFromPdf: (...args) => mockExtractTextFromPdf(...args),
  callAI: vi.fn(),
}));
```

**Arquivo:** `src/__tests__/components/ProfileSetupModal.test.jsx`.

---

## ERR-005 — Draft do RecruiterMessageModal vindo vazio em produção

**Sintoma:** Após extração da mensagem do recrutador, o campo de draft aparecia vazio.

**Causa raiz:** A implementação anterior retornava JSON `{"draft":"..."}` e havia um `JSON.parse` frágil que falha quando a IA retorna texto ligeiramente fora do formato esperado (ex: com markdown, com aspas extras).

**Solução aplicada:** `DRAFT_SYSTEM` reescrito para retornar **plain text** (não JSON). Eliminado o parse:
```js
// Antes: tentava parsear JSON — frágil
const parsed = JSON.parse(raw);
setDraft(parsed.draft);

// Depois: usa o texto diretamente
setDraft(raw.trim());
```

**Arquivo:** `src/components/modals/RecruiterMessageModal.jsx` — constante `DRAFT_SYSTEM` e handler do draft.

---

## ERR-006 — PWA no iOS servindo bundle cacheado após deploy

**Sintoma:** Usuário não via atualizações do app no iOS (PWA instalado). Desktop via as mudanças, mobile continuava na versão antiga.

**Causa raiz:** Service Worker com estratégia `cache-first` para assets JS/CSS. O Vite gera hashes nos nomes dos arquivos (`index-Abc123.js`), mas o SW cacheava o `index.html` antigo que referenciava os hashes antigos. O SW só atualizava quando detectava mudança no próprio `sw.js` — e mesmo assim, o ciclo de atualização do SW pode levar até 24h.

**Solução aplicada:** SW reescrito para estratégia `network-first` (v20):
```js
// Antes: cache-first para JS/CSS
// Depois: network-first para tudo — cache só como fallback offline
event.respondWith(
  fetch(request)
    .then(res => { if (res.ok) caches.open(CACHE_NAME).then(c => c.put(request, res.clone())); return res; })
    .catch(() => caches.match(request).then(c => c || caches.match("/index.html")))
);
```

**Para forçar atualização em dispositivo:** fechar o app completamente e reabrir. O SW novo ativa na próxima abertura.

**Arquivo:** `public/sw.js` — estratégia de fetch + `CACHE_NAME` bumped para `icc-v20`.

---

## ERR-007 — `height: 100dvh` causando salto de layout ao abrir teclado no iOS

**Sintoma:** Ao focar em um input no mobile, o layout inteiro subia com o teclado virtual, causando salto visual.

**Causa raiz:** `height: 100dvh` no container raiz responde a mudanças do viewport visual — quando o teclado sobe, `100dvh` encolhe e o layout reflow.

**Solução aplicada:**
```js
// Antes
{ height: "100dvh", overflow: "hidden" }

// Depois
{ position: "fixed", inset: 0 }
```

`position: fixed` é imune a mudanças do viewport visual causadas por teclado e barra de endereço do Safari.

**Arquivo:** `src/App.jsx` — container raiz mobile.

---

## ERR-008 — `process_id` em `cv_adaptations` com tipo `uuid` quebrando FK

**Sintoma:** INSERT na tabela `cv_adaptations` falhava com erro de tipo na FK `process_id`.

**Causa raiz:** `processes.id` é `text` (gerado com `crypto.randomUUID()` no cliente), mas a migration de `cv_adaptations` criou `process_id` como `uuid`. PostgreSQL rejeita FK com tipos incompatíveis.

**Solução aplicada:** `process_id` definido como `text` na tabela `cv_adaptations`:
```sql
-- ❌ Errado
process_id uuid references processes(id)

-- ✅ Correto
process_id text references processes(id) on delete cascade
```

**Regra:** sempre verifique o tipo da PK antes de criar FK. Ver SCHEMA.md.

---

## ERR-009 — ACTIVE_STAGES com 5 itens (teste desatualizado após UX simplification)

**Sintoma:** `constants.test.js` falhava com `expected [ 'contacted', 'interview', ... ] to include 'screening'`.

**Causa raiz:** A simplificação de UX (v1.5.1) removeu `"screening"` de `ACTIVE_STAGES` (o stage continua existindo em `STAGE`, mas não é mais um filtro ativo na lista). O teste não foi atualizado junto.

**Solução aplicada:** Teste atualizado para esperar 4 itens e não incluir `"screening"`:
```js
// Antes
expect(ACTIVE_STAGES).toHaveLength(5);
["contacted", "screening", "interview", "technical", "offer"].forEach(...)

// Depois
expect(ACTIVE_STAGES).toHaveLength(4);
["contacted", "interview", "technical", "offer"].forEach(...)
```

**Lição:** ao remover um stage de `ACTIVE_STAGES`, atualizar `constants.test.js` imediatamente.

---

## ERR-010 — Label da aba "CV Completo" renomeada para "CV" sem atualizar testes

**Sintoma:** `ProfileSetupModal.test.jsx` falhava com `Unable to find an element with the text: CV Completo`.

**Causa raiz:** Label da aba no componente foi encurtada de `"CV Completo"` para `"CV"` mas os testes `getByRole("button", { name: "CV Completo" })` não foram atualizados.

**Solução aplicada:** Todos os seletores `{ name: "CV Completo" }` alterados para `{ name: "CV" }`.

**Lição:** ao renomear qualquer label visível, buscar ocorrências nos testes antes de commitar.

---

## ERR-012 — Processos sumindo ou não carregando ao abrir o app

**Sintoma:** Ao abrir o app, a lista de processos aparecia vazia ou com quantidade variável (às vezes 0, às vezes todos). Recarregar resolvia temporariamente.

**Causa raiz:** O `useEffect` que carrega processos do Supabase dependia apenas de `[isDemo]`. A sessão do Supabase é restaurada de forma assíncrona — o effect rodava antes de `session?.user?.id` estar disponível, fazendo chamadas não autenticadas. O RLS bloqueava essas chamadas e retornava 0 linhas.

**Solução aplicada:**
```js
// Antes
useEffect(() => {
  if (isDemo) { ... return; }
  load(); // rodava com session=undefined → RLS bloqueava
}, [isDemo]);

// Depois
useEffect(() => {
  if (isDemo) { ... return; }
  if (!session?.user?.id) return; // aguarda sessão estar pronta
  load();
}, [isDemo, session?.user?.id]); // re-executa quando sessão chega
```

**Lição:** efeitos que fazem chamadas autenticadas ao Supabase DEVEM ter `session?.user?.id` no array de dependências e guard no início do effect.

**Arquivo:** `src/App.jsx` — useEffect de carregamento inicial de processos.

---

## Como usar este arquivo

Ao encontrar um bug recorrente ou resolver um problema não trivial:

1. Adicione uma entrada no formato acima: ERR-NNN, sintoma, causa raiz, solução
2. Referencie os arquivos afetados
3. Inclua a "lição" — o padrão a evitar no futuro
4. Commit junto com a correção

---

## ERR-011 — ~~Swipe removido~~ (ver ERR-002)
