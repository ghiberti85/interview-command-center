# Architecture Decision Records — Interview Command Center

Cada decisão técnica relevante registrada com contexto, alternativas e consequências.
Formato: ADR (Architecture Decision Record).

---

## ADR-001 — React inline styles em vez de CSS externo/Tailwind

**Status:** Ativo  
**Data:** v1.0

**Contexto:** Precisávamos de um sistema de UI que permitisse iteração rápida com assistência de IA e suporte nativo a dark/light mode sem classes condicionais.

**Decisão:** 100% inline styles com CSS custom properties injetadas dinamicamente no `document.documentElement`.

**Alternativas consideradas:**
- Tailwind CSS — geração de classes condicionais dificulta leitura de IA; purge pode remover classes em uso
- CSS Modules — adiciona fricção de arquivo extra por componente
- Styled Components — overhead de runtime desnecessário

**Consequências:**
- ✅ IA edita estilos diretamente no JSX sem contexto externo
- ✅ Dark/light mode com uma única fonte de verdade (CSS vars)
- ❌ Sem autocomplete de classes; bundle ligeiramente maior

---

## ADR-002 — Estado global via prop drilling (sem Context/Redux)

**Status:** Ativo  
**Data:** v1.0

**Contexto:** App com ~5-8 níveis de profundidade de componentes; estado global inclui `processes`, `selected`, `session`, `profile`, `view`.

**Decisão:** `useState` no `App.jsx` com prop drilling explícito para os filhos.

**Alternativas consideradas:**
- React Context — adiciona boilerplate; dificulta rastreamento de re-renders por IA
- Zustand/Jotai — dependência extra sem benefício claro para o tamanho do app
- Redux — overkill para o escopo atual

**Consequências:**
- ✅ Fluxo de dados completamente rastreável no `App.jsx`
- ✅ Zero dependências extras de gerenciamento de estado
- ❌ Props longas em componentes profundos (aceitável até v2.0)

---

## ADR-003 — Proxy Anthropic via Supabase Edge Function

**Status:** Ativo  
**Data:** v1.0

**Contexto:** API Anthropic requer chave secreta; chamadas do frontend exporiam a chave no bundle.

**Decisão:** Edge Function `anthropic-proxy` com `verify_jwt: true` — toda chamada exige JWT válido do Supabase Auth.

**Alternativas consideradas:**
- Chamar API diretamente com chave no `.env` — chave exposta no bundle Vite
- Serverless function na Vercel — segunda plataforma para gerenciar; sem integração nativa com Supabase Auth
- BFF dedicado (Express/Fastify) — infraestrutura adicional desnecessária

**Consequências:**
- ✅ Chave Anthropic nunca exposta; sem chamadas não autenticadas
- ✅ Rate limiting por usuário centralizado
- ❌ Latência extra (~50ms) pelo hop na Edge Function

---

## ADR-004 — `process.id` como `text` (não `uuid`)

**Status:** Ativo  
**Data:** v1.1

**Contexto:** IDs de processo precisavam ser gerados no cliente antes do INSERT para evitar round-trip.

**Decisão:** `crypto.randomUUID()` no cliente → salvo como `text` no Supabase.

**Alternativas consideradas:**
- `uuid` com `gen_random_uuid()` no banco — requer buscar o ID após INSERT
- Sequencial incremental — enumerável, vaza volume de dados

**Consequências:**
- ✅ Sem round-trip; processo existe localmente antes de confirmar no banco
- ⚠️ FK em `cv_adaptations.process_id` deve ser `text`, não `uuid` — ponto de confusão documentado no SCHEMA.md

---

## ADR-005 — `useIsMobile` com JS em vez de media queries CSS

**Status:** Ativo  
**Data:** v1.1

**Contexto:** Layouts mobile e desktop são estruturalmente diferentes — não apenas ajustes de tamanho.

**Decisão:** `ResizeObserver` com breakpoint em 768px; `isMobile` booleano passado como prop.

**Alternativas consideradas:**
- `@media` CSS — permite apenas variações de estilo, não troca de estrutura JSX
- `window.innerWidth` sem observer — não atualiza ao redimensionar

**Consequências:**
- ✅ Layouts completamente diferentes para mobile e desktop
- ✅ Sem CSS duplicado ou overrides de media query
- ❌ Re-render no resize (aceito — breakpoint raramente muda em uso real)

---

## ADR-006 — Service Worker com estratégia network-first

**Status:** Ativo  
**Data:** v1.5 (substituiu cache-first da v1.0)

**Contexto:** PWA servia bundle JS/CSS cacheado mesmo após deploys, impedindo usuários de ver atualizações.

**Decisão:** network-first para todos os assets — busca na rede, usa cache apenas como fallback offline.

**Alternativas consideradas:**
- Cache-first com cache-busting por hash — Vite já faz hash, mas o SW não atualizava o cache index.html
- Stale-while-revalidate — usuário ainda vê versão antiga na primeira carga após deploy

**Consequências:**
- ✅ Usuários sempre recebem código atualizado
- ❌ Sem funcionamento offline para assets dinâmicos (aceitável — app requer auth/banco)

---

## ADR-007 — 3 abas em vez de 5 no ProcessDetail

**Status:** Ativo  
**Data:** v1.5.1

**Contexto:** 5 abas (Overview, Timeline, Mensagens, IA, Currículo) criavam carga cognitiva alta e duplicação de contexto.

**Decisão:** Consolidar em 3: Conversa / Vaga / Currículo.

**Mapeamento:**
- Conversa = Mensagens + IA (thread unificado)
- Vaga = Overview + Timeline (dados + auto-stage)
- Currículo = Currículo (inalterado)

**Consequências:**
- ✅ Fluxo principal (colar mensagem → gerar resposta → salvar) em uma única aba
- ✅ Auto-stage elimina necessidade de atualizar stage manualmente
- ❌ TimelineTab, AITab, OverviewTab, MessagesTab removidos — testes correspondentes removidos

---

## ADR-008 — `--sab` CSS var para safe-area-inset-bottom

**Status:** Ativo  
**Data:** v1.5

**Contexto:** `viewport-fit=cover` no `index.html` faz `env(safe-area-inset-bottom)` retornar ~34px no Safari browser (não apenas PWA), causando espaçamento extra indesejado no bottom nav em modo browser.

**Decisão:** Injetar `--sab` via `useEffect` no App: `env(safe-area-inset-bottom)` apenas quando `isPWA === true`, `0px` caso contrário.

```js
document.documentElement.style.setProperty(
  "--sab",
  isPWA ? "env(safe-area-inset-bottom, 0px)" : "0px"
);
```

**Consequências:**
- ✅ Bottom nav sem espaço extra em modo browser
- ✅ Safe area correta em modo PWA no iPhone
- ⚠️ `isPWA` detectado via `window.matchMedia("(display-mode: standalone)")` — pode falhar em alguns cenários de WebView

---

## ADR-009 — `position: fixed; inset: 0` para container raiz mobile

**Status:** Ativo  
**Data:** v1.5

**Contexto:** `height: 100dvh` no container raiz causava salto de layout quando o teclado virtual subia no iOS Safari.

**Decisão:** Container raiz mobile com `position: fixed; inset: 0` — imune a mudanças do viewport causadas por teclado e barra de endereço.

**Consequências:**
- ✅ Sem salto de layout ao abrir teclado
- ✅ Bottom nav sempre fixo na posição correta
- ❌ Scroll do documento desabilitado — toda área scrollável deve usar `overflow-y: auto` explicitamente

---

## ADR-010 — `cv_adaptations.content` como texto, não arquivo no Storage

**Status:** Ativo  
**Data:** v1.5

**Contexto:** CV adaptado é gerado por IA e o usuário o copia para usar externamente.

**Decisão:** Salvar como `text` na tabela `cv_adaptations`, não como arquivo no Storage bucket.

**Alternativas consideradas:**
- Storage bucket — overhead de upload/download para texto puro; sem benefício para o caso de uso

**Consequências:**
- ✅ Leitura/escrita simples via query SQL
- ✅ Sem custo de Storage para texto
- ❌ Limite de tamanho da coluna text (PostgreSQL suporta até 1GB — na prática irrelevante)
