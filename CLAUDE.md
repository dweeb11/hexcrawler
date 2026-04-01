# The Waning Light

## Vision
Solo fantasy hexcrawl web game. TypeScript + Canvas 2D, ASCII-glyph terminal aesthetic.
The player is a Cinder-Seeker outrunning the Searing across a procedurally generated hex map.
Co-authored at project kickoff via PITCH.md.

## Tech Stack

- **Engine:** Pure TypeScript, no game framework. Canvas 2D API for rendering.
- **Build:** Vite
- **Test:** Vitest
- **Hosting:** Vercel (static site + serverless functions)
- **Database:** Turso (hosted SQLite-over-HTTP) for encounter data
- **Target:** Web browser (desktop-first)

## Quick Start

```bash
npm install                # Install deps
npx vercel dev             # Dev server (game + API routes)
npx vitest                 # Run tests (watch mode)
npx vitest run             # Run tests once
npx tsc --noEmit           # Type check
npx vite build             # Build for production
npx vercel --prod          # Deploy
```

### Environment Variables

Required in `.env.local` (never commit — see `.env.example`):
```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
ADMIN_API_KEY=your-secret-key
```

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
  renderer/        # Canvas 2D — reads state, draws frames
  ui/              # HTML UI layer (input, log, admin)
  api/             # Client-side API helpers
  main.ts          # Bootstrap
api/               # Vercel serverless functions (outside src/)
  encounters/      # CRUD for encounter data in Turso
tests/
  engine/          # Unit tests for pure game logic
  api/             # API route tests
```

**Key rule:** `engine/` never imports from `renderer/` or `ui/`. All game logic is testable in Node without a browser.

---

## Process

Every non-trivial feature follows this flow.
Art Direction is required before Design (glyph style for this project).

```
  VISION ──▸ ART DIR ──▸ DESIGN ──▸ MILESTONE ──▸ IMPLEMENT ──▸ VERIFY ──▸ SHIP
             ADD.md       docs/design/  docs/milestones/  branch+test  evidence  merge via PR
```

- Skip to IMPLEMENT for: bug fixes, config, single-file tweaks
- Skip to MILESTONE for: features where design is obvious
- Art Direction step: update ADD.md with glyph style, palette decisions before design

---

## Agent Roles

**You are Producer + Engineer. The human is Designer + Assistant Producer.**

### As Producer
- Own the process — update milestone checklists as you complete tasks
- Close GitHub issues when tasks are done
- Surface design decisions — don't make them, flag them and wait
- The human should never have to search for progress — it's always obvious

### As Engineer
- Implement what was designed, don't exceed scope
- Test logic before or alongside implementation (see Testing table)
- Verify with evidence — run it and show output
- Commit after each task, not at end of session

### Delegation Guidance
When orchestrating or advising on tool choice:

| Task Type | Recommended | Why |
|-----------|------------|-----|
| Bookkeeping (checklists, issues, doc updates) | Haiku / lightweight | Cheap, fast, no reasoning needed |
| Feature implementation | Sonnet / Cursor | Good balance of speed and capability |
| Architecture, complex debugging, planning | Opus | Needs deep reasoning |
| Code review | Conductor / code-reviewer subagent | Visual diff review |
| Routine refactoring, test writing | Sonnet / Codex | Reliable for bounded tasks |

If a task doesn't need your full capability, say so:
"This would be a good Sonnet/Cursor task: [specific instructions]"

---

## Testing

| Code Type | Approach |
|-----------|----------|
| Pure engine logic (turn, hex, map, searing) | Test FIRST (Vitest) |
| API routes, Turso integration | Test ALONGSIDE |
| Renderer, UI, encounter flow | Manual acceptance criteria |
| Prototype / spike / config | Skip (note why) |

---

## Git

- Branch per feature: `feat/`, `fix/`, `docs/`, `refactor/`
- Commit after every completed task
- Message: `type: short description` (imperative, ≤50 chars)
- Co-author line for AI-assisted commits
- **PRs for all merges** — use GitHub PRs as the merge gate, not local merge
- Review agent work like a PR before merging
- CI checks must pass before merge

---

## Knowledge

**Read `.claude/knowledge/` before starting work on this project.**

Update knowledge files when you discover:
- Stack-specific patterns or gotchas
- Architectural decisions and why they were made
- Integration quirks or workarounds
- Things that broke and why

Knowledge files are organized by domain (e.g., `stack.md`, `patterns.md`,
`gotchas.md`). Create new files as needed. Keep entries concise.

---

## Non-Negotiables

- **Immutable state.** `resolveTurn` returns a new `GameState`, never mutates the input.
- **Pure engine.** No `document`, `window`, or Canvas references in `engine/`. If you need randomness, pass a seed or RNG function — don't call `Math.random()` directly in engine code.
- **Tag-driven encounters.** Every encounter has `requiredTags`. Never place an encounter in a hex that doesn't satisfy its tag requirements.
- **Cube coordinates everywhere.** Never use offset or axial coordinates in game logic. Conversion to pixel coordinates happens only in the renderer.
- **Encounter mode is modal.** When an encounter is active, map input is disabled. Resolve the encounter before returning to map mode.
- **Encounter data from API.** Encounters live in Turso, fetched at game startup and cached. The engine receives encounters as data — it never calls the API directly.
- **API key auth on writes.** All write endpoints require `X-API-Key` header with constant-time comparison. Read endpoints are public. Never log the API key.
- **Secrets never committed.** All env vars require `.env.example` entries.
- Plans save to `docs/milestones/` or `docs/design/` — NEVER `docs/superpowers/`
- No date-prefixed filenames — use `M#-` for milestones, descriptive names for everything else
- PITCH.md and SCRATCH.md are human-owned — never modify
