# Roadmap — Interview Command Center

Estado atual, próximas fases e visão de longo prazo do projeto.

---

## Estado atual (v1.4 — em produção)

### Implementado e no ar

#### Core
| Funcionalidade | Status |
|---|---|
| Interface React com Signal DS (dark/light) | ✅ |
| Gestão de processos seletivos (CRUD completo) | ✅ |
| 7 stages: Contactado → Conversa → Entrevista → Técnica → Proposta → Encerrado → Arquivado | ✅ |
| Pipeline visual com barra de progresso por stage | ✅ |
| Timeline de etapas por processo | ✅ |
| Filtro de stage funcional — pills conectados ao estado real | ✅ |
| Hover states — cards, nav, botões, tabs com transições consistentes | ✅ |
| Favicon e título personalizados | ✅ |

#### Autenticação & Segurança
| Funcionalidade | Status |
|---|---|
| Auth — email+senha + magic link + password reset | ✅ |
| Modo demonstração — dados fake sem cadastro | ✅ |
| RLS por `auth.uid()` — isolamento real de dados por usuário | ✅ |
| Edge Function autenticada — JWT obrigatório + rate limit 20 req/min | ✅ |
| Security headers — CSP, X-Frame-Options, Referrer-Policy, etc. | ✅ |

#### IA
| Funcionalidade | Status |
|---|---|
| Gerador de mensagens IA (LinkedIn / E-mail / WhatsApp) | ✅ |
| AI Coach para preparação de entrevistas | ✅ |
| **Aba Currículo** — adapta CV ao JD usando só tecnologias confirmadas, com aprovação por checkbox | ✅ |
| **Import do ChatGPT** — upload de .zip, filtro por período/projeto, extração por IA, revisão antes de salvar | ✅ |

#### Currículos & Perfil
| Funcionalidade | Status |
|---|---|
| Perfil do usuário (stack, resumo, CV base) — localStorage | ✅ |
| **Armazenamento de múltiplos CVs no Supabase** — tabela `resumes` com RLS | ✅ |
| **Upload de PDF com extração de texto** — pdfjs-dist lazy-loaded | ✅ |
| **Gestão de CVs** — modal com listagem, criar, editar, excluir, drag & drop | ✅ |

#### Infraestrutura & Mobile
| Funcionalidade | Status |
|---|---|
| Persistência em Supabase (PostgreSQL) | ✅ |
| Proxy Anthropic via Supabase Edge Function (chave segura) | ✅ |
| Deploy automático na Vercel via integração nativa GitHub | ✅ |
| CI simplificado — `npm run build` valida o build em cada PR | ✅ |
| Layout responsivo (desktop sidebar + mobile bottom nav) | ✅ |
| Mobile UX — touch targets 44px, bottom nav 52px, safe area iPhone | ✅ |
| **PWA** — manifest, service worker, ícones 192/512px, meta tags Apple/Android | ✅ |
| **Componentização** — App.jsx extraído em hooks, utils, constants, lib e components | ✅ |
| Suite de testes — 172 testes (unit + component + integration) | ✅ |
| `.env.example` com todas as variáveis documentadas | ✅ |

### Infraestrutura

- **Frontend:** Vercel — `interview-command-center` (ID: `prj_tX4zuAIvIQSzZCWDdbW6T4fQhDWr`)
- **Banco de dados:** Supabase — projeto `sumzkwjthwcdtjqheehn` (sa-east-1)
- **Auth:** Supabase Auth — email+senha + magic link + password recovery
- **Edge Function:** `anthropic-proxy` v3 — JWT obrigatório, rate limit in-memory, CORS configurável
- **Repositório:** `ghiberti85/interview-command-center`
- **Branch padrão:** `main` → aciona deploy automático

---

## Princípios que guiam o roadmap

- **Visão aberta:** funcionar como ferramenta pessoal de excelência E como portfolio técnico. Se virar produto público no futuro, a base já estará sólida.
- **Qualidade antes de crescimento:** testes e infraestrutura vêm antes de mais features.
- **IA como diferencial real:** cada feature de IA deve economizar tempo ou gerar insight que o usuário não teria sozinho.
- **Refatoração como fase dedicada:** `App.jsx` já tem ~2300 linhas — componentizar e migrar para TypeScript é a próxima grande fase técnica.

---

## v1.4 — Fundação técnica e qualidade ✅ (concluído)

Objetivo: endereçar dívida técnica crítica, completar cobertura de testes e preparar a base para crescer sem atrito.

### Segurança — pendências de ação manual no Supabase/Vercel

| Item | Prioridade |
|---|---|
| Configurar `ALLOWED_ORIGIN` na Edge Function (restringir CORS ao domínio Vercel) | 🔴 Alta |
| Aumentar senha mínima para 12 caracteres no Supabase Auth dashboard | 🔴 Alta |
| Rate limiting persistente na Edge Function (Supabase KV ou Redis) | 🟡 Média |

### Qualidade & Testes

| Item | Esforço |
|---|---|
| E2E com Playwright — fluxos críticos (demo, auth, CRUD, tema, import) | ~8h |
| Testes de integração — Supabase + MSW para aba Currículo e import ChatGPT | ~4h |
| CI com relatório de cobertura no GitHub Actions | ~2h |
| ~~Criar `.env.example` com todas as variáveis documentadas~~ | ✅ |

### Observabilidade

- **Sentry (ou Vercel monitoring)** — capturar exceptions em produção com stack trace; hoje erros de produção são invisíveis
- **Vercel Analytics** — já disponível, só precisa ser ativado — sessões, dispositivos, páginas sem comprometer privacidade

### UX rápida pendente

- **Ordenação da lista** — por urgência (próxima etapa), stage, empresa, data de contato | ✅
- **Tags editáveis inline** — adicionar/remover sem abrir modo de edição completo | ✅
- **Swipe to archive no mobile** — gesto nativo para encerrar processo | ✅
- **Indicador "contactado via"** — canal do primeiro contato (LinkedIn, E-mail, WhatsApp, Indicação) | ✅
- **FAB LinkedIn no mobile** — botão flutuante na lista para colar mensagem com 1 toque | ✅
- **MessagesTab mobile** — botão Gerar sticky, resultado no topo; nunca coberto pela bottom nav | ✅
- **ProcessDetail tabH** — altura da aba mobile corrigida para descontar bottom nav (70px) | ✅
- **MessagesTab parse** — `parseAIResponse()` robusto com fallback para JSON em markdown | ✅

### Refatoração e TypeScript

~~`App.jsx` chegou a ~2300 linhas — a componentização é agora necessária, não opcional.~~ ✅ **Concluído**: `App.jsx` foi extraído em 33 módulos organizados por domínio. O arquivo agora tem ~426 linhas (só orquestração).

**Estrutura atual:**
```
src/
├── components/   # ui/, process/, tabs/, layout/, auth/, modals/
├── hooks/        # useAuth, useIsMobile, useTheme, useUserProfile, useResumes
├── constants/    # DARK_VARS, LIGHT_VARS, GLOBAL_CSS, DEMO_PROCESSES, T, iconBtn
├── utils/        # sort, filterProcesses, dateUtils, constants, buildPrompt
└── lib/          # ai (callAI helper)
```

**Migração TypeScript (pendente v1.5):**
- Migrar em ordem: `utils/` → `hooks/` → `components/` → `App.tsx`
- Ativar `strict: true` no `tsconfig.json`
- Tipar mapeadores `rowToProcess`/`processToRow` com inferência total

---

## v1.5 — IA Avançada e Wow Factor

Objetivo: features que diferenciam o app de qualquer planilha ou Notion e tornam a IA indispensável no dia a dia.

### Implementado (v1.5-parcial)

| Funcionalidade | Status |
|---|---|
| **RecruiterMessageModal** — colar mensagem LinkedIn → IA extrai empresa/cargo/stack/salário → revisão → cria processo + rascunho de resposta | ✅ |
| **CVTab Q&A flow** — IA gera perguntas binárias sobre a JD → usuário responde sim/não → IA adapta CV com apenas o confirmado | ✅ |
| **cv_adaptations** — tabela Supabase com RLS + trigger updated_at para salvar adaptação por processo | ✅ |
| **Storage bucket cv-files** — bucket privado com políticas por user_id para CVs em PDF | ✅ |
| **useCVAdaptations hook** — CRUD de adaptações com fetch por process_id, upsert e clear | ✅ |
| **Integração ICC → DIL** — botão "Praticar para esta vaga" no OverviewTab abre DevInterviewLab com role/company/stack como query params | ✅ |
| **RecruiterMessageModal reescrito** — fluxo 3 etapas (paste→working→result), draft em plain text com DRAFT_SYSTEM dedicado, initialMsg prop, EmptyState com área de cole inline | ✅ |

### Prep Kit sob demanda ⭐

Antes de uma entrevista, com 1 clique no processo:
- Claude gera briefing da empresa (produto, stack pública, cultura, notícias recentes)
- Lista de perguntas técnicas prováveis para o cargo e stage atual
- Sugestões de perguntas para fazer ao entrevistador
- Briefing salvo na aba do processo para consulta offline

### Career Intelligence Dashboard ⭐

Painel com score de saúde do pipeline:
- Processos ativos vs. travados (sem movimento há X dias)
- Taxa de conversão por stage ("33% de Entrevista → Proposta")
- Tempo médio em cada stage
- Alertas proativos: "Faz 8 dias sem resposta da Nubank — recomendamos follow-up"
- Gráfico semanal de atividade

### Alertas de urgência

- Notificação no app quando processo está sem ação há N dias
- Próxima etapa vencendo hoje/amanhã
- Email digest semanal opcional com resumo do pipeline

### Import de vaga via URL

- Colar URL do LinkedIn Jobs, Gupy, Greenhouse, Lever
- IA extrai empresa, cargo, requisitos, localização, salário
- Cria o processo preenchido — zero digitação para processos outbound

---

## v2.0 — Plataforma e Distribuição

Objetivo: transformar o app em algo que vale compartilhar e, potencialmente, em produto para outros profissionais.

### Features de plataforma

- **Templates de resposta** — salvar mensagens que funcionaram como biblioteca reutilizável com tags e busca
- **Integração com Google Calendar** — datas de próximas etapas viram eventos com lembrete 24h antes
- **Modo Coach Compartilhável** — link read-only do pipeline para mentor ou coach de carreira
- ~~**Perfil de carreira persistente**~~ ✅ implementado na v1.3 (stack + resumo + CV no `useUserProfile`)

### Benchmark de mercado

- "Para Tech Lead em SP, média de 6 semanas até oferta. Você está na semana 4."
- "Salário mencionado na Nubank está 12% abaixo da mediana para o cargo."
- Dados gerados por Claude com base em conhecimento de mercado

### Distribuição e portfolio

- **Landing page pública** com modo demo linkável
- **Post técnico** descrevendo a arquitetura (React + Supabase + Claude API)
- **Open source opcional** — repositório público com README de onboarding
- **Product Hunt / X** — lançar como side project se decidir escalar

### Monetização (se virar produto)

- **Freemium:** tier gratuito com limite de processos + tier Pro com todas as features de IA
- **IA por cota:** limitar chamadas ao proxy por plano em vez de por minuto
- **Multi-tenant:** arquitetura já suporta — RLS por `user_id` está pronta para N usuários

---

## Dívida técnica consolidada

| Item | Prioridade | Fase |
|---|---|---|
| Configurar `ALLOWED_ORIGIN` na Edge Function | 🔴 Alta | v1.4 |
| Aumentar senha mínima para 12 chars (Supabase dashboard) | 🔴 Alta | v1.4 |
| ~~Componentizar `App.jsx`~~ | ✅ Concluído | v1.4 |
| ~~Criar `.env.example`~~ | ✅ Concluído | v1.4 |
| ~~Extrair `buildPrompt` → `src/utils/buildPrompt.js`~~ | ✅ Concluído | v1.4 |
| ~~Extrair `filterProcesses` → `src/utils/filterProcesses.js`~~ | ✅ Concluído | v1.4 |
| Configurar `ALLOWED_ORIGIN` na Edge Function | 🔴 Alta | v1.5 |
| Aumentar senha mínima para 12 chars (Supabase dashboard) | 🔴 Alta | v1.5 |
| Migrar para TypeScript (`.tsx`) com `strict: true` | 🟡 Média | v1.5 |
| Completar suite de testes E2E com Playwright | 🟡 Média | v1.5 |
| Integrar Sentry para monitoramento de erros em produção | 🟡 Média | v1.5 |
| Rate limiting persistente na Edge Function (Supabase KV) | 🟡 Média | v1.5 |
| Lazy import de JSZip (reduzir bundle inicial) | 🟢 Baixa | v1.5 |
| Extrair `checkRateLimit` → `supabase/functions/.../utils.ts` | 🟢 Baixa | v1.5 |

---

## Linha do tempo

```
v1.3 ✅        v1.4 ✅              v1.5                v2.0
  │               │                   │                  │
Em produção   Componentizado      IA Avançada         Plataforma
              UX features         Prep Kit            Calendar
              172 testes          Career Dashboard    Coach link
              .env.example        Alertas urgência    Benchmark
              buildPrompt         Import por URL      Open source?
              filterProcesses     TypeScript
                                  Testes E2E
                                  Observabilidade
```
