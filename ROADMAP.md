# Roadmap — Interview Command Center

Estado atual e próximas melhorias do projeto.

---

## Estado atual (v1.0 — MVP em produção)

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

### Infraestrutura

- **Frontend:** Vercel — `interview-command-center` (ID: `prj_tX4zuAIvIQSzZCWDdbW6T4fQhDWr`)
- **Banco de dados:** Supabase — projeto `sumzkwjthwcdtjqheehn` (sa-east-1)
- **Edge Function:** `anthropic-proxy` — roteamento seguro para API Anthropic
- **Repositório:** `ghiberti85/interview-command-center`
- **Branch padrão:** `main` → aciona deploy automático

---

## v1.1 — UX e filtragem (próxima milestone)

### Alta prioridade

- **Filtro por stage na lista** — pills de stage já existem visualmente, precisam ser conectados ao estado real
- **Ordenação da lista** — por urgência (próxima etapa), por stage, por empresa, por data de contato
- **Tags editáveis inline** — adicionar/remover tags sem abrir modo de edição completo
- **Indicador de "contactado via"** — campo de canal do primeiro contato (LinkedIn, E-mail, WhatsApp, Indicação)

### Média prioridade

- **Exportar para CSV** — lista de processos com dados principais
- **Swipe to archive no mobile** — gesto de deslizar para arquivar ou mover stage

---

## v1.2 — IA avançada

- **Análise de compatibilidade** — colar JD e receber score de match + gaps identificados
- **Prep kit automático** — briefing completo antes de cada entrevista (empresa, perguntas prováveis, o que perguntar)
- **Resumo semanal** — gerado por IA com status de todos os processos + ação prioritária sugerida
- **Import de vaga via URL** — colar URL do LinkedIn Jobs / Gupy e a IA preenche a ficha automaticamente

---

## v1.3 — Autenticação e multi-dispositivo

- **Auth com magic link ou Google OAuth** via Supabase Auth
- **Row Level Security por usuário** — atualmente RLS está aberta (`allow_all_anon`), precisa ser travada por `auth.uid()`
- **Perfil de carreira persistente** — CV, stack, pretensão salarial (IA usa como contexto automático)

---

## v2.0 — Plataforma

- **Templates de resposta** — salvar mensagens que funcionaram como biblioteca reutilizável
- **Integração com Google Calendar** — sincronizar datas de próximas etapas como eventos
- **Modo coach/mentoria** — compartilhar pipeline com mentor via link read-only

---

## Dívida técnica

| Item | Prioridade |
|---|---|
| Componentizar `App.jsx` (atualmente arquivo único, ~1500 linhas) | Média — quando arquivo superar 2000 linhas |
| Migrar para TypeScript (`.tsx`) | Baixa |
| Testes automatizados (Vitest + Playwright) | Média |
| Travar RLS do Supabase com auth real | Alta — antes de qualquer dado sensível |
