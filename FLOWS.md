# Fluxos de usuário — Interview Command Center

Sequências completas dos fluxos multi-etapa. **Leia antes de editar qualquer passo de um fluxo.**

---

## 1. Autenticação

### 1a. Login com senha (modo padrão)

```
LoginScreen (mode="password")
  → usuário digita email + senha → clica "Entrar"
  → supabase.auth.signInWithPassword()
      ✓ sucesso → onAuthStateChange dispara → session != null → App renderiza
      ✗ erro    → exibe mensagem genérica (não error.message)
```

### 1b. Magic link

```
LoginScreen (mode="magic")
  → usuário digita email → clica "Enviar link"
  → supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })
      ✓ sucesso → exibe SentBox "Link enviado!"
      → usuário abre email → clica link → retorna ao app
      → detectSessionInUrl: true captura o token na URL
      → onAuthStateChange dispara → session != null → App renderiza
```

### 1c. Recuperação de senha

```
LoginScreen (mode="forgot")
  → usuário digita email → clica "Enviar instruções"
  → supabase.auth.resetPasswordForEmail()
      ✓ sucesso → exibe SentBox "E-mail enviado!"
      → usuário abre email → clica link → retorna ao app
      → onAuthStateChange dispara evento PASSWORD_RECOVERY
      → useAuth seta isRecovery=true (NÃO limpa imediatamente)
      → App exibe <SetPasswordModal>
      → usuário digita nova senha → salva
      → supabase.auth.updateUser({ password })
          ✓ sucesso → clearRecovery() → modal fecha → usuário logado
          ✗ erro    → exibe mensagem genérica, modal permanece aberto
```

**⚠️ Atenção:** `clearRecovery()` só é chamado após salvar com sucesso. Nunca ao detectar o evento.

### 1d. Modo demonstração

```
LoginScreen
  → usuário clica "Ver demonstração"
  → setIsDemo(true)
  → App carrega DEMO_PROCESSES em memória
  → banner âmbar aparece: "Modo demonstração"
  → TODO CRUD bloqueado por guards if (isDemo)
  → "Sair" → setIsDemo(false) → volta para LoginScreen
```

**⚠️ Atenção:** `isDemo` e `session` são mutuamente exclusivos na prática, mas não tecnicamente. Nunca ative `isDemo` em sessão autenticada.

---

## 2. Criar processo via mensagem do recrutador (`RecruiterMessageModal`)

Fluxo de 3 etapas: `paste → working → result`

```
Etapa 1 — paste
  → usuário cola mensagem do LinkedIn no textarea
  → clica "Extrair e continuar"
  → setStep("working")

Etapa 2 — working (paralelo)
  → Chamada A: EXTRACTION_SYSTEM + mensagem → extrai JSON com campos da vaga
  → Chamada B: DRAFT_SYSTEM + mensagem → gera rascunho de resposta (plain text)
  → ambas resolvem → setStep("result") + setExtracted(parsed) + setDraft(text)
  ✗ erro na extração → setStep("paste") + exibe erro

Etapa 3 — result
  → exibe campos extraídos (editáveis): empresa, cargo, recrutador, stack, salário, regime
  → exibe draft da resposta (editável)
  → usuário clica "Copiar resposta" → clipboard
  → usuário clica "Criar processo" →
      - monta objeto Process com campos extraídos
      - insere no Supabase (se autenticado)
      - chama onProcessCreated(process)
      - modal fecha
  → usuário clica "Voltar" → step="paste", limpa estado
```

**Dados criados:** processo com `stage: "contacted"`, `origin: "inbound"`, `channel: ""` (definido depois no VagaTab).

---

## 3. Adaptação de currículo (`CVTab`)

Fluxo de 4 etapas: `input → analyzing → qa → generating → result`

```
Etapa 1 — input
  → usuário seleciona CV base (perfil ou currículo salvo)
  → cola Job Description no textarea
  → [opcional] clica "Ver adaptação salva" se já existe → pula para result
  → clica "Analisar vaga"

Etapa 2 — analyzing
  → QA_SYSTEM + JD + stack do perfil → retorna JSON com 5-10 perguntas binárias
  ✓ sucesso → setQuestions(parsed.questions) → setStep("qa")
  ✗ erro    → setStep("input") + exibe erro

Etapa 3 — qa
  → exibe perguntas sim/não (checkboxes)
  → usuário marca experiências reais
  → clica "Gerar CV adaptado"

Etapa 4 — generating
  → CV_SYSTEM + JD + respostas Q&A + CV base → retorna CV adaptado (plain text)
  ✓ sucesso → setResult(text) → setStep("result")
  ✗ erro    → setStep("qa") + exibe erro

Etapa 5 — result
  → exibe CV adaptado
  → "Copiar" → clipboard
  → "Salvar adaptação" → upsert em cv_adaptations (por process_id)
  → "Refazer" → setStep("input"), limpa estado
```

**Regra crítica:** tecnologias respondidas como "não" no Q&A **nunca** entram no CV gerado. Isso é aplicado no prompt CV_SYSTEM.

---

## 4. Gerar mensagem de resposta ao recrutador (`ConversaTab`)

```
→ usuário cola mensagem do recrutador (textarea superior)
→ seleciona canal (LinkedIn / E-mail / WhatsApp)
→ seleciona cenário (confirmar interesse, propor horário, etc.)
→ [opcional] adiciona contexto extra
→ clica "Gerar"
→ buildPrompt() monta user prompt com dados do processo + canal + cenário + CV (se disponível)
→ callAI([{ role:"user", content:prompt }], MESSAGES_SYSTEM, token)
→ tenta JSON.parse(raw)
    ✓ JSON válido → exibe subject (email) + body
    ✗ parse falha → usa raw como body
→ usuário clica "Copiar"
→ usuário clica "Salvar no histórico"
    → onUpdate({ ...process, sentMessages: [...sentMessages, novaEntrada] })
    → persiste no Supabase via updateProcess
→ histórico exibido como thread cronológica acima do compose
```

---

## 5. CRUD de processos

### Criar (via NewProcessModal)
```
→ usuário preenche formulário mínimo (empresa + cargo)
→ clica "Criar"
→ addProcess(p):
    - p.id = crypto.randomUUID()
    - INSERT no Supabase com user_id
    - setProcesses(prev => [p, ...prev])
    - setSelected(p)
    - mobile: setMobileScreen("detail")
```

### Atualizar (inline ou via VagaTab)
```
→ qualquer campo editável chama onUpdate(updatedProcess) no onBlur
→ updateProcess(updated):
    - setProcesses(prev → substituição por id)
    - UPSERT no Supabase com user_id
```

### Encerrar (mover para rejected)
```
Desktop: botão "Encerrar processo" no VagaTab
Mobile:  swipe ≥ 100px para a esquerda → painel de confirmação → "Encerrar"
→ updateProcess({ ...p, stage: "rejected" })
```

### Excluir (permanente)
```
Desktop: botão "Excluir processo" no VagaTab → confirmação inline → confirmar
Mobile (arquivado): swipe → "Deletar"
→ deleteProcess():
    - DELETE no Supabase
    - remove do state local
    - setSelected(next[0] || null)
    - mobile: setMobileScreen("list")
```

### Arquivar (mover para archived)
```
→ usuário arrasta processo para view "Arquivados" (ainda não implementado como gesto direto)
→ atualmente "Encerrado" (rejected) e "Arquivado" (archived) são agrupados na mesma view
```

---

## 6. Navegação mobile

```
Estado: mobileScreen = "list" | "detail"
        mobileTab (bottom nav) = "pipeline" | "stats" | "archived"
        mobileDetailTab = "conversa" | "vaga" | "curriculo"

Lista → detalhe:
  → toque em ProcessCard → setSelected(p) → setMobileDetailTab("conversa") → setMobileScreen("detail")

Detalhe → lista:
  → botão "←" no header → setMobileScreen("list")

Bottom nav:
  → "Novo" → abre NewEntryModal (sempre, independente da tela atual)
  → "Pipeline" → setMobileTab("pipeline") → setMobileScreen("list")
  → "Stats" → setMobileTab("stats") → setMobileScreen("list")
  → "Arquivo" → setMobileTab("archived") → setMobileScreen("list")
```

---

## 7. Perfil e currículos

### Carregar perfil
```
App inicializa → useUserProfile(session)
  → readCache() → estado inicial do localStorage
  → session?.user?.id presente →
      SELECT * FROM user_profiles WHERE user_id = id
      ✓ data → fromRow(data) → setProfile + writeCache
      ✗ sem data → mantém cache local
```

### Salvar perfil
```
ProfileSetupModal → onSave(profile)
  → saveProfile(p):
      - setProfile(p)
      - writeCache(p) → localStorage
      - session presente → UPSERT user_profiles com updated_at
```

### Upload de PDF (extração de CV)
```
ProfileSetupModal → aba "CV" → área de drag & drop
  → usuário seleciona/dropa .pdf
  → extractTextFromPdf(file):
      - import("pdfjs-dist") lazy
      - getDocument({ data: Uint8Array }) → pdf
      - itera páginas → getTextContent() → items[].str
      - retorna texto concatenado
  ✓ sucesso → setCvText(texto extraído)
  ✗ erro    → exibe e.message no estado de erro do modal
```
