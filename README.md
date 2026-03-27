# The Waning Light

A solo fantasy hexcrawl web game. You are a Cinder-Seeker outrunning the Searing — a wall of consuming light — across a procedurally generated hex map. Manage dwindling supplies, discover encounters driven by terrain tags, and push deeper into the unknown before the world burns behind you.

Terminal aesthetic. ASCII glyphs. Canvas 2D. No framework.

## Current State

**MVP in progress.** The core engine, renderer, encounter system, and admin panel are implemented and working. The game runs in the browser with a full turn loop: move, forage, camp, encounter, and Searing advancement.

- 44 tests passing across 9 test suites
- Encounter data stored in Turso (hosted SQLite), managed via admin panel
- Deployed to Vercel (static site + serverless API routes)
- Live at [havana-liart.vercel.app](https://havana-liart.vercel.app)

### What works

- Procedural hex map generation with biome-based tag propagation
- Cube coordinate movement with fog of war (tied to Hope resource)
- Resource management: Supply, Hope, Health with drain/recovery mechanics
- Tag-driven encounter matching and choice resolution
- Searing advancement along a random axis (set per game)
- Night incidents during camping
- Full-screen encounter mode (map input disabled during encounters)
- Admin panel for encounter CRUD at `/admin`
- API routes with key-authenticated writes and public reads

### What's next (not yet implemented)

- Rumor Deck (discoverable hints about the map)
- Relics (persistent items with tradeoffs)
- Win/escape conditions
- Low-Hope visual/mechanical effects
- Save/load
- Sound

## Tech Stack

| Layer | Tech |
|-------|------|
| Language | TypeScript (ES modules) |
| Rendering | Canvas 2D API |
| Build | Vite |
| Tests | Vitest |
| Database | Turso (libSQL over HTTP) |
| Hosting | Vercel (static + serverless) |

No game framework. The engine is pure TypeScript with zero DOM dependencies.

## Architecture

```
src/
  engine/          # Pure game logic — no DOM, no Canvas
    state.ts       # GameState type, initial state factory
    turn.ts        # resolveTurn(state, action) → newState
    hex.ts         # Cube coordinate math
    map.ts         # Procedural generation, tag propagation, fog of war
    searing.ts     # Searing advancement
    encounters.ts  # Encounter matching and resolution
    resources.ts   # Supply/Hope/Health management
    data/          # Static game data (biomes, incidents)
  renderer/        # Canvas 2D — reads state, draws frames
  ui/              # HTML UI layer (input, log, admin)
  api/             # Client-side API helpers
  main.ts          # Bootstrap
api/               # Vercel serverless functions (encounter CRUD + seeding)
tests/
  engine/          # Unit tests for pure game logic
  api/             # API route tests
```

**Key constraint:** `engine/` never imports from `renderer/` or `ui/`. All game logic is testable in Node without a browser.

## Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in values
cp .env.example .env.local
```

Required environment variables (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `TURSO_DATABASE_URL` | libSQL database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `ADMIN_API_KEY` | Secret key for write API endpoints |

## Development

```bash
# Dev server (game + API routes)
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Production build
npm run build
```

The dev server runs on `http://localhost:5173` (Vite) or `http://localhost:3000` (Vercel CLI). API routes at `/api/encounters` work in both modes via a custom Vite plugin.

### Seeding encounter data

```bash
# Seed the database with starter encounters
npx tsx scripts/seed-local.ts
```

## Deployment

Deployed to Vercel via CLI (no Git integration):

```bash
npx vercel --prod
```

Environment variables must be configured in the Vercel dashboard for Production.

## Project Documentation

| Document | Purpose |
|----------|---------|
| `PITCH.md` | Design vision (human-owned, not modified by agents) |
| `GAME_DESIGN.md` | Original game design document |
| `WORKING_AGREEMENT.md` | Development process and conventions |
| `WORKING_AGREEMENT.games.md` | Game-specific development conventions |
| `GIT_CONVENTIONS.md` | Branching and commit standards |
| `MULTI_AGENT.md` | Multi-agent collaboration model |
| `docs/superpowers/specs/` | Technical design specs |
| `docs/milestones/` | Milestone checklists |

## License

ISC
