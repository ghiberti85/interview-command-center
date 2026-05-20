# Roadmap — Interview Command Center

Estado atual e próximas melhorias do projeto.

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
| Persistência em Supabase (PostgreSQL) | ✅ |
| Proxy Anthropic via Supabase Edge Function (chave segura) | ✅ |
| Deploy automático na Vercel via GitHub Actions | ✅ |
| Favicon e título personalizados | ✅ |
| **Autenticação** — email+senha + magic link + password reset | ✅ |
| **Modo demonstração** — dados fake sem cadastro | ✅ |
| **RLS por `auth.uid()`** — isolamento real de dados por usuário | ✅ |
| **Edge Function autenticada** — JWT obrigatório + rate limit 20 req/min | ✅ |
| **Security headers** — CSP, X-Frame-Options, Referrer-Policy, etc. | ✅ |
| **Filtro de stage funcional** — pills conectados ao estado real | ✅ |
| **Mobile UX** — touch targets 44px, bottom nav 52px, indicador de aba ativo | ✅ |
| **Hover states** — cards, nav, botões, tabs com transições consistentes | ✅ |

### Infraestrutura

- **Frontend:** Vercel — `interview-command-center` (ID: `prj_tX4zuAIvIQSzZCWDdbW6T4fQhDWr`)
- **Banco de dados:** Supabase — projeto `sumzkwjthwcdtjqheehn` (sa-east-1)
- **Auth:** Supabase Auth — email+senha + magic link + password recovery
- **Edge Function:** `anthropic-proxy` v3 — JWT obrigatório, rate limit, CORS configurável
- **Repositório:** `ghiberti85/interview-command-center`
- **Branch padrão:** `main` → aciona deploy automático

---

## v1.3 — UX avançada e produtividade

### Alta prioridade

- **Ordenação da lista** — por urgência (próxima etapa), por stage, por empresa, por data de contato
- **Tags editáveis inline** — adicionar/remover tags sem abrir modo de edição completo
- **Swipe to archive no mobile** — gesto de deslizar para arquivar ou mover stage

### Média prioridade

- **Exportar para CSV** — lista de processos com dados principais
- **Indicador de "contactado via"** — campo de canal do primeiro contato (LinkedIn, E-mail, WhatsApp, Indicação)

---

## v1.4 — IA avançada

- **Análise de compatibilidade** — colar JD e receber score de match + gaps identificados
- **Prep kit automático** — briefing completo antes de cada entrevista (empresa, perguntas prováveis, o que perguntar)
- **Resumo semanal** — gerado por IA com status de todos os processos + ação prioritária sugerida
- **Import de vaga via URL** — colar URL do LinkedIn Jobs / Gupy e a IA preenche a ficha automaticamente

---

## v2.0 — Plataforma

- **Templates de resposta** — salvar mensagens que funcionaram como biblioteca reutilizável
- **Integração com Google Calendar** — sincronizar datas de próximas etapas como eventos
- **Modo coach/mentoria** — compartilhar pipeline com mentor via link read-only
- **Perfil de carreira persistente** — CV, stack, pretensão salarial (IA usa como contexto automático)

---

## Dívida técnica

| Item | Prioridade |
|---|---|
| Componentizar `App.jsx` (atualmente arquivo único, ~1600 linhas) | Média — quando arquivo superar 2000 linhas |
| Migrar para TypeScript (`.tsx`) | Baixa |
| Testes automatizados (Vitest + Playwright) | Média |
| Configurar `ALLOWED_ORIGIN` na Edge Function (restringir CORS ao domínio Vercel) | Alta — pendente ação manual no Supabase dashboard |
| Aumentar senha mínima no Supabase Auth dashboard para 12 caracteres | Alta — pendente ação manual |
| Rate limiting persistente na Edge Function (Redis / Supabase KV) | Baixa — atual é in-memory, reseta com cold start |
