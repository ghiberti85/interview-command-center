# Roadmap — Interview Command Center

Funcionalidades planejadas, organizadas por prioridade e complexidade de implementação.

---

## Legenda

| Símbolo | Significado |
|---|---|
| 🔴 | Alta prioridade |
| 🟡 | Média prioridade |
| 🟢 | Nice to have |
| ⚙️ | Técnico / infraestrutura |
| 🤖 | Envolve IA |
| 📱 | Mobile-first |

---

## v1.1 — Persistência e UX (próxima milestone)

### 🔴 Persistência de dados com localStorage
- Salvar processos localmente entre sessões
- Sincronizar tema (dark/light) entre recarregamentos
- Restaurar processo selecionado ao retornar

```js
// Implementação sugerida
useEffect(() => {
  localStorage.setItem('ioc-processes', JSON.stringify(processes));
}, [processes]);
```

### 🔴 Filtro por stage na lista
- Pills de stage já estão presentes visualmente na versão mobile
- Conectar ao estado de filtro real (atualmente decorativos)

### 🔴 Tags editáveis inline
- Adicionar/remover tags na ficha sem entrar em modo de edição completo
- Input inline com sugestões de tags já usadas

### 🟡 Indicador de "contactado via" na timeline
- Campo para registrar o canal do primeiro contato (LinkedIn, E-mail, WhatsApp, Indicação)
- Exibir ícone na primeira entrada da timeline

### 🟡 Ordenação da lista de processos
- Por data de próxima etapa (urgência)
- Por stage (agrupado)
- Por empresa (alfabético)
- Por data de contato (mais recente)

### 📱 Swipe to archive no mobile
- Gesto de deslizar para arquivar ou mover stage no mobile

---

## v1.2 — Notificações e alertas

### 🔴 Lembretes de follow-up
- Alerta quando um processo ficou mais de X dias sem atividade
- Banner na lista indicando processos "dormentes"

### 🟡 Exportar para CSV / PDF
- Lista de processos com dados principais
- Útil para compartilhar status com mentores ou coaches

### 🟡 Resumo semanal gerado por IA 🤖
- Botão no dashboard que gera um resumo da semana:
  - Quantos processos avançaram
  - Próximas etapas críticas
  - Sugestão de ação prioritária

---

## v1.3 — Persistência em nuvem

### ⚙️ Backend com Supabase
- Autenticação com magic link ou Google OAuth
- Tabela `processes` no PostgreSQL via Supabase
- Row Level Security (RLS) para dados por usuário
- Sincronização em tempo real entre dispositivos

Schema sugerido:
```sql
create table processes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  company text not null,
  role text not null,
  stage text not null default 'contacted',
  origin text not null default 'inbound',
  location text,
  salary text,
  recruiter text,
  recruiter_email text,
  job_url text,
  tags text[],
  notes text,
  next_step_note text,
  next_step_date date,
  contacted_date date,
  starred boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table process_steps (
  id uuid primary key default gen_random_uuid(),
  process_id uuid references processes on delete cascade,
  date date not null,
  type text not null,
  note text,
  created_at timestamptz default now()
);

alter table processes enable row level security;
create policy "Users own their processes" on processes
  for all using (auth.uid() = user_id);
```

### ⚙️ Proxy de API seguro (Supabase Edge Functions)
- Mover chamadas à API Anthropic para o servidor
- Remover chave do bundle do frontend
- Implementar rate limiting por usuário

---

## v1.4 — IA avançada

### 🤖 Análise de compatibilidade
- Cole a descrição da vaga → a IA analisa compatibilidade com seu perfil
- Score de match + gaps identificados + pontos fortes a destacar

### 🤖 Prep kit automático por empresa
- Antes de uma entrevista, gere um briefing completo:
  - Pesquisa pública sobre a empresa (modelo de negócio, funding, cultura)
  - Perguntas prováveis por etapa
  - Respostas sugeridas baseadas no seu histórico
  - Perguntas que você deve fazer ao entrevistador

### 🤖 Análise de padrões
- Com histórico suficiente, identificar padrões:
  - Quais stages têm maior taxa de avanço
  - Quanto tempo em média cada stage leva
  - Empresas / setores com melhor conversão

### 🤖 Geração de CV personalizado
- Com base nos dados da vaga, sugerir ajustes no CV
- Highlight das experiências mais relevantes para aquele cargo específico

---

## v1.5 — Integrações

### 🟡 Import de vagas via URL
- Cole uma URL do LinkedIn Jobs, Gupy, etc.
- IA extrai empresa, cargo, requisitos e preenche a ficha automaticamente

### 🟢 Integração com LinkedIn (via extensão de browser)
- Botão "Adicionar ao Interview OS" em páginas de vagas do LinkedIn
- Captura automática dos dados básicos

### 🟢 Calendário (Google Calendar)
- Sincronizar datas de próximas etapas como eventos no calendário
- Lembrete automático 1 dia antes de cada etapa

### 🟢 Email parser
- Encaminhar e-mails de recrutadores para um endereço dedicado
- Sistema processa e atualiza o processo automaticamente

---

## v2.0 — Plataforma multi-usuário

### ⚙️ Contas e autenticação completa
- Registro, login, recuperação de senha
- Perfil de usuário com informações de carreira

### 🤖 Perfil de carreira persistente
- CV, stack, pretensão salarial, preferências (remoto, híbrido, presencial)
- IA usa esse contexto em todas as gerações sem precisar descrever a cada vez

### 🟡 Templates de resposta customizados
- Salvar respostas que funcionaram bem como templates reutilizáveis
- Biblioteca pessoal de mensagens por tipo de situação

### 🟢 Modo coach / mentoria
- Compartilhar pipeline com um mentor via link
- Mentor pode adicionar comentários e sugestões nos processos

---

## Itens técnicos

### ⚙️ Componentização do App.jsx
Dividir o arquivo único em módulos:

```
src/
├── components/
│   ├── Badge.jsx
│   ├── Btn.jsx
│   ├── ProcessCard.jsx
│   ├── ProcessDetail/
│   │   ├── index.jsx
│   │   ├── OverviewTab.jsx
│   │   ├── TimelineTab.jsx
│   │   ├── MessagesTab.jsx
│   │   └── AITab.jsx
│   ├── Dashboard.jsx
│   ├── NewProcessModal.jsx
│   └── layout/
│       ├── Sidebar.jsx
│       ├── MobileNav.jsx
│       └── Header.jsx
├── hooks/
│   ├── useIsMobile.js
│   ├── useTheme.js
│   └── useProcesses.js
├── lib/
│   ├── ai.js          # callAI e buildPrompt
│   ├── stages.js      # STAGE config
│   └── channels.js    # CHANNELS config
├── design-system/
│   ├── tokens.js      # DARK_VARS, LIGHT_VARS
│   └── primitives.jsx # T, Ic, Btn
└── App.jsx            # Apenas layout e roteamento
```

### ⚙️ Testes automatizados
Veja [`TESTING.md`](./TESTING.md) para detalhes.

### ⚙️ TypeScript
- Migrar para `.tsx` com tipos para `Process`, `Step`, `Stage`, etc.
- Melhor DX e segurança em refatorações

### ⚙️ CI/CD
- GitHub Actions para lint e build em cada PR
- Preview deployments automáticos no Vercel

---

## Como contribuir com o roadmap

Abra uma [issue](https://github.com/ghiberti85/interview-command-center/issues) com a label `enhancement` descrevendo:
1. O problema que a feature resolve
2. A solução proposta
3. Alternativas consideradas

Itens do roadmap podem ser discutidos e re-priorizados via issues.
