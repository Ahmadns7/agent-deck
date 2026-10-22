# Agent Deck

A multi-LLM playground. Chat with OpenAI-compatible endpoints (OpenAI, Ollama, LM Studio, OpenRouter, any custom base URL) and Anthropic, with token-by-token streaming and per-response stats.

![Agent Deck screenshot](docs/screenshot.png)

> Screenshot placeholder: add `docs/screenshot.png` before publishing.

## Features

- Streaming chat UI: responses render token by token, with a stop button.
- Provider switcher: OpenAI-compatible base URL, Anthropic, or any custom endpoint, with presets.
- API keys live only in your browser's `localStorage`. They are sent only to the base URL of the provider they belong to. There is no backend.
- Conversation history sidebar, stored locally.
- Per-response stats: time to first token, total latency, tokens per second, and prompt/completion token counts. Token counts are estimated when the provider does not report usage.
- Dark mode (default) and light mode.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Setup

```bash
git clone https://github.com/<your-username>/agent-deck.git
cd agent-deck
npm install
npm run dev
```

Open the printed local URL, click **Providers**, pick a preset, paste your API key, and click **Use**.

## Scripts

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the Vite dev server                 |
| `npm run build`   | Type-check, then produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally        |
| `npm run lint`    | Run ESLint with zero warnings allowed     |
| `npm test`        | Run the Vitest suite once                 |
| `npm run test:watch` | Run Vitest in watch mode               |

## CORS

Browsers block cross-origin requests unless the provider allows them. OpenAI and OpenRouter allow browser requests. Anthropic requires the `anthropic-dangerous-direct-browser-access` header, which Agent Deck sends. Local servers such as Ollama may need `OLLAMA_ORIGINS` set to include the dev server origin (for example `http://localhost:5173`).

## Security notes

- Keys are stored unencrypted in `localStorage` on the device you use. Anyone with access to that browser profile can read them. Use keys with spending limits.
- Do not commit `.env` files or keys. `.gitignore` excludes `.env*` (except `.env.example`).
- The app never sends your keys or messages anywhere except the endpoint you configured.

## Project structure

```
src/
  lib/            pure logic: SSE parsing, request building, stats, storage
  components/     Sidebar, ChatView, StatsPanel, SettingsPanel
  App.tsx         app state and streaming orchestration
  lib/*.test.ts   vitest tests for the pure modules
```

## Contributing

Run `npm run lint && npm test && npm run build` before opening a pull request. CI runs the same steps on Node 20 and 22.

## License

MIT. See [LICENSE](LICENSE).
