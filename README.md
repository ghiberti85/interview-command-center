# Interview Command Center

> Intelligent job process management with integrated AI — built with React + Vite + Supabase + Anthropic Claude API.

<div align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" />
  <img src="https://img.shields.io/badge/Claude-Sonnet_4-7C6AFF?style=flat-square" />
  <img src="https://img.shields.io/badge/Design-Signal_DS-7C6AFF?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-22C67A?style=flat-square" />
</div>

---

## About

**Interview Command Center** is a job process management application designed for tech professionals who receive multiple recruiter approaches simultaneously.

Most job tracking tools assume you are actively applying. This project tackles the opposite scenario: **you are being contacted**, and you need to manage your pipeline, communication, and preparation centrally — without relying on scattered chat folders or spreadsheets.

### Highlights

- **Per-process AI assistant** — the assistant knows the company, role, and current stage before responding
- **Channel-aware response generator** — LinkedIn, Email, and WhatsApp with tone adapted to each platform
- **CV adaptation with AI** — two-step flow (Q&A → generation) that flags unconfirmed technologies before including them
- **Clickable visual pipeline** — advance stages in one tap, no forms
- **Dark / Light mode** — native toggle, persisted across sessions
- **Fully responsive** — dedicated mobile layout with bottom navigation and screen stack
- **PWA** — installable, cache-first assets, works offline for static content
- **English / Portuguese** — UI language toggle persisted per user

---

## Features

### Process Pipeline
- Stages: Contacted → Screening → Interview → Technical → Offer → Closed / Archived
- Origin indicator: **inbound** (contacted by recruiter) vs **outbound** (you applied)
- Urgency alert for stages with deadlines within 48 hours
- Starred / favourited processes

### Conversation Tab (`ConversaTab`)
- Recruiter message thread with AI-generated reply drafts
- Channel selector: LinkedIn, Email (with subject field), WhatsApp
- 10 pre-configured scenarios (respond to contact, confirm interview, negotiate offer, etc.)
- Expandable additional context field
- Session history of generated replies with one-click copy

### Job Tab (`VagaTab`)
- Job details: company, role, location, salary, recruiter, contact channel
- Next-step date + note with auto-stage update when meeting type is selected
- Inline tag editing
- Job URL (validated for `https://` protocol)

### CV Tab (`CVTab`)
- Upload base resume as PDF or paste text
- Paste job description → AI asks targeted Q&A before generating
- Technologies outside your stack are flagged as "unconfirmed" — only added with explicit approval
- Adapted CV saved to Supabase per process; full history available

### Dashboard
- Visual funnel of processes by stage
- Metric cards: active, interviews, offers, urgent
- Priority list (starred processes)
- Recent activity feed

### Import & Profile
- Paste recruiter message → AI extracts fields → creates process with draft reply
- Import processes from JSON, CSV, PDF, or ZIP archive
- Profile setup: stack, summary, base CV (with PDF extraction via pdfjs)
- Multiple saved resumes (named, by language), managed in Supabase

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Language | JavaScript (JSX) + TypeScript (Edge Functions) |
| Database | Supabase (PostgreSQL, sa-east-1) |
| Auth | Supabase Auth — email + password, magic link, password reset |
| Storage | Supabase Storage — private bucket for PDF uploads |
| AI | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| AI routing | Supabase Edge Function (`anthropic-proxy`) with JWT + rate limiting |
| PDF parsing | pdfjs-dist (lazy-loaded) |
| Archive import | jszip |
| Design system | Signal DS (custom CSS variables) |
| Typography | Outfit + JetBrains Mono (Google Fonts) |
| Icons | Inline SVG (custom icon system) |
| State | React hooks — `useState`, `useEffect`, `useCallback` (no external store) |
| Testing | Vitest + React Testing Library + MSW (unit/component/integration) |
| E2E | Playwright |
| Deploy | Vercel (auto-deploy on push to `main`) |
| PWA | Service worker (cache-first assets, network-first navigation) |

---

## Project Structure

```
interview-command-center/
├── src/
│   ├── App.jsx                    # Orchestrator — global state + business logic
│   ├── supabase.js                # Supabase client + rowToProcess / processToRow mappers
│   ├── main.jsx                   # React entry point
│   ├── components/
│   │   ├── ui/                    # Ic, Btn, Badge — Signal DS primitives
│   │   ├── process/               # ProcessCard, PipelineBar, InlineTags, Tabs
│   │   ├── tabs/                  # ConversaTab, VagaTab, CVTab
│   │   ├── layout/                # Dashboard, ProcessDetail
│   │   ├── auth/                  # LoginScreen
│   │   └── modals/                # NewEntryModal, SetPasswordModal, ProfileSetupModal, ResumesModal
│   ├── hooks/                     # useAuth, useIsMobile, useTheme, useUserProfile, useResumes, useCVAdaptations
│   ├── constants/                 # Signal DS tokens, DEMO_PROCESSES, T, iconBtn
│   ├── utils/                     # sort, filterProcesses, dateUtils, buildPrompt, STAGE, i18n
│   └── lib/                       # ai.js — callAI helper (Anthropic proxy)
├── supabase/functions/
│   └── anthropic-proxy/           # Authenticated Edge Function proxy for Anthropic API
├── public/                        # favicon, manifest.json, sw.js, PWA icons
├── vercel.json                    # Build config + security headers (CSP, X-Frame, etc.)
└── CLAUDE.md                      # AI-assisted development guide
```

---

## Environment Variables

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public anon key>
VITE_AI_PROXY_URL=https://<project-ref>.supabase.co/functions/v1/anthropic-proxy
```

Never add `VITE_` prefix to secrets — they are embedded in the public bundle. The `ANTHROPIC_API_KEY` lives as a Supabase Edge Function secret only.

---

## Setup

See the full setup guide in [`SETUP.md`](./SETUP.md).

---

## Security

See [`SECURITY.md`](./SECURITY.md) for the threat model, RLS policies, and security headers.

---

## Roadmap

See planned features and current phase status in [`ROADMAP.md`](./ROADMAP.md).

---

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

MIT — see [`LICENSE`](./LICENSE) for details.

---

<div align="center">
  Built by <a href="https://github.com/ghiberti85">ghiberti85</a> · Signal Design System · Claude Sonnet 4
</div>
