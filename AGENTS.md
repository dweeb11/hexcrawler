# AGENTS.md

See `CLAUDE.md` for the full project vision, architecture, process, and conventions. This file holds environment/operational notes for agents.

## Cursor Cloud specific instructions

The VM startup update script already runs `npm install`. Standard commands are documented in `README.md` / `CLAUDE.md` (`npm run dev`, `npm test`, `npm run typecheck`, `npm run build`). Notes below cover non-obvious caveats only.

## Review guidelines

Codex PR review should focus on P0/P1 defects: correctness bugs, regressions, security issues, data loss, broken player flows, and missing high-risk tests. Do not leave style-only comments or broad refactor suggestions.

- Preserve the architecture boundary: `src/engine/` must stay pure TypeScript game logic with no DOM, Canvas, `window`, `document`, localStorage, or API calls.
- Preserve immutable state semantics. `resolveTurn` and engine helpers must return new `GameState` values instead of mutating inputs.
- Flag any new `Math.random()` use in engine code; engine randomness should flow through explicit seed/RNG inputs.
- Keep cube coordinates as the game-logic coordinate system. Offset/pixel conversions belong at renderer/UI boundaries only.
- Encounter mode is modal. Map movement/actions must not leak through while an encounter choice is active.
- Encounter placement must respect `requiredTags`; do not allow encounters on hexes that fail their tag requirements.
- API write endpoints must require `X-API-Key`, use constant-time comparison, and never log secrets.
- Treat committed secrets or missing `.env.example` updates for new environment variables as P1.
- For API-backed local flows, remember that plain `npm run dev` does not load `.env.local` into `/api/*` handlers. Prefer `node --env-file=.env.local node_modules/.bin/vite` when review guidance or reproduction steps need local API routes.

### Services

This repo is a single product: **The Waning Light**, a browser hexcrawl game (Vite + TypeScript + Canvas). The only service needed to play/test is the **Vite dev server** (`npm run dev`, http://localhost:5173), which also serves the `/api/*` Vercel serverless handlers via the custom plugin in `scripts/vite-api-plugin.ts`. The backend uses Turso (libSQL); locally this is just a SQLite file (`file:local.db`), no external service required.

### Non-obvious caveats

- **`npm run dev` does NOT load `.env.local` into `process.env`.** Vite only exposes `VITE_`-prefixed vars to the client; the `/api/*` handlers read `process.env.TURSO_DATABASE_URL` etc. directly. So plain `npm run dev` will make API routes throw `TURSO_DATABASE_URL is not configured` (HTTP 500). The game still plays fine because `src/api/*` falls back to bundled seed JSON, but to exercise API-backed flows (admin CRUD, rumors, analytics, playtests) start the dev server with the env file loaded:
  ```bash
  node --env-file=.env.local node_modules/.bin/vite
  ```
  (`npx vercel dev` also loads `.env.local`, but the Vite plugin path is faster and needs no Vercel login.)
- **Local env + DB are gitignored and not recreated by the update script.** To enable API-backed flows in a fresh VM, create `.env.local` (copy `.env.example`; for local dev set `TURSO_DATABASE_URL=file:local.db`, plus any `ADMIN_API_KEY` / `ADMIN_PASSPHRASE`), then seed the SQLite file once:
  ```bash
  npx tsx scripts/seed-local.ts   # creates/populates local.db from src/engine/data/seed-encounters.json
  ```
  `tsx` is not a declared dependency; `npx` fetches it on first use (needs network).
- **Game input needs canvas focus.** Click the game canvas once before using keys. Controls: `Q/W/E/A/S/D` move, `F` forage, `R` rest/camp, number keys select encounter choices (see `src/ui/input.ts`).
- **Two entry points:** `index.html` (game) and `admin.html` → `/admin` (content admin panel, passphrase + `X-API-Key` authenticated).
