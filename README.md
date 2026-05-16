# Interview Command Center

> Gestão inteligente de processos seletivos com IA integrada — construído com React + Vite + Anthropic Claude API.

<div align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/Claude-Sonnet_4-7C6AFF?style=flat-square" />
  <img src="https://img.shields.io/badge/Design-Signal_DS-7C6AFF?style=flat-square" />
  <img src="https://img.shields.io/badge/Licença-MIT-22C67A?style=flat-square" />
</div>

---

## Sobre o projeto

O **Interview Command Center** é uma aplicação de gestão de processos seletivos voltada para profissionais de tecnologia que recebem múltiplas abordagens de recrutadores simultaneamente.

A maioria das ferramentas de job tracking assume que o usuário aplica para vagas. Este projeto parte do cenário oposto: **você é contactado**, e precisa gerenciar pipeline, comunicação e preparação de forma centralizada — sem depender de pastas de chat no ChatGPT ou planilhas.

### Diferenciais

- **AI integrada por processo** — o assistente conhece a empresa, o cargo e a etapa atual antes de responder
- **Gerador de respostas por canal** — LinkedIn, E-mail e WhatsApp com tom adequado a cada plataforma
- **Pipeline visual clicável** — avança etapas com um toque, sem formulários
- **Dark / Light mode** — alternância nativa, persiste por sessão
- **100% responsivo** — layout dedicado para mobile com bottom navigation e stack de telas

---

## Funcionalidades

### Pipeline de processos
- Stages: Contactado → Conversa → Entrevista → Técnica → Proposta → Encerrado
- Indicador de origem: **fui contactado** vs **me candidatei**
- Alerta de urgência para etapas com prazo em até 48h
- Processos favoritos marcados com estrela

### Ficha de processo
- Overview com dados da vaga, recrutador e próxima etapa
- Timeline cronológica com tipo de evento por stage
- Adição manual de novos eventos na timeline
- Edição inline de todos os campos

### Gerador de Respostas (IA)
- Cole a mensagem do recrutador → escolha o canal → gere a resposta
- Canais: LinkedIn, E-mail (com campo de assunto), WhatsApp
- 10 cenários pré-configurados (responder contato, confirmar entrevista, negociar proposta, etc.)
- Campo de contexto adicional expansível
- Histórico de respostas geradas na sessão
- Botão de copiar com feedback visual

### AI Assistant
- Chat livre contextualizado por empresa, cargo e etapa
- 5 quick actions: responder contato inicial, research da empresa, perguntas prováveis, negociar proposta, elevator pitch
- Histórico de mensagens dentro da sessão

### Dashboard
- Funil visual de processos por stage
- Cards de métricas: ativos, entrevistas, propostas, urgentes
- Lista de prioridades (processos com estrela)
- Feed de atividade recente

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | React 19 |
| Build | Vite 6 |
| Linguagem | JavaScript (JSX) |
| IA | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| Design System | Signal DS (custom) |
| Tipografia | Outfit + JetBrains Mono (Google Fonts) |
| Ícones | SVG inline (custom icon system) |
| Estado | React hooks (useState, useEffect, useCallback) |
| Deploy | Vercel / Netlify / GitHub Pages |

---

## Estrutura do projeto

```
interview-command-center/
├── src/
│   ├── App.jsx          # Aplicação completa (componentes + lógica)
│   └── main.jsx         # Entry point React
├── public/
│   └── vite.svg
├── index.html
├── vite.config.js
├── package.json
├── .env.example         # Template de variáveis de ambiente
├── .gitignore
└── README.md
```

> **Nota:** O projeto usa um único arquivo `App.jsx` por design — facilita iterações rápidas com IA (Claude Code, Cursor, etc.). Para escalar, veja a seção [Roadmap](#roadmap).

---

## Configuração e setup

Veja o guia completo em [`SETUP.md`](./SETUP.md).

---

## Segurança

Veja as orientações em [`SECURITY.md`](./SECURITY.md).

---

## Roadmap

Veja as próximas features planejadas em [`ROADMAP.md`](./ROADMAP.md).

---

## Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feat/sua-feature`
3. Commit: `git commit -m "feat: descrição"`
4. Push: `git push origin feat/sua-feature`
5. Abra um Pull Request

---

## Licença

MIT — veja [`LICENSE`](./LICENSE) para detalhes.

---

<div align="center">
  Feito por <a href="https://github.com/ghiberti85">ghiberti85</a> · Signal Design System · Claude Sonnet 4
</div>
