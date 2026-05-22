# Nera — Interactive Novel Engine

Write immersive AI-powered interactive fiction with streaming LLM narration, chapter management, and image generation.

## Features

- **AI narration** — Streaming story generation via OpenRouter or local LLM (llama.cpp compatible)
- **Action-driven** — Type what your character does; the LLM rewrites it into vivid prose
- **6 built-in scenarios** — Isekai, Dungeon, Cyberpunk, Mythology, Romance, or Custom
- **Chapter management** — Auto-named chapters (Roman numerals), editable titles
- **Inline editing** — Double-click any paragraph to edit; full-block auto-resizing editor
- **Paragraph actions** — Edit, regenerate (narrator only), add image, or delete per paragraph
- **Image generation** — Generate illustrations via local SD WebUI / ComfyUI or OpenRouter
- **Cloud save/load** — Firebase Firestore with per-user ownership; manual save/load workflow
- **Local persistence** — All stories auto-saved to IndexedDB via Zustand + `idb-keyval`
- **Auth** — Email/password + Google sign-in with email verification gating

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4 |
| State | Zustand (persisted to IndexedDB) |
| Backend | Edge function (Vercel/Netlify) — single `api/llm.ts` |
| Auth & DB | Firebase Authentication + Firestore |
| LLM API | OpenRouter (cloud) or local llama.cpp-compatible server |
| Image API | OpenRouter or local SD WebUI / ComfyUI |
| Streaming | Server-Sent Events (SSE) through edge function |

## Architecture

```
┌─────────────────────┐     SSE stream      ┌──────────────────┐     HTTP      ┌────────────┐
│  React (Vite) SPA   │ ◄────────────────── │  Edge Function   │ ◄─────────── │ OpenRouter │
│  Zustand + IndexedDB│    /api/llm/chat    │  api/llm.ts      │              │ or Local   │
│  Firebase Auth SDK  │                     │  Auth validation  │              │ LLM/Image  │
└─────────────────────┘                     └──────────────────┘              └────────────┘
```

- **Context system:** Scenario fields (setting, companion, player, hook) + recent paragraph history are assembled into a structured key-value context window and appended to the system prompt
- **No raw user text displayed:** User actions are sent to the LLM to be rewritten into narrative prose; only the narrator's output appears in the story
- **Manual cloud persistence:** Cloud save/load is explicit — stories are not auto-synced to Firestore

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project (Auth + Firestore — free tier is sufficient)
- An OpenRouter API key (or local LLM endpoint)

### Setup

```sh
cd client
npm install
cp .env.example .env
```

Fill in your Firebase project credentials in `.env`:

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `{project}.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `{project}.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase settings |
| `VITE_FIREBASE_APP_ID` | From Firebase settings |

### Run locally

```sh
# Start both client dev server and edge function
npm run dev
```

This runs the Vite dev server on `localhost:5173` and the edge function on `localhost:8787`.

### Deploy edge function

```sh
npm install -g vercel
vercel --prod
```

Set these variables in Vercel:

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account client email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |

## Usage

1. **Sign in** — Email/password or Google
2. **Pick a scenario** — Choose from 6 premade settings or create your own
3. **Write your action** — Describe what your character does in the input box
4. **Continue** — Press Enter or click Continue; the LLM weaves your action into the story
5. **Send empty** — Press Continue with no input to advance the story without an explicit action
6. **Edit** — Double-click any paragraph to edit it inline
7. **Regenerate** — Hover a narrator paragraph and click "regen" for an alternate version
8. **Save** — Use the header controls to save/load locally or to the cloud

## Project Structure

```
nera-interactive-novel/
├── client/                      # Vite + React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/            # Login, register, password reset
│   │   │   ├── layout/          # Header, Sidebar, InputArea
│   │   │   ├── novel/           # ParagraphBlock, ChapterDivider, ImageModal, SettingsModal
│   │   │   └── shared/          # Button, Modal, Spinner, TextArea, Toast
│   │   ├── lib/                 # Firebase init, edge API client, utilities
│   │   ├── pages/               # HomePage (scenario picker), NovelPage
│   │   ├── scenarios/           # Built-in scenario definitions
│   │   ├── stores/              # Zustand stores (auth, settings, story, ui)
│   │   └── types/               # TypeScript type definitions
│   └── vitest.config.ts
├── functions/
│   └── api/llm.ts               # Edge function: chat streaming, models, image gen, story CRUD
├── firestore.rules              # Firestore security rules
└── package.json                 # Root orchestration (concurrently runs client + functions)
```

## Configuration

### LLM Settings

Configure via the Settings modal (gear icon): provider (OpenRouter or local), model, temperature, max tokens, context window size, and system prompt.

### Image Generation

Supports local Stable Diffusion WebUI, ComfyUI (with CORS proxy), or OpenRouter image models. Configure the endpoint URL and authentication in Settings.

## Testing

```sh
npm test               # Run tests
npm run test:coverage  # Run tests with coverage
```

## Security

- Firestore rules enforce story ownership (`request.auth.uid == resource.data.userId`)
- Email verification required before API access
- Edge function validates Firebase ID tokens on every request
- Rate-limited to 20 requests/min per user

## License

MIT
