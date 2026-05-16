# Segurança — Interview Command Center

Este documento descreve os riscos de segurança atuais, mitigações aplicadas e orientações para uso seguro da aplicação.

---

## Modelo de ameaça

O Interview Command Center é uma **Single Page Application (SPA)** que faz chamadas diretas à API da Anthropic a partir do browser. Isso implica em um risco principal:

### ⚠️ Chave de API exposta no frontend

**Risco:** A `VITE_ANTHROPIC_API_KEY` é incluída no bundle JavaScript e fica acessível a qualquer pessoa que inspecione o código-fonte da aplicação em produção.

**Impacto potencial:**
- Uso não autorizado da sua cota de API
- Custos inesperados na conta Anthropic
- Impossibilidade de revogar acesso sem trocar a chave

**Mitigações aplicadas:**
- `.gitignore` configurado para nunca commitar `.env`
- `.env.example` documenta quais variáveis são necessárias sem expor valores reais

**Mitigação recomendada para produção:** implementar um backend proxy (veja abaixo).

---

## Uso seguro — níveis de risco

| Cenário | Risco | Recomendação |
|---|---|---|
| Uso pessoal local (`localhost`) | Baixo | Seguro para uso |
| Deploy privado (só você acessa) | Médio | Aceitável com chave de escopo limitado |
| Deploy público (URL acessível) | Alto | Implemente backend proxy |
| Commit do `.env` no GitHub | Crítico | **Nunca faça isso** |

---

## Implementar backend proxy (recomendado para produção)

Em vez de chamar a API Anthropic diretamente do browser, crie um endpoint intermediário que mantém a chave no servidor.

### Opção 1 — Vercel Edge Function

Crie `/api/chat.js` na raiz do projeto:

```js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Autenticação básica (implemente conforme sua necessidade)
  const auth = req.headers.get('x-app-token');
  if (auth !== process.env.APP_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await req.json();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY, // variável server-side
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

No frontend, substitua as chamadas diretas:

```js
// Antes (direto para Anthropic)
const res = await fetch("https://api.anthropic.com/v1/messages", {
  headers: { "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, ... }
});

// Depois (via proxy)
const res = await fetch("/api/chat", {
  method: "POST",
  headers: {
    "x-app-token": import.meta.env.VITE_APP_SECRET,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
```

### Opção 2 — Supabase Edge Functions

Se já usar Supabase no projeto:

```ts
// supabase/functions/chat/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { messages, system } = await req.json()

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages }),
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  })
})
```

---

## Práticas de segurança aplicadas

### Dados pessoais
- Nenhum dado é enviado para servidores externos além da API Anthropic durante a geração de respostas
- Todos os processos são armazenados exclusivamente em memória React (sem localStorage, sem banco de dados)
- Os dados são perdidos ao recarregar a página — comportamento intencional na versão atual

### Chamadas à API
- O modelo usado é sempre `claude-sonnet-4-20250514` — sem escalada de modelo
- `max_tokens` fixado em 1000 para limitar custo por chamada
- Nenhuma tool use ou function calling habilitada — surface de ataque minimizada

### Headers de segurança (para deploy)
Configure no seu provedor de hospedagem:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.anthropic.com https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
```

No Vercel, crie `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

---

## Rate limiting

A API Anthropic tem limites de rate por padrão. Para evitar erros em uso intenso:

```js
// Adicione debounce nos botões de geração
const [loading, setLoading] = useState(false);

const generate = async () => {
  if (loading) return; // previne duplo clique
  setLoading(true);
  try {
    // chamada à API
  } finally {
    setLoading(false);
  }
};
```

O código atual já implementa esse padrão. Para rate limiting mais robusto, implemente no backend proxy com bibliotecas como `upstash/ratelimit`.

---

## Reportar vulnerabilidades

Se encontrar uma vulnerabilidade de segurança, abra uma [issue privada](https://github.com/ghiberti85/interview-command-center/security/advisories/new) no GitHub em vez de uma issue pública.
