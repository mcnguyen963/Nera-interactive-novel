# Nera — Interactive Novel Engine

Write immersive AI-powered interactive fiction with a real-time streaming chat interface, chapter management, and image generation.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 4, Zustand
- **Backend:** Edge function (Vercel/Netlify) for LLM/image proxying
- **Database:** Firebase Auth + Firestore (free tier)
- **Persistence:** IndexedDB via `idb-keyval` (local), Firestore (cloud save)
- **Streaming:** Server-Sent Events (SSE) from edge function to client

## Features

- 6 built-in scenarios: Isekai, Dungeon, Cyberpunk, Mythology, Romance, Custom
- AI-powered story generation via OpenRouter (SSE streaming)
- Chapter management with auto-naming (Roman numerals)
- Editable paragraph blocks with inline delete
- Image generation (local SD or OpenRouter)
- Cloud save/load/delete via Firestore
- Local IndexedDB persistence with Zustand
- Firebase Auth: Email/password + Google sign-in + email verification
- Dark-themed literary UI

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project (Auth + Firestore — free tier)
- An OpenRouter API key (or local image gen endpoint)

### Setup

```sh
# Clone the repo
cd nera-interactive-novel/client

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` with your Firebase project credentials:

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
npm run dev
```

### Deploy edge function (Vercel)

```sh
npm install -g vercel
vercel --prod
```

Set these environment variables in your Vercel dashboard:

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account client email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |

### Testing

```sh
npm test          # Run tests
npm run test:coverage  # Run tests with coverage
```

## Project Structure

```
nera-interactive-novel/
├── client/              # Vite + React app
│   ├── src/
│   │   ├── components/  # UI components (auth, layout, novel, shared)
│   │   ├── lib/         # Firebase init, edge API client, utilities
│   │   ├── pages/       # HomePage (scenario picker), NovelPage
│   │   ├── scenarios/   # 6 built-in story scenarios
│   │   ├── stores/      # Zustand stores (auth, settings, story, ui)
│   │   └── types/       # TypeScript type definitions
│   └── vitest.config.ts
├── functions/
│   └── api/llm.ts       # Edge function (chat, models, image)
├── firestore.rules      # Firestore security rules
└── package.json
```

## Architecture

- **Firebase-first:** Auth and Firestore handled directly via browser SDKs
- **Single edge function:** Proxies LLM chat (SSE streaming) and image generation through OpenRouter
- **Zustand + IndexedDB:** All state persisted locally; cloud save is explicit (manual save/load)
- **KV context system:** Scenario fields + recent paragraphs assembled into structured context for LLM

## Security

- Firestore rules enforce ownership (`request.auth.uid == resource.data.userId`)
- Email verification required for API access (`request.auth.token.email_verified`)
- Edge function validates Firebase ID tokens before proxying requests
- Rate limiting (20 requests/min per user) on edge function
