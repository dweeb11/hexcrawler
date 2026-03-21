# GEMINI.md

## Orientation

Read before acting:
1. `PITCH.md` — the human's design vision (never modify)
2. `WORKING_AGREEMENT.md` — development process
3. `WORKING_AGREEMENT.games.md` — game-specific conventions
4. `GIT_CONVENTIONS.md` — branching and commit rules

## Project Overview

**The Waning Light** — solo fantasy hexcrawl web game. TypeScript + Canvas 2D, ASCII-glyph terminal aesthetic.

- **Build:** `npx vercel dev` (dev server with API routes), `npx vite build` (production)
- **Test:** `npx vitest run` (all tests), `npx vitest run tests/engine/hex.test.ts` (single file)
- **Hosting:** Vercel (static site + serverless functions)
- **Database:** Turso (hosted SQLite-over-HTTP) for encounter data
- **Architecture:** Pure turn engine. All game logic in `src/engine/` as pure functions — no DOM, no Canvas. Renderer in `src/renderer/` reads state and draws. `engine/` never imports from `renderer/` or `ui/`. Encounter data fetched from `/api/encounters` at startup.
- **Hex system:** Cube coordinates (`q, r, s`, `q + r + s = 0`). Tagged hexes with tag propagation from neighbors. Encounters require matching tags.
- **State:** Single immutable `GameState` object. `resolveTurn(state, action) → newState`. Never mutate state.

## Conventions

- Commit after every task, not at end of session
- Use exact file paths from the spec — do not infer
- Run verification before claiming any task complete
- Never modify `PITCH.md` or `SCRATCH.md`
- Every new entity needs a debug menu spawn button
- No `document`, `window`, or Canvas references in `src/engine/`
- Pass RNG as a parameter — no direct `Math.random()` in engine code
- Encounters must check `requiredTags` against hex tags
- Encounter data lives in Turso — engine receives it as data, never calls the API directly
- API write endpoints require `X-API-Key` header with constant-time comparison
- Secrets never committed — all env vars require `.env.example` entries
- See `WORKING_AGREEMENT.md` for spec format and testing philosophy

## Build & Test

```bash
# Dev server (game + API routes)
npx vercel dev

# Run all tests
npx vitest run

# Run single test file
npx vitest run tests/engine/hex.test.ts

# Production build
npx vite build

# Deploy
npx vercel --prod
```
