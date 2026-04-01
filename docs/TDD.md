# TDD: The Waning Light

## Stack
- TypeScript (strict), Canvas 2D API — no game framework
- Vite (build), Vitest (test)
- Vercel (static hosting + serverless functions)
- Turso (hosted SQLite-over-HTTP) for encounter data
- Target: web browser, desktop-first

## Architecture
Turn-Engine with ECS-Lite. Game state is a single immutable object passed through `resolveTurn(state, action) → newState`. Three layers:

- **Engine** (`src/engine/`) — pure game logic, zero DOM/Canvas deps, testable in Node
- **Renderer** (`src/renderer/`) — Canvas 2D, reads state, draws frames. Mode-switching views (map, encounter, gameover)
- **UI** (`src/ui/`) — HTML layer for input mapping, event log, admin panel

Serverless API (`api/`) handles encounter CRUD against Turso. Client fetches at startup and caches.

## Conventions
- Cube coordinates (`q, r, s` where `q + r + s = 0`) everywhere in game logic. Pixel conversion only in renderer.
- Hex tags: material (`stone`, `wood`, `water`, `sand`, `ice`), feature (`elevated`, `sheltered`, `overgrown`, `flooded`, `hollow`), history (`ancient`, `inhabited`, `abandoned`, `sacred`, `scarred`). Tags propagate from neighbors during generation.
- Encounter matching via `requiredTags` — never place an encounter on a non-matching hex.
- State is immutable. No mutations in engine code. Randomness via passed RNG function, not `Math.random()`.
- API writes require `X-API-Key` with constant-time comparison. Reads are public.

## Key Decisions
| Decision | Why | Date |
|----------|-----|------|
| Pure TypeScript + Canvas 2D, no framework | Terminal aesthetic doesn't need a game engine; keeps bundle tiny and logic testable | 2026-03 |
| Turso for encounter storage | Hosted SQLite-over-HTTP fits serverless model; free tier sufficient for this scale | 2026-03 |
| ECS-Lite (single state object) over full ECS | Solo game with simple entity model; full ECS adds complexity without benefit here | 2026-03 |
| Tag propagation from neighbors | Makes biomes cluster naturally without explicit region painting | 2026-03 |
