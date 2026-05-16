# Setup — Interview Command Center

Guia completo para rodar o projeto localmente e fazer deploy em produção.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Como verificar |
|---|---|---|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Git | qualquer | `git -v` |
| Conta Anthropic | — | [console.anthropic.com](https://console.anthropic.com) |

---

## 1. Clone o repositório

```bash
git clone https://github.com/ghiberti85/interview-command-center.git
cd interview-command-center
```

---

## 2. Instale as dependências

```bash
npm install
```

---

## 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Abra `.env` e preencha:

```env
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Como obter a chave da API Anthropic

1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Vá em **API Keys** → **Create Key**
3. Copie a chave gerada (aparece apenas uma vez)
4. Cole no `.env` como `VITE_ANTHROPIC_API_KEY`

> ⚠️ **Importante:** nunca commite o arquivo `.env` com a chave real. O `.gitignore` já está configurado para ignorá-lo.

---

## 4. Configure o Vite para expor a variável

O projeto usa a variável via `import.meta.env`. Verifique se `vite.config.js` está assim:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

No código, a chave é acessada como:

```js
headers: {
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
  "Content-Type": "application/json",
}
```

> ℹ️ O header `anthropic-dangerous-direct-browser-access` é necessário para chamadas diretas do browser à API Anthropic. Em produção, considere usar um backend proxy — veja [SECURITY.md](./SECURITY.md).

---

## 5. Rode em desenvolvimento

```bash
npm run dev
```

Acesse em: **http://localhost:5173**

A aplicação já vem com dados de demonstração — 5 processos fictícios para você explorar todas as funcionalidades sem precisar adicionar nada.

---

## 6. Build para produção

```bash
npm run build
```

Os arquivos serão gerados em `/dist`. Para pré-visualizar:

```bash
npm run preview
```

---

## Deploy

### Vercel (recomendado)

1. Acesse [vercel.com](https://vercel.com) e conecte sua conta GitHub
2. Importe o repositório `interview-command-center`
3. Em **Environment Variables**, adicione:
   - `VITE_ANTHROPIC_API_KEY` = sua chave
4. Clique em **Deploy**

O Vercel detecta automaticamente projetos Vite e configura o build.

### Netlify

1. Acesse [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Selecione o repositório
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Em **Environment variables**, adicione `VITE_ANTHROPIC_API_KEY`
6. Clique em **Deploy site**

### GitHub Pages

```bash
npm install --save-dev gh-pages
```

Adicione em `package.json`:

```json
"scripts": {
  "deploy": "npm run build && gh-pages -d dist"
}
```

Adicione em `vite.config.js`:

```js
export default defineConfig({
  base: '/interview-command-center/',
  plugins: [react()],
})
```

```bash
npm run deploy
```

> ⚠️ GitHub Pages não suporta variáveis de ambiente server-side. A chave da API ficará exposta no bundle. Use apenas para demos pessoais — nunca em produção real.

---

## Variáveis de ambiente disponíveis

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | Sim | Chave da API Anthropic para o Claude |

---

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Build otimizado para produção |
| `npm run preview` | Preview do build de produção |
| `npm run lint` | Linting com ESLint |

---

## Solução de problemas comuns

### A IA não responde / erro 401
- Verifique se `VITE_ANTHROPIC_API_KEY` está corretamente preenchida no `.env`
- Confirme que a chave não expirou no [console Anthropic](https://console.anthropic.com)
- Verifique se há crédito disponível na conta

### Erro de CORS no browser
- Certifique-se de que o header `anthropic-dangerous-direct-browser-access: true` está sendo enviado
- Para produção, use um backend proxy (veja SECURITY.md)

### Fontes não carregam
- Verifique conexão com internet (as fontes são carregadas do Google Fonts)
- Para uso offline, baixe e sirva as fontes localmente via `/public`

### Dark/Light mode não persiste ao recarregar
- Comportamento esperado na versão atual — o tema não é persistido em `localStorage`
- Veja o Roadmap para a implementação planejada de persistência

---

## Desenvolvimento com Claude Code

Este projeto foi desenvolvido com assistência do Claude e está otimizado para iterações com IA. Para continuar o desenvolvimento:

```bash
# Instale o Claude Code
npm install -g @anthropic-ai/claude-code

# Rode dentro do projeto
claude
```

Veja [`CLAUDE.md`](./CLAUDE.md) para instruções específicas ao Claude Code.
