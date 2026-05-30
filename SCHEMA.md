# Schema — Interview Command Center

Documento de referência para o banco de dados Supabase. **Consulte antes de criar qualquer migration.**

Projeto Supabase: `sumzkwjthwcdtjqheehn` (sa-east-1)

---

## Convenção geral

- Banco usa `snake_case`. App usa `camelCase`.
- Sempre use os mapeadores em `src/supabase.js` — nunca acesse colunas diretamente pelo nome raw no componente.
- **Todo INSERT e UPSERT deve incluir `user_id: session?.user?.id`.**
- RLS ativa em todas as tabelas — sem `user_id` correto a operação falha silenciosamente.

---

## Tabelas

### `processes`

Tabela principal. Um registro por processo seletivo.

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | `text` | NOT NULL | — | PK — `crypto.randomUUID()` gerado no cliente |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users.id` |
| `company` | `text` | NOT NULL | — | Nome da empresa |
| `role` | `text` | NOT NULL | — | Título do cargo |
| `stage` | `text` | NOT NULL | `'contacted'` | Enum: contacted, screening, interview, technical, offer, rejected, archived |
| `location` | `text` | YES | `''` | Localização ou regime (ex: "Remoto") |
| `salary` | `text` | YES | `''` | Faixa salarial em texto livre |
| `recruiter` | `text` | YES | `''` | Nome do recrutador |
| `recruiter_email` | `text` | YES | `''` | Email do recrutador |
| `origin` | `text` | YES | `'inbound'` | `'inbound'` ou `'outbound'` |
| `contacted_date` | `date` | YES | — | Data do primeiro contato (YYYY-MM-DD) |
| `next_step_date` | `date` | YES | — | Data da próxima etapa |
| `next_step_note` | `text` | YES | `''` | Descrição da próxima etapa |
| `job_url` | `text` | YES | `''` | URL da vaga — validar `https?://` antes de renderizar |
| `tags` | `text[]` | YES | `'{}'` | Array de tecnologias/tags |
| `notes` | `text` | YES | `''` | Notas livres do usuário |
| `steps` | `jsonb` | YES | `'[]'` | Array de `Step` — ver tipo abaixo |
| `ai_context` | `text` | YES | `''` | Contexto adicional para IA |
| `starred` | `boolean` | YES | `false` | Processo marcado como favorito |
| `channel` | `text` | YES | — | Canal do primeiro contato: linkedin, email, whatsapp, indicacao, null |
| `sent_messages` | `jsonb` | YES | `'[]'` | Array de mensagens enviadas — ver tipo abaixo |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Criação automática |
| `updated_at` | `timestamptz` | YES | — | Atualizado manualmente no UPSERT |

**Tipo `Step` (dentro de `steps`):**
```ts
{
  date: string;   // "YYYY-MM-DD"
  type: string;   // mesmo enum de stage
  note: string;
}
```

**Tipo `SentMessage` (dentro de `sent_messages`):**
```ts
{
  id: string;           // crypto.randomUUID()
  recruiterMsg: string; // mensagem recebida
  reply: string;        // resposta gerada/enviada
  channel: string;      // canal usado
  sentAt: string;       // ISO 8601
}
```

**RLS (4 políticas):**
```sql
-- SELECT
auth.uid() = user_id

-- INSERT
auth.uid() = user_id

-- UPDATE
auth.uid() = user_id

-- DELETE
auth.uid() = user_id
```

**Mapeadores:**
- Leitura: `rowToProcess(row)` em `src/supabase.js`
- Escrita: `processToRow(p)` em `src/supabase.js`

---

### `user_profiles`

Perfil do usuário (stack, resumo, CV base). Um registro por usuário.

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `user_id` | `uuid` | NOT NULL | — | PK e FK → `auth.users.id` |
| `stack` | `text[]` | YES | `'{}'` | Tecnologias do usuário |
| `summary` | `text` | YES | `''` | Resumo profissional |
| `cv_text` | `text` | YES | `''` | Texto do currículo base |
| `updated_at` | `timestamptz` | YES | — | Atualizado no upsert |

**RLS:** mesmas 4 políticas `auth.uid() = user_id`.

**Hook:** `useUserProfile(session)` em `src/hooks/useUserProfile.js`
- Carrega do Supabase ao iniciar sessão
- Mantém cache em `localStorage` com chave `icc-user-profile`
- `saveProfile(p)` faz upsert com `updated_at: new Date().toISOString()`

---

### `resumes`

CVs salvos pelo usuário. Múltiplos por usuário.

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users.id` |
| `name` | `text` | NOT NULL | — | Nome do currículo (ex: "CV Português") |
| `content` | `text` | NOT NULL | — | Texto completo do CV |
| `language` | `text` | YES | `'pt'` | Idioma do CV |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |
| `updated_at` | `timestamptz` | YES | — | Atualizado via trigger |

**RLS:** mesmas 4 políticas `auth.uid() = user_id`.

**Hook:** `useResumes(session)` em `src/hooks/useResumes.js`
Retorna: `{ resumes, loading, add, update, remove, refetch }`

---

### `cv_adaptations`

CV adaptado por processo. Um registro por processo (upsert).

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users.id` |
| `process_id` | `text` | NOT NULL | — | FK → `processes.id` (ON DELETE CASCADE) — **text, não uuid** |
| `content` | `text` | NOT NULL | — | CV adaptado gerado pela IA |
| `jd_snapshot` | `text` | YES | — | JD usada na geração |
| `qa_answers` | `jsonb` | YES | — | Respostas do Q&A `{ [questionId]: boolean }` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |
| `updated_at` | `timestamptz` | YES | — | Atualizado via trigger automático |

> ⚠️ `process_id` é `text` porque `processes.id` é `text`. Nunca criar como `uuid`.

**RLS:** mesmas 4 políticas `auth.uid() = user_id`.

**Mapeadores:**
- Leitura: `rowToCVAdaptation(row)` em `src/supabase.js`
- Escrita: `cvAdaptationToRow(a)` em `src/supabase.js`

**Hook:** `useCVAdaptations` em `src/hooks/useCVAdaptations.js`

---

### Storage — bucket `cv-files`

Bucket privado para PDFs de currículo.

| Campo | Valor |
|---|---|
| Nome | `cv-files` |
| Acesso | Privado (requer auth) |
| Path padrão | `{user_id}/base/{resume_id}.pdf` |
| Política leitura | `auth.uid()::text = (storage.foldername(name))[1]` |
| Política escrita | `auth.uid()::text = (storage.foldername(name))[1]` |

---

## Checklist para nova tabela

Antes de qualquer deploy com tabela nova:

- [ ] Coluna `user_id uuid references auth.users(id)` presente
- [ ] 4 políticas RLS criadas: SELECT / INSERT / UPDATE / DELETE com `auth.uid() = user_id`
- [ ] Mapeadores `rowToX` e `xToRow` adicionados em `src/supabase.js`
- [ ] Hook ou função de acesso criado em `src/hooks/`
- [ ] Migration aplicada via `apply_migration` (não direto no SQL editor)
- [ ] SCHEMA.md atualizado com a nova tabela

---

## Edge Function — `anthropic-proxy`

Não é uma tabela, mas é parte do contrato de dados.

**Endpoint:** `https://sumzkwjthwcdtjqheehn.supabase.co/functions/v1/anthropic-proxy`

**Request:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1000,
  "system": "<system prompt>",
  "messages": [{ "role": "user", "content": "<prompt>" }]
}
```

**Headers obrigatórios:**
```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

**Response (sucesso):**
```json
{
  "content": [{ "type": "text", "text": "<resposta>" }]
}
```

**Erros comuns:**
| Status | Causa |
|---|---|
| 401 | JWT ausente ou expirado |
| 429 | Rate limit — 20 req/min por usuário |
| 500 | `ANTHROPIC_API_KEY` não configurada ou API indisponível |

**Secrets necessários:**
- `ANTHROPIC_API_KEY` — chave da API Anthropic
- `ALLOWED_ORIGIN` — domínio Vercel de produção (CORS)
