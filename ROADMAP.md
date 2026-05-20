# Roadmap — Interview Command Center

Estado atual, próximas fases e visão de longo prazo do projeto.

---

## Estado atual (v1.2 — em produção)

### Implementado e no ar

| Funcionalidade | Status |
|---|---|
| Interface React com Signal DS (dark/light) | ✅ |
| Gestão de processos seletivos (CRUD) | ✅ |
| 7 stages: Contactado → Conversa → Entrevista → Técnica → Proposta → Encerrado → Arquivado | ✅ |
| Pipeline visual com barra de progresso por stage | ✅ |
| Timeline de etapas por processo | ✅ |
| Gerador de mensagens IA (LinkedIn / E-mail / WhatsApp) | ✅ |
| AI Coach para preparação de entrevistas | ✅ |
| Layout responsivo (desktop sidebar + mobile bottom nav) | ✅ |
| **PWA** — manifest, service worker, ícones, meta tags Apple/Android | ✅ |
| **Mobile AI Tab** — scroll horizontal nos quick actions, safe area, isMobile prop | ✅ |
| Persistência em Supabase (PostgreSQL) | ✅ |
| Proxy Anthropic via Supabase Edge Function (chave segura) | ✅ |
| Deploy automático na Vercel via GitHub Actions | ✅ |
| Favicon e título personalizados | ✅ |
| Autenticação — email+senha + magic link + password reset | ✅ |
| Modo demonstração — dados fake sem cadastro | ✅ |
| RLS por `auth.uid()` — isolamento real de dados por usuário | ✅ |
| Edge Function autenticada — JWT obrigatório + rate limit 20 req/min | ✅ |
| Security headers — CSP, X-Frame-Options, Referrer-Policy, etc. | ✅ |
| Filtro de stage funcional — pills conectados ao estado real | ✅ |
| Mobile UX — touch targets 44px, bottom nav 52px, indicador de aba ativo | ✅ |
| Hover states — cards, nav, botões, tabs com transições consistentes | ✅ |
| Suite de testes — 93 testes (unit + component + integration) | ✅ |

### Infraestrutura

- **Frontend:** Vercel — `interview-command-center` (ID: `prj_tX4zuAIvIQSzZCWDdbW6T4fQhDWr`)
- **Banco de dados:** Supabase — projeto `sumzkwjthwcdtjqheehn` (sa-east-1)
- **Auth:** Supabase Auth — email+senha + magic link + password recovery
- **Edge Function:** `anthropic-proxy` v3 — JWT obrigatório, rate limit, CORS configurável
- **Repositório:** `ghiberti85/interview-command-center`
- **Branch padrão:** `main` → aciona deploy automático

---

## Princípios que guiam o roadmap

- **Visão aberta:** o app deve funcionar como ferramenta pessoal de excelência E como portfolio técnico. Se virar produto público no futuro, a base já estará sólida.
- **Qualidade antes de crescimento:** testes e infraestrutura vêm antes de mais features. Crescer em cima de base frágil cria dívida que paralisa.
- **IA como diferencial real:** não usar IA como decoração — cada feature de IA deve economizar tempo ou gerar insight que o usuário não teria sozinho.
- **Arquivo único enquanto faz sentido:** refatorar e migrar para TypeScript como fase dedicada, não como patches incrementais.

---

## v1.3 — Fundação sólida (próximos 1–2 meses)

Objetivo: consolidar qualidade, cobrir débitos técnicos prioritários e preparar o terreno para crescimento seguro.

### Segurança (pendências de ação manual)

| Item | Prioridade |
|---|---|
| Configurar `ALLOWED_ORIGIN` na Edge Function (restringir CORS ao domínio Vercel) | 🔴 Alta |
| Aumentar senha mínima para 12 caracteres no Supabase Auth dashboard | 🔴 Alta |
| Rate limiting persistente na Edge Function (Redis / Supabase KV) | 🟡 Média |

### Testes — completar cobertura

Ver plano completo em `TESTING.md`. Lacunas priorizadas:

| Item | Esforço estimado |
|---|---|
| E2E com Playwright — fluxos críticos (demo, auth, CRUD, tema) | ~6h |
| Testes de integração — Supabase + MSW | ~4h |
| Cobertura de edge cases de UI (mobile, filtros, AI tab) | ~3h |
| CI com relatório de cobertura no GitHub Actions | ~2h |

### Infraestrutura & Observabilidade

- **Monitoramento de erros:** integrar Sentry (ou similar) para capturar exceptions em produção com stack trace real — hoje os erros de produção são invisíveis
- **Analytics leve:** Vercel Analytics já disponível — ativar para entender padrões de uso (sessões, páginas, dispositivos) sem comprometer privacidade
- ~~**PWA básica:** `manifest.json` + service worker mínimo para "Add to Home Screen" no mobile~~ ✅ implementado
- **Variáveis de ambiente documentadas:** criar `.env.example` com todas as vars necessárias (hoje ausente, dificulta onboarding futuro)

### UX rápida

- **Ordenação da lista** — por urgência (próxima etapa), por stage, por empresa, por data
- **Tags editáveis inline** — sem abrir modo de edição completo
- **Swipe to archive no mobile** — gesto nativo para arquivar processo
- **Indicador "contactado via"** — canal do primeiro contato (LinkedIn, E-mail, WhatsApp, Indicação)

---

## v1.4 — Refatoração e TypeScript (mês 2–3)

Objetivo: transformar o arquivo único em arquitetura componentizada e migrar para TypeScript. Pré-requisito para crescer sem atrito.

### Por que fazer isso como fase dedicada

- `App.jsx` já tem ~1600 linhas — em mais 2 versões vai ultrapassar 2000
- TypeScript elimina uma classe inteira de bugs silenciosos (mapeadores `rowToProcess`, props erradas, stages inválidos)
- Facilita onboarding de colaboradores futuros e uso como portfolio técnico

### Plano de componentização

```
src/
├── components/
│   ├── ui/           # Btn, Badge, Ic, iconBtn — primitivos do Signal DS
│   ├── layout/       # Sidebar, Header, BottomNav
│   ├── process/      # ProcessCard, ProcessDetail, PipelineBar, Timeline
│   ├── forms/        # AddProcessModal, EditProcessModal, SetPasswordModal
│   └── ai/           # MessagesTab, CoachTab, AITab
├── hooks/            # useAuth, useIsMobile, useProcesses, useTheme
├── utils/            # buildPrompt, filterProcesses, fmtDate, daysDiff
├── types/            # Process, Step, Stage (interfaces TypeScript)
├── constants/        # STAGE, SCENARIOS, DEMO_PROCESSES
└── lib/
    ├── supabase.ts   # client + mapeadores tipados
    └── ai.ts         # callAI, prompt builders
```

### Migração TypeScript

- Migrar em ordem: `types/` → `utils/` → `hooks/` → `components/` → `App.tsx`
- Tipar os mapeadores `rowToProcess` e `processToRow` com inferência total
- Ativar `strict: true` no `tsconfig.json`
- Atualizar Vitest e RTL para `.tsx`

---

## v1.5 — IA Avançada e Wow Factor (mês 3–4)

Objetivo: features que causam impacto imediato na vida do usuário e diferenciam o app de qualquer planilha ou Trello.

### Import de conversas do ChatGPT

**O problema:** o usuário tem meses de histórico de conversas com recrutadores no ChatGPT que não estão no app.

**O fluxo:**
1. Exportar histórico via ChatGPT Settings → Data Controls → Export
2. Upload do `.zip` no app
3. Claude analisa cada conversa e detecta as que são sobre recrutamento
4. Extrai: empresa, cargo, recrutador, email, stage estimado, datas, notas
5. Exibe tela de preview com todos os processos detectados
6. Usuário revisa, edita se necessário, confirma importação
7. Processos criados no banco com `origin: "imported"`

**Dados extraídos automaticamente:**
- Nome da empresa e cargo
- Nome e email do recrutador (quando mencionados)
- Stage aproximado baseado no conteúdo
- Data do primeiro contato (pelo timestamp da conversa)
- Resumo da conversa como `notes`
- Tags inferidas (remoto, híbrido, stack mencionada, senioridade)

**Complexidade:** média — requer componente de upload, parsing do JSON do ChatGPT, prompt de extração estruturada, tela de preview/confirmação.

### Prep Kit sob demanda

Antes de uma entrevista, com 1 clique:
- Claude pesquisa a empresa (produto, tech stack pública, cultura, notícias recentes)
- Gera perguntas técnicas prováveis para o cargo
- Sugere perguntas para o usuário fazer ao entrevistador
- Monta briefing de 1 página salvo no processo

### Career Intelligence Dashboard

Score de saúde do pipeline em tempo real:
- Processos ativos vs. travados (sem movimento há X dias)
- Taxa de conversão por stage (ex: "33% de Entrevista → Proposta")
- Tempo médio em cada stage
- Alerta proativo: "Faz 8 dias sem resposta da Nubank — recomendamos follow-up"
- Tendência de atividade (gráfico semanal de novas interações)

### Alertas de urgência

Notificações baseadas em padrões:
- Processo sem ação há mais de N dias (configurável)
- Próxima etapa vence hoje / amanhã
- Follow-up sugerido por IA com base no histórico
- Entrega via: banner no app + email digest semanal opcional

### Import de vaga via URL

- Colar URL do LinkedIn Jobs, Gupy, Greenhouse, Lever, Workday
- IA extrai empresa, cargo, requisitos, localização, modelo de trabalho, salário (quando disponível)
- Cria o processo com todos os campos preenchidos
- Zero digitação para processos outbound

---

## v2.0 — Plataforma e Distribuição (mês 5+)

Objetivo: transformar o app em algo que vale compartilhar e, potencialmente, em produto para outros profissionais.

### Features de plataforma

- **Templates de resposta** — salvar mensagens que funcionaram como biblioteca reutilizável com tags e busca
- **Integração com Google Calendar** — datas de próximas etapas viram eventos com lembrete 24h antes e link direto para o processo
- **Modo Coach Compartilhável** — link read-only do pipeline para mentor, coach de carreira ou amigo de confiança; eles veem e comentam, você mantém controle total
- **Perfil de carreira persistente** — CV resumido, stack preferida, pretensão salarial; IA usa como contexto automático em todos os prompts

### Benchmark de mercado

Claude contextualiza dados do usuário com padrões de mercado:
- "Para Tech Lead em SP, média de 6 semanas até oferta. Você está na semana 4."
- "Salário mencionado na Nubank está 12% abaixo da mediana para o cargo."
- Dados gerados por IA com base em conhecimento de mercado (sem scraping)

### Distribuição e portfolio

- **Landing page pública** com modo demo linkável — qualquer recrutador que ver o app pode experimentar na hora
- **Post técnico** descrevendo a arquitetura (React + Supabase + Claude API) — serve como conteúdo de portfolio
- **Open source opcional** — tornar o repositório público com README de onboarding completo
- **Product Hunt / X** — lançar como side project se decidir escalar

### Monetização (se virar produto)

- **Freemium:** tier gratuito com limite de processos (ex: 10 ativos) + tier Pro com todas as features de IA
- **IA por cota:** limitar chamadas ao proxy por plano em vez de por minuto
- **Supabase multi-tenant:** arquitetura já suporta — RLS por `user_id` está pronta para N usuários

---

## Dívida técnica consolidada

| Item | Prioridade | Fase |
|---|---|---|
| Configurar `ALLOWED_ORIGIN` na Edge Function | 🔴 Alta | v1.3 |
| Aumentar senha mínima para 12 chars (Supabase dashboard) | 🔴 Alta | v1.3 |
| Criar `.env.example` com todas as variáveis | 🟡 Média | v1.3 |
| Integrar Sentry para monitoramento de erros em produção | 🟡 Média | v1.3 |
| Completar suite de testes E2E com Playwright | 🟡 Média | v1.3 |
| Rate limiting persistente na Edge Function (Supabase KV) | 🟡 Média | v1.4 |
| Componentizar `App.jsx` (arquivo único, ~1600 linhas) | 🟡 Média | v1.4 |
| Migrar para TypeScript (`.tsx`) com `strict: true` | 🟡 Média | v1.4 |
| Extrair `buildPrompt` → `src/utils/buildPrompt.ts` | 🟢 Baixa | v1.4 |
| Extrair `filterProcesses` → `src/utils/filterProcesses.ts` | 🟢 Baixa | v1.4 |
| Extrair `checkRateLimit` → `supabase/functions/.../utils.ts` | 🟢 Baixa | v1.4 |

---

## Visão de versões — linha do tempo

```
Agora          Mês 1-2         Mês 2-3         Mês 3-4         Mês 5+
  │               │               │               │               │
v1.2           v1.3            v1.4            v1.5            v2.0
  │               │               │               │               │
Em produção    Segurança       Refatoração     IA Avançada     Plataforma
               Testes E2E      TypeScript      Import ChatGPT  Calendar
               PWA             Componentizar   Prep Kit        Coach link
               Observabilidade                 Dashboard       Benchmark
               UX rápida                       Alertas         Open source?
```
