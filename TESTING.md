# Testes — Interview Command Center

Estratégia de testes, setup e exemplos para o projeto.

---

## Estado atual

A versão atual não possui testes automatizados. Este documento define a estratégia recomendada para implementação progressiva.

---

## Stack de testes recomendada

| Camada | Ferramenta | Finalidade |
|---|---|---|
| Unit / componentes | Vitest + React Testing Library | Lógica de componentes e hooks |
| Integração | Vitest + MSW | Fluxos com mock da API |
| E2E | Playwright | Fluxos completos no browser |
| Visual | Chromatic (opcional) | Regressão visual do design system |

---

## Setup inicial

### 1. Instale as dependências de teste

```bash
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
```

### 2. Configure o Vitest em `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
```

### 3. Crie o arquivo de setup

```js
// src/test/setup.js
import '@testing-library/jest-dom'
```

### 4. Adicione os scripts no `package.json`

```json
"scripts": {
  "test":         "vitest",
  "test:ui":      "vitest --ui",
  "test:run":     "vitest run",
  "test:coverage":"vitest run --coverage"
}
```

---

## Testes unitários

### Utilitários (`fmtDate`, `daysDiff`)

```js
// src/test/utils.test.js
import { describe, it, expect } from 'vitest'

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  : "—"

const daysDiff = (d) => d
  ? Math.ceil((new Date(d) - new Date()) / 86400000)
  : null

describe('fmtDate', () => {
  it('formata data em pt-BR', () => {
    expect(fmtDate('2026-05-16')).toMatch(/\d{2} de \w+|^\d{2} \w+/)
  })

  it('retorna — para data nula', () => {
    expect(fmtDate(null)).toBe('—')
  })

  it('retorna — para undefined', () => {
    expect(fmtDate(undefined)).toBe('—')
  })
})

describe('daysDiff', () => {
  it('retorna null para data nula', () => {
    expect(daysDiff(null)).toBeNull()
  })

  it('retorna número positivo para data futura', () => {
    const future = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0]
    expect(daysDiff(future)).toBeGreaterThan(0)
  })

  it('retorna número negativo para data passada', () => {
    const past = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0]
    expect(daysDiff(past)).toBeLessThan(0)
  })
})
```

### Hook `useIsMobile`

```js
// src/test/useIsMobile.test.js
import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Import do hook isolado (após componentizar)
import { useIsMobile } from '../hooks/useIsMobile'

describe('useIsMobile', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  it('retorna false em telas largas', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('retorna true em telas pequenas', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })
})
```

---

## Testes de componente

### Badge

```jsx
// src/test/Badge.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '../App'

describe('Badge', () => {
  it('renderiza label do stage corretamente', () => {
    render(<Badge stage="interview" />)
    expect(screen.getByText('Entrevista')).toBeInTheDocument()
  })

  it('renderiza badge para stage desconhecido sem quebrar', () => {
    render(<Badge stage="unknown_stage" />)
    expect(screen.getByText('Arquivado')).toBeInTheDocument() // fallback
  })

  it('renderiza dot colorido', () => {
    render(<Badge stage="offer" />)
    const dot = document.querySelector('span > span')
    expect(dot).toBeInTheDocument()
  })
})
```

### ProcessCard

```jsx
// src/test/ProcessCard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProcessCard } from '../App'

const mockProcess = {
  id: 'p1',
  company: 'Nubank',
  role: 'Senior Frontend Engineer',
  stage: 'interview',
  tags: ['React', 'TypeScript'],
  starred: true,
  nextStepDate: null,
  nextStepNote: '',
}

describe('ProcessCard', () => {
  it('renderiza nome da empresa e cargo', () => {
    render(<ProcessCard process={mockProcess} onClick={vi.fn()} selected={false} />)
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    expect(screen.getByText('Senior Frontend Engineer')).toBeInTheDocument()
  })

  it('chama onClick ao clicar', () => {
    const onClick = vi.fn()
    render(<ProcessCard process={mockProcess} onClick={onClick} selected={false} />)
    fireEvent.click(screen.getByText('Nubank'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renderiza badge do stage correto', () => {
    render(<ProcessCard process={mockProcess} onClick={vi.fn()} selected={false} />)
    expect(screen.getByText('Entrevista')).toBeInTheDocument()
  })

  it('renderiza tags', () => {
    render(<ProcessCard process={mockProcess} onClick={vi.fn()} selected={false} />)
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('mostra alerta de urgência para datas próximas', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    const urgentProcess = { ...mockProcess, nextStepDate: tomorrow }
    render(<ProcessCard process={urgentProcess} onClick={vi.fn()} selected={false} />)
    // Verifica que a data é exibida
    expect(screen.getByText(/em 1d/)).toBeInTheDocument()
  })
})
```

---

## Testes de integração com mock da API

### Setup do MSW

```js
// src/test/mocks/handlers.js
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Olá Ana, obrigado pelo contato! Tenho interesse na vaga e disponibilidade para conversar.',
          }),
        },
      ],
    })
  }),
]
```

```js
// src/test/mocks/server.js
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
export const server = setupServer(...handlers)
```

```js
// src/test/setup.js (atualizado)
import '@testing-library/jest-dom'
import { server } from './mocks/server'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Teste do gerador de respostas

```jsx
// src/test/MessagesTab.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from '../App'

const mockProcess = {
  id: 'p1',
  company: 'Nubank',
  role: 'Senior Frontend Engineer',
  stage: 'interview',
  origin: 'inbound',
  recruiter: 'Ana Lima',
  salary: 'R$ 25k–30k',
  // ... outros campos
}

describe('MessagesTab — gerador de respostas', () => {
  it('gera resposta ao clicar em "Gerar resposta"', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Navega para a aba de respostas
    fireEvent.click(screen.getByText('Respostas'))

    // Cola mensagem do recrutador
    const textarea = screen.getByPlaceholderText(/cole aqui a mensagem/i)
    await user.type(textarea, 'Olá Fernando, temos uma vaga para você!')

    // Clica em gerar
    fireEvent.click(screen.getByText(/gerar resposta/i))

    // Aguarda resposta da IA (mockada)
    await waitFor(() => {
      expect(screen.getByText(/obrigado pelo contato/i)).toBeInTheDocument()
    })
  })

  it('desabilita botão sem mensagem no cenário "Responder contato inicial"', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Respostas'))

    const btn = screen.getByRole('button', { name: /gerar resposta/i })
    expect(btn).toBeDisabled()
  })
})
```

---

## Testes E2E com Playwright

### Setup

```bash
npm init playwright@latest
```

### Fluxo: adicionar novo processo

```js
// e2e/new-process.spec.js
import { test, expect } from '@playwright/test'

test('adicionar novo processo', async ({ page }) => {
  await page.goto('http://localhost:5173')

  // Abre o modal
  await page.getByText('Novo Processo').click()
  await expect(page.getByText('Como surgiu esta oportunidade?')).toBeVisible()

  // Preenche os campos
  await page.getByLabel('Empresa *').fill('Nubank')
  await page.getByLabel('Cargo *').fill('Senior Frontend Engineer')

  // Salva
  await page.getByText('Adicionar Processo').click()

  // Verifica que apareceu na lista
  await expect(page.getByText('Nubank')).toBeVisible()
})
```

### Fluxo: avançar stage no pipeline

```js
// e2e/pipeline.spec.js
test('avançar stage clicando na barra de progresso', async ({ page }) => {
  await page.goto('http://localhost:5173')

  // Seleciona o processo Nubank (já em "Entrevista")
  await page.getByText('Nubank').first().click()

  // Clica em "Técnica" na barra de pipeline
  await page.getByText('Técnica').click()

  // Verifica que o badge mudou
  await expect(page.locator('.badge').first()).toContainText('Técnica')
})
```

### Fluxo: dark/light mode

```js
// e2e/theme.spec.js
test('alternar entre dark e light mode', async ({ page }) => {
  await page.goto('http://localhost:5173')

  // Background inicial é escuro
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  )
  expect(bg).toBe('#111113')

  // Clica no toggle de tema
  await page.locator('[data-testid="theme-toggle"]').click()

  // Background muda para light
  const bgLight = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  )
  expect(bgLight).toBe('#FAFAF9')
})
```

---

## Cobertura mínima sugerida

| Área | Cobertura alvo |
|---|---|
| Utilitários (`fmtDate`, `daysDiff`) | 100% |
| Hooks (`useIsMobile`, `useTheme`) | 80% |
| Componentes de UI (Badge, Btn, ProcessCard) | 80% |
| Fluxos críticos (add process, gerador) | Cobertos por E2E |
| Chamadas à API | Cobertos por MSW |

Para ver a cobertura atual:

```bash
npm run test:coverage
```

---

## CI com GitHub Actions

Crie `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run test:run
      - run: npm run build

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test
```
