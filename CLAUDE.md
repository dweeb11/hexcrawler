# The Waning Light (Hexcrawler)

## Vision
Solo fantasy hexcrawl web game. TypeScript + Canvas 2D, ASCII-glyph terminal aesthetic.
The player is a Cinder-Seeker outrunning the Searing across a procedurally generated hex map.

## Tech Stack

- **Engine:** Pure TypeScript, no game framework. Canvas 2D API for rendering.
- **Build:** Vite
- **Test:** Vitest
- **Hosting:** Vercel (static site + serverless functions)
- **Database:** Turso (hosted SQLite-over-HTTP) for encounter data
- **Target:** Web browser (desktop-first)

## Architecture

Turn-Engine with ECS-Lite. Game state is a single immutable object. All game logic lives in `src/engine/` as pure functions with zero DOM/Canvas dependencies.

```
src/
  engine/          # Pure game logic — no DOM, no Canvas
    state.ts       # GameState type, initial state factory
    turn.ts        # resolveTurn(state, action) → newState
    hex.ts         # Cube coordinate math, neighbors, distance
    map.ts         # Procedural hex generation, tag propagation, fog of war
    searing.ts     # Searing advancement (random axis per game)
    encounters.ts  # Encounter matching, resolution (data from API)
    resources.ts   # Supply/Hope/Health drain, recovery, thresholds
    data/          # Static game data (non-encounter)
      biomes.ts    # Biome weight tables, per-biome tag pools
      incidents.ts # Night incident table
  renderer/        # Canvas 2D — reads state, draws frames
    canvas.ts      # Canvas setup, hex drawing primitives
    glyphs.ts      # ASCII glyph definitions (biomes + feature tags)
    camera.ts      # Viewport tracking player position
    hud.ts         # Resource bars, status text
  ui/              # HTML UI layer
    input.ts       # Keyboard/click → action mapping
    log.ts         # Scrollable narrative event log
    admin.ts       # Admin panel (/admin route)
  api/             # Client-side API helpers
    encounters.ts  # Fetch/cache encounters from /api/encounters
  main.ts          # Bootstrap
api/               # Vercel serverless functions (outside src/)
  encounters/      # CRUD for encounter data in Turso
tests/
  engine/          # Unit tests for pure game logic
  api/             # API route tests
```

**Key rule:** `engine/` never imports from `renderer/` or `ui/`. All game logic is testable in Node without a browser.

### Game Modes

The renderer switches views based on `state.mode`:
- `map` — hex grid with HUD and log
- `encounter` — full-screen encounter view (map hidden)
- `gameover` — death/escape screen

### Hex System

Cube coordinates (`q, r, s` where `q + r + s = 0`). Each hex has a biome and 2-3 tags from: material (`stone`, `wood`, `water`, `sand`, `ice`), feature (`elevated`, `sheltered`, `overgrown`, `flooded`, `hollow`), history (`ancient`, `inhabited`, `abandoned`, `sacred`, `scarred`). Tags propagate from neighbors during generation. Encounters require matching tags.

## Running the Game

```bash
# Install
npm install

# Dev server (game + API routes via Vercel CLI)
npx vercel dev

# Run tests
npx vitest

# Run tests once
npx vitest run

# Build for production
npx vite build

# Deploy
npx vercel --prod
```

### Environment Variables

Required in `.env.local` (never commit — see `.env.example`):
```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
ADMIN_API_KEY=your-secret-key
```

## Key Constants

- Hex size for rendering (pixels)
- Searing advance rate (turns between advances)
- Hope decay rate (turns between passive decay)
- Fog of war thresholds (hope >= 3: full visibility, 1-2: partial, 0: game over)
- Resource starting values (supply, hope, health)

## Key Conventions

- **Immutable state.** `resolveTurn` returns a new `GameState`, never mutates the input.
- **Pure engine.** No `document`, `window`, or Canvas references in `engine/`. If you need randomness, pass a seed or RNG function — don't call `Math.random()` directly in engine code.
- **Tag-driven encounters.** Every encounter has `requiredTags`. Never place an encounter in a hex that doesn't satisfy its tag requirements.
- **Cube coordinates everywhere.** Never use offset or axial coordinates in game logic. Conversion to pixel coordinates happens only in the renderer.
- **Encounter mode is modal.** When an encounter is active, map input is disabled. Resolve the encounter before returning to map mode.
- **Encounter data from API.** Encounters live in Turso, fetched at game startup and cached. The engine receives encounters as data — it never calls the API directly.
- **API key auth on writes.** All write endpoints require `X-API-Key` header with constant-time comparison. Read endpoints are public. Never log the API key.
- **Secrets never committed.** All env vars require `.env.example` entries.

---

## Process

```
  VISION ──▸ ART DIR ──▸ DESIGN ──▸ MILESTONE ──▸ IMPLEMENT ──▸ VERIFY ──▸ SHIP
             (glyph style)  docs/design/  docs/milestones/  branch+test  evidence  merge via PR
```

## Agent Roles

**You are Producer + Engineer. The human is Designer + Assistant Producer.**
- Own the process — update milestone checklists as you complete tasks
- Surface design decisions — don't make them, flag them and wait
- Commit after each task, not at end of session

## Testing

| Code Type | Approach |
|-----------|----------|
| Pure engine logic (turn, hex, map, searing) | Test FIRST (Vitest) |
| API routes, Turso integration | Test ALONGSIDE |
| Renderer, UI, encounter flow | Manual acceptance criteria |

## Git

- Branch per feature: `feat/`, `fix/`, `docs/`, `refactor/`
- PRs for all merges
- Commit after every completed task

## Knowledge

**Read `.claude/knowledge/` before starting work.** Update when you discover non-obvious patterns or gotchas. Max 5 files, 50 lines each.

## Non-Negotiables

- Plans save to `docs/milestones/` or `docs/design/` — NEVER `docs/superpowers/`
- No date-prefixed filenames
- PITCH.md and SCRATCH.md are human-owned — never modify

## Documentation

- `GAME_DESIGN.md` — Original game design document
- `docs/design/` — Design specs and implementation plans
- `docs/milestones/M#-name/` — Milestone checklists
