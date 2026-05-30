# Componentes — Interview Command Center

Referência dos primitivos e componentes reutilizáveis do Signal DS. **Consulte antes de criar algo novo.**

---

## Primitivos UI (`src/components/ui/`)

### `Ic` — Ícone SVG inline

```jsx
<Ic n="pipeline" s={16} c="var(--acc)" />
```

| Prop | Tipo | Descrição |
|---|---|---|
| `n` | string | Nome do ícone (ver lista abaixo) |
| `s` | number | Tamanho em px (width e height) |
| `c` | string | Cor — sempre use CSS var |

**Ícones disponíveis:**
`target` `pipeline` `chart` `archive` `plus` `search` `back` `star` `starF` `edit` `close` `trash` `cal` `alert` `copy` `check` `refresh` `send` `msg` `ai` `sun` `moon` `linkedin` `email` `whatsapp` `info` `logout`

**Para adicionar ícone:** adicione no objeto `P` dentro de `src/components/ui/Ic.jsx`:
```jsx
novoIcone: <><path d="..." stroke={c} strokeWidth="1.5"/></>,
```

---

### `Btn` — Botão

```jsx
<Btn variant="primary" size="md" full onClick={fn}>Texto</Btn>
<Btn variant="danger" size="sm" onClick={fn}>
  <Ic n="trash" s={12} c="var(--red)" />Excluir
</Btn>
```

| Prop | Tipo | Valores | Default |
|---|---|---|---|
| `variant` | string | `primary` `secondary` `ghost` `danger` | `primary` |
| `size` | string | `sm` `md` `lg` | `md` |
| `full` | boolean | — | `false` |
| `onClick` | function | — | — |
| `disabled` | boolean | — | `false` |

**Notas:**
- Hover state gerenciado internamente via `useState` — não precisa de CSS externo
- Aceita children: texto puro ou `<Ic>` + texto
- `danger` usa `var(--red)` para borda e texto — não use para ações reversíveis

---

### `Badge` — Badge de stage

```jsx
<Badge stage="interview" />
```

| Prop | Tipo | Descrição |
|---|---|---|
| `stage` | string | Chave de `STAGE` (contacted, screening, interview, technical, offer, rejected, archived) |

Usa `STAGE[stage].badgeBg`, `.badgeColor`, `.badgeBorder` automaticamente.

---

### `iconBtn()` — Helper para botões de ícone

Não é um componente — é uma função que retorna um objeto de `style`.

```js
import { iconBtn } from "../../constants/index.js";

// Desktop (32×32)
<button className="icon-btn" style={iconBtn()} onClick={fn}>
  <Ic n="edit" s={15} c="var(--t2)"/>
</button>

// Mobile (44×44 — touch target mínimo)
<button className="icon-btn" style={iconBtn({ width:44, height:44, borderRadius:10 })} onClick={fn}>
  <Ic n="plus" s={17} c="var(--acc)"/>
</button>
```

O `className="icon-btn"` ativa o hover via `GLOBAL_CSS`:
```css
.icon-btn:hover { background: var(--bg-s) !important; }
```

---

## Componentes de processo (`src/components/process/`)

### `ProcessCard`

Card da lista de processos. Suporta swipe to archive no mobile.

```jsx
<ProcessCard
  process={p}
  onClick={() => setSelected(p)}
  selected={selected?.id === p.id}
  onSwipeAction={() => updateProcess({ ...p, stage: "rejected" })}
  isMobile={isMobile}
  isArchived={view === "archived"}
/>
```

| Prop | Tipo | Descrição |
|---|---|---|
| `process` | Process | Objeto do processo |
| `onClick` | function | Callback ao clicar no card |
| `selected` | boolean | Destaca com borda accent |
| `onSwipeAction` | function | Callback do swipe (mobile only) |
| `isMobile` | boolean | Habilita touch handlers |
| `isArchived` | boolean | Muda label/ícone para "Deletar" |

**Swipe:** drag ≥ 100px para a esquerda abre painel de confirmação. Aceita `onSwipeAction` como callback após confirmar.

---

### `PipelineBar`

Barra de progresso visual do pipeline.

```jsx
<PipelineBar stage={process.stage} />
```

---

### `InlineTags`

Tags editáveis inline (adicionar e remover sem modal).

```jsx
<InlineTags process={process} onUpdate={updateProcess} />
```

| Prop | Tipo | Descrição |
|---|---|---|
| `process` | Process | Objeto do processo (usa `process.tags`) |
| `onUpdate` | function | Callback com processo atualizado |

---

### `Tabs`

Navegação de abas — usado no `ProcessDetail`.

```jsx
<Tabs tabs={[{ id:"conversa", label:"Conversa" }]} active={tab} onChange={setTab} />
```

---

## Abas do processo (`src/components/tabs/`)

Cada aba recebe `process` e `onUpdate` como props mínimas.

### `ConversaTab`

Thread de conversa (mensagens do recrutador + respostas geradas).

```jsx
<ConversaTab
  process={process}
  isMobile={isMobile}
  profile={profile}
  adaptation={adaptation}
  onUpdate={updateProcess}
  navH="calc(56px + var(--sab))"
/>
```

| Prop | Descrição |
|---|---|
| `process` | Processo atual |
| `isMobile` | Layout mobile vs desktop |
| `profile` | Perfil do usuário (stack, resumo, CV) |
| `adaptation` | CV adaptado salvo (para contexto no prompt) |
| `onUpdate` | Atualiza processo (persiste `sentMessages`) |
| `navH` | Altura da nav para offset do conteúdo mobile |

---

### `VagaTab`

Dados da vaga + próxima etapa com auto-stage + notas + ações (encerrar/excluir).

```jsx
<VagaTab
  process={process}
  onUpdate={updateProcess}
  onDelete={deleteProcess}
  isMobile={isMobile}
/>
```

**Auto-stage:** ao selecionar o tipo da próxima reunião, o stage é atualizado automaticamente:
- Triagem → `screening`
- Entrevista → `interview`
- Técnica → `technical`
- Proposta → `offer`

**Ações no rodapé:**
- "Encerrar processo" → `stage: "rejected"` (só aparece em processos ativos)
- "Excluir processo" → confirmação + `onDelete()` (permanente)

---

### `CVTab`

Adaptação de currículo com Q&A. Fluxo: `input → analyzing → qa → generating → result`.

```jsx
<CVTab
  process={process}
  profile={profile}
  isMobile={isMobile}
  resumes={resumes}
  onManageResumes={() => setShowResumes(true)}
  adaptation={adaptation}
  onSaveAdaptation={saveAdaptation}
  session={session}
/>
```

---

## Layout (`src/components/layout/`)

### `Dashboard`

Painel de métricas — exibido na view `"stats"`.

### `ProcessDetail`

Painel de detalhes do processo — sidebar no desktop, tela full no mobile.

```jsx
<ProcessDetail
  process={process}
  onUpdate={updateProcess}
  onDelete={deleteProcess}
  isMobile={isMobile}
  isPWA={isPWA}
  navH="calc(56px + var(--sab))"
  profile={profile}
  onEditProfile={() => setShowProfileModal(true)}
  resumes={resumes}
  onManageResumes={() => setShowResumes(true)}
  initialTab="conversa"
  adaptation={adaptation}
  onSaveAdaptation={saveAdaptation}
/>
```

---

## Convenções gerais

- **Nunca use valores hardcoded de cor** — sempre `var(--token)`
- **Touch targets mobile:** mínimo 44×44px com `iconBtn({ width:44, height:44 })`
- **Hover states:** use `className="icon-btn"` ou `className="card-hover"` (definidos em `GLOBAL_CSS`)
- **Responsividade:** controlada por `isMobile` prop (JS), nunca por media query CSS
- **Comentários:** somente quando o WHY não é óbvio — nunca descreva o que o código faz
