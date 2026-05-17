# Aira Builder

> A Three-AI team code generation platform — build any app, any platform, autonomously.

Aira Builder is an AI-powered development environment where three specialized AI agents collaborate in parallel to build, review, and ship production-quality applications.

---

## How It Works — The Three-AI Team

| Agent | Role | Model |
|-------|------|-------|
| 🗣 **Communicator** | Responds to you instantly while building happens in background | Haiku (fast) |
| 🔨 **Builder** | Autonomously writes code, runs commands, starts servers | Your main model |
| 🔍 **Critic** | Reviews Builder output, triggers a fix round if issues found | Haiku (fast) |

All three run in **parallel** — you always have someone to talk to even mid-build.

You can also switch to **Single AI mode** (Settings → AI → Team Mode) if you want one model handling everything.

---

## Features

- **Multi-platform projects** — Web, iOS, Android, Desktop, Browser Extension, API/Backend
- **Live preview** — iframe preview with tunnel URL support
- **File tree + code editor** — Monaco-based editor with syntax highlighting
- **Terminal panel** — run commands directly in the workspace
- **Deploy panel** — one-click deployment
- **OpenAI-compatible + Anthropic** — works with GPT-4o, Claude, Groq, Ollama, DeepSeek, Mistral, and any OpenAI-compatible API
- **Per-role model overrides** — set different models for Communicator, Builder, Critic
- **Skills, Tools, Integrations, Memory** — extensible agent capabilities
- **Channel bridges** — Telegram and other messaging platform integration
- **Draggable/resizable settings modal**
- **Persistent state** — all settings and projects saved locally

---

## Getting Started

### Prerequisites

- Node.js 18+
- An API key from [Anthropic](https://console.anthropic.com) or any OpenAI-compatible provider

### Install & Run

```bash
git clone https://github.com/airajakathi/aira_builder.git
cd aira_builder
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### First Time Setup

1. Click the **Settings** icon (bottom-left of sidebar)
2. Enter your API key under **Anthropic** or **OpenAI-compatible**
3. Select your model
4. Click **Save & Apply**
5. Create a new project and start building

---

## Configuration

All settings are stored locally in your browser (Zustand persist). Nothing is sent to any server other than your chosen AI provider.

### AI Provider Options

| Provider | Base URL | Notes |
|----------|----------|-------|
| Anthropic | — | Native SDK, recommended |
| OpenAI | https://api.openai.com/v1 | GPT-4o, o1 |
| Groq | https://api.groq.com/openai/v1 | Fast inference |
| Ollama | http://localhost:11434/v1 | Local models |
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat, deepseek-reasoner |
| Mistral | https://api.mistral.ai/v1 | codestral, mistral-large |
| xAI | https://api.x.ai/v1 | Grok-3 |
| Together AI | https://api.together.xyz/v1 | Llama, Qwen |
| Any OpenAI-compatible | your URL | Custom deployments |

### Team AI Mode

In **Settings → AI → AI Team Mode**:

- **Three-AI Team** (default) — Communicator + Builder + Critic running in parallel. Highest quality.
- **Single AI** — One model handles everything. Simpler, fewer API calls.

Subagent models (Communicator, Critic) can each be overridden individually — leave blank to use the default (auto Haiku for Anthropic, main model for custom providers).

---

## Tech Stack

- **Frontend** — React 18 + TypeScript + Vite
- **Styling** — Tailwind CSS v4
- **State** — Zustand with persistence
- **Editor** — Monaco Editor
- **AI** — Anthropic SDK + OpenAI-compatible fetch

---

## Project Structure

```
src/
├── components/
│   ├── chat/            # ChatPanel — three-AI message handling
│   ├── editor/          # Code editor, deploy, project settings panels
│   ├── platform/        # New project modal
│   ├── preview/         # Live preview panel
│   ├── shared/          # Shared UI components
│   ├── sidebar/         # Sidebar + global settings modal
│   └── terminal/        # Terminal panel
├── lib/
│   ├── aiEngine.ts      # Core AI engine — tool calls, streaming, three-AI logic
│   ├── channelBridge.ts # Telegram/channel integration
│   └── platforms.ts     # Platform + model definitions
├── store/
│   └── index.ts         # Zustand store — all app state
└── types/
    └── index.ts         # TypeScript types
```

---

## License

MIT — see [LICENSE](LICENSE)
