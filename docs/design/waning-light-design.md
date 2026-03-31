# The Waning Light — Technical Design Spec

## Overview

A solo fantasy hexcrawl built as a web application. TypeScript, Canvas 2D renderer with ASCII-glyph terminal aesthetic, Vite + Vitest toolchain. The player is a Cinder-Seeker traveling the Twilight Strip, outrunning the Searing — an unstoppable environmental catastrophe that advances from a random direction each game.

## MVP Scope

Core loop + encounters + the Searing + admin panel. No Rumor Deck, no Relics, no win conditions beyond survival/escape. The player can Push (move) or Pause (camp), manage Supply/Hope/Health, encounter biome-specific events, and race the Searing across a procedurally generated hex map.

**GDD deviations:** The GDD describes biomes as "determined by the Rumor Deck." For MVP, biomes use weighted random generation with neighbor influence instead. The Rumor Deck is deferred to a future milestone. Low-Hope effects (hallucinations, Shadow Encounters, reduced efficiency) from the GDD are also deferred — MVP implements only reduced fog-of-war visibility at low Hope.

## Architecture

**Turn-Engine with ECS-Lite.** Game state is a single immutable object. A pure reducer `resolveTurn(state, action) → newState` processes all game logic. Canvas renderer subscribes to state changes. All game logic lives in `engine/` with zero DOM/Canvas dependencies — fully testable without a browser.

### Project Structure

```
src/
  engine/          # Pure game logic — no DOM, no Canvas
    state.ts       # GameState type, initial state factory
    turn.ts        # TurnEngine: resolveTurn(state, action) → newState
    hex.ts         # Cube coordinate math, neighbors, distance
    map.ts         # Procedural hex generation, tag propagation, fog of war
    searing.ts     # Searing advancement (random axis per game)
    encounters.ts  # Encounter matching, resolution (consumes data from API)
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
    admin.ts       # Admin panel for encounter authoring
  api/             # Client-side API helpers
    encounters.ts  # Fetch/cache encounters from /api/encounters
  main.ts          # Bootstrap
api/               # Vercel serverless functions (outside src/)
  encounters/
    index.ts       # GET /api/encounters — list all (public, no auth)
    [id].ts        # GET/PUT/DELETE /api/encounters/:id (writes require API key)
    create.ts      # POST /api/encounters (requires API key)
  seed.ts          # POST /api/seed — populate DB with seed encounters (requires API key)
tests/
  engine/          # Unit tests for pure game logic
  api/             # Tests for API routes (against test DB)
```

**Key rule:** `engine/` never imports from `renderer/` or `ui/`. All game logic is testable in Node without a browser.

**Serialization note:** `GameState` uses `Map<string, HexTile>` and `Set<string>` for tags at runtime. These do not serialize to JSON natively. For testing snapshots and future save/load, provide `serialize`/`deserialize` helpers in `state.ts` that convert Map → Record and Set → Array.

## Core State

```typescript
interface GameState {
  player: { hex: CubeCoord; supply: number; hope: number; health: number };
  map: Map<string, HexTile>;         // revealed hexes, keyed by "q,r,s"
  searing: SearingState;
  turn: number;
  mode: GameMode;
  log: LogEntry[];
  status: "playing" | "won" | "lost";
}

interface SearingState {
  axis: HexAxis;         // which of 3 cube axes the Searing advances along
  direction: 1 | -1;     // positive or negative along that axis
  line: number;           // current threshold — everything past this is consumed
  advanceRate: number;    // advance every N turns
}

type GameMode =
  | { type: "map" }
  | { type: "encounter"; encounter: Encounter; hex: CubeCoord }
  | { type: "gameover"; reason: string };

type Action =
  | { type: "push"; direction: HexDirection }
  | { type: "pause"; activity: "rest" | "forage" }
  | { type: "choose"; choiceIndex: number };

interface ResourceDelta {
  supply?: number;    // positive = gain, negative = cost
  hope?: number;
  health?: number;
}
```

## Starting Values

| Constant | Value | Notes |
|----------|-------|-------|
| Starting Supply | 6 | ~6 moves before needing to forage |
| Max Supply | 10 | Can't hoard indefinitely |
| Starting Hope | 5 | Full visibility at start |
| Max Hope | 5 | |
| Starting Health | 3 | Low — you're fragile |
| Max Health | 5 | |
| Searing advance rate | 4 turns | Advances 1 step every 4 turns |
| Hope decay interval | 6 turns | Lose 1 Hope every 6 turns passively |
| Starting hexes revealed | 1 | Player's starting hex only; neighbors revealed by fog-of-war |

The player starts on a `settlement` hex tagged `inhabited, sheltered` — a safe starting point before venturing out.

## Turn Resolution

`resolveTurn` processes actions as a pure pipeline:

1. Validate action (enough supply to Push? valid direction? correct mode?)
2. Apply player action (move position or camp)
3. If moving into fog: generate new hex (biome + tags + encounter)
4. If hex has encounter: transition to encounter mode, pause pipeline
5. If encounter choice made: resolve outcome, apply resource changes, return to map mode
6. If camping with `rest`: recover +1 Health (capped at max), then roll night incident
7. If camping with `forage`: roll for supply (biome-dependent, see below), then roll night incident
8. Apply passive effects (hope decay every `hopeDecayInterval` turns)
9. Advance the Searing (if turn is divisible by `advanceRate`)
10. Check loss conditions (health zero, hope zero, player on consumed hex)
11. Return new state

### Forage Success Rates

Foraging success depends on biome:

| Biome | Success chance | Yield |
|-------|---------------|-------|
| Forest | 70% | +2 Supply |
| Mountain | 30% | +1 Supply |
| Ruins | 50% | +2 Supply |
| Settlement | 80% | +3 Supply |
| Wastes | 20% | +1 Supply |

Tags modify foraging: `water` adds +10% success, `overgrown` adds +10% success, `abandoned` adds +1 yield on success (scavenging left-behind goods).

### Zero Supply

Zero supply is **recoverable**. The player can still Pause and forage. If foraging fails, they remain at 0 supply and can try again next turn — but the Searing keeps advancing. This creates a tense but not unfair death spiral: you're stuck, burning time, hoping for a successful forage before the Searing reaches you.

## Hex System

**Cube coordinates** (`q, r, s` where `q + r + s = 0`). Six directions for neighbor calculation. Distance = max of absolute coordinate differences.

### Tagged Hex Tiles

```typescript
interface HexTile {
  coord: CubeCoord;
  biome: Biome;
  tags: Set<string>;
  encounter: Encounter | null;    // determined at hex creation, not entry
  revealed: boolean;
  consumed: boolean;
}

type Biome = "forest" | "mountain" | "ruins" | "settlement" | "wastes";
```

**Biome definitions:**
- `forest` — dense woodland, the most common biome in the Twilight Strip
- `mountain` — rocky highlands, sparse resources but good vantage
- `ruins` — remnants of civilization consumed by previous Searing advances
- `settlement` — inhabited outposts clinging to the Strip, best for resupply
- `wastes` — barren ground at the edges of the Strip (both heat-blasted and frost-touched)

**Tag categories:**
- Material: `stone`, `wood`, `water`, `sand`, `ice`
- Feature: `elevated`, `sheltered`, `overgrown`, `flooded`, `hollow`
- History: `ancient`, `inhabited`, `abandoned`, `sacred`, `scarred`

### Biome Weight Table

Base weights (out of 100) when generating a hex with no revealed neighbors:

| Biome | Weight |
|-------|--------|
| Forest | 35 |
| Mountain | 20 |
| Ruins | 15 |
| Settlement | 10 |
| Wastes | 20 |

**Neighbor influence:** For each revealed neighbor, the neighbor's biome gets +15 weight. This creates biome clustering without rigid zones.

### Per-Biome Tag Pools

Each biome rolls 1-2 tags from its own pool, plus inherits 0-2 from neighbors.

| Biome | Primary tags (higher weight) | Secondary tags (lower weight) |
|-------|----------------------------|------------------------------|
| Forest | `wood`, `water`, `overgrown` | `sheltered`, `sacred`, `ancient` |
| Mountain | `stone`, `elevated`, `ice` | `hollow`, `ancient`, `scarred` |
| Ruins | `stone`, `ancient`, `abandoned` | `sacred`, `scarred`, `hollow` |
| Settlement | `wood`, `inhabited`, `sheltered` | `water`, `stone`, `sacred` |
| Wastes | `sand`, `scarred`, `flooded` | `ice`, `abandoned`, `hollow` |

Primary tags: 70% selection weight. Secondary tags: 30% selection weight.

### Map Generation (Tag Propagation)

When the player Pushes into an unrevealed hex:

1. Roll biome (weighted table + neighbor influence)
2. Inherit 0-2 tags from revealed neighbors (weighted random selection)
3. Roll 1-2 fresh tags from the biome's tag pool
4. Deduplicate — result is 2-3 unique tags per hex
5. Roll encounter from matching encounters (if any match the hex's tags)

**Encounter determination:** Encounters are generated and stored at hex creation time, not at entry time. When a hex is visible via fog-of-war but unvisited, its encounter is already determined — the `!` marker is shown. This is consistent and avoids timing issues with tag propagation.

Adjacent hexes sharing tags produces emergent geography — a run of `water` tags feels like a river, a cluster of `ancient` tags feels like old empire territory.

### Encounter Matching

Encounters define `requiredTags`. An encounter can only appear in a hex whose tags are a superset of the encounter's required tags.

```typescript
interface Encounter {
  id: string;
  text: string;
  requiredTags: string[];
  biomes?: Biome[];         // optional biome restriction (any biome if omitted)
  choices: Choice[];
}

interface Choice {
  label: string;
  outcome: ResourceDelta;
  chance?: number;           // probability of success (0-1), default 1.0
  failureOutcome?: ResourceDelta;  // applied if chance roll fails (default: no effect)
}
```

**`chance` semantics:** When `chance` is present, the choice succeeds with that probability. On success, `outcome` is applied. On failure, `failureOutcome` is applied (defaults to zero effect if omitted). The result text should reflect success or failure.

## Seed Encounter Table

These encounters ship with MVP. The admin panel allows adding more.

### Forest Encounters

| ID | Required Tags | Text | Choices |
|----|---------------|------|---------|
| `forest-stream` | `water` | A clear stream cuts through the undergrowth. The water looks clean. | Drink (+2 Hope) / Fill waterskin (+1 Supply) |
| `forest-thicket` | `overgrown` | The brush is impossibly dense. Something rustles deeper in. | Push through (70%: +2 Supply, fail: -1 Health) / Go around (no effect) |
| `forest-shrine` | `sacred` | A moss-covered shrine. Offerings of dried flowers still rest at its base. | Pray (+2 Hope) / Search for supplies (+1 Supply, -1 Hope) |
| `forest-camp` | `sheltered` | An abandoned campsite. The fire pit is cold but the lean-to still stands. | Rest here (+1 Health, +1 Hope) / Scavenge (+2 Supply) |

### Mountain Encounters

| ID | Required Tags | Text | Choices |
|----|---------------|------|---------|
| `mountain-cave` | `hollow` | A cave mouth yawns in the rock face. Wind moans from inside. | Enter (60%: +3 Supply, fail: -2 Health) / Pass by (no effect) |
| `mountain-vista` | `elevated` | From this height, the world unfolds. You can see the Searing's glow on the horizon. | Survey (+2 Hope, reveals 2 extra hexes) / Rest (+1 Health) |
| `mountain-ice` | `ice` | A frozen waterfall, beautiful and alien. Ice crystals catch what little light remains. | Harvest ice (+1 Supply) / Contemplate (+1 Hope) |

### Ruins Encounters

| ID | Required Tags | Text | Choices |
|----|---------------|------|---------|
| `ruins-library` | `ancient` | Crumbling shelves still hold books. Most are ash, but a few survived. | Read (50%: +3 Hope, fail: +1 Hope) / Search for supplies (+1 Supply) |
| `ruins-cellar` | `hollow` | A trapdoor leads to a cellar beneath the rubble. | Descend (70%: +3 Supply, fail: -1 Health) / Leave it (no effect) |
| `ruins-monument` | `sacred`, `ancient` | A monument to someone forgotten. The inscription is almost legible. | Study inscription (+2 Hope) / Pry loose the metalwork (+2 Supply, -1 Hope) |

### Settlement Encounters

| ID | Required Tags | Text | Choices |
|----|---------------|------|---------|
| `settlement-trader` | `inhabited` | A weary trader offers to barter. Their cart is half-empty. | Trade Hope for Supply (-1 Hope, +3 Supply) / Trade Supply for Hope (-2 Supply, +2 Hope) |
| `settlement-healer` | `inhabited`, `sheltered` | A healer's hut, still occupied. They look you over with tired eyes. | Accept healing (+2 Health, -1 Supply) / Decline (no effect) |
| `settlement-abandoned` | `abandoned` | Empty buildings. Doors swing on hinges. Whoever lived here left in a hurry. | Scavenge thoroughly (80%: +3 Supply, fail: +1 Supply) / Quick search (+1 Supply) |

### Wastes Encounters

| ID | Required Tags | Text | Choices |
|----|---------------|------|---------|
| `wastes-mirage` | `sand` | Heat shimmer or real water? It's hard to tell in this light. | Investigate (40%: +2 Supply, fail: -1 Hope) / Ignore (-0 effect) |
| `wastes-bones` | `scarred` | Bleached bones arranged in a pattern. This was deliberate. | Study the pattern (+1 Hope) / Search the remains (50%: +2 Supply, fail: -1 Health) |
| `wastes-frost` | `ice` | A pocket of impossible cold. Frost coats everything in a thin shell. | Shelter in the cold (+2 Hope, -1 Health) / Harvest frost (+1 Supply) |

### Universal Encounters (Any Biome)

| ID | Required Tags | Text | Choices |
|----|---------------|------|---------|
| `any-traveler` | `inhabited` | Another Cinder-Seeker, heading the same direction. They nod in recognition. | Share supplies (-1 Supply, +2 Hope) / Nod and move on (+1 Hope) |
| `any-old-road` | `ancient`, `stone` | Paving stones from a road that once connected cities. Parts of it still hold. | Follow it (+1 Supply, faster travel feel) / Leave the path (no effect) |

## Night Incident Table

When the player Pauses (rest or forage), a night incident is rolled after the primary action resolves. 60% chance of no incident (quiet night). 40% chance of rolling from this table:

| ID | Text | Effect | Weight |
|----|------|--------|--------|
| `night-theft` | Something crept into your camp. Supplies are missing. | -1 Supply | 25 |
| `night-noise` | Strange sounds in the dark. You barely sleep. | -1 Hope | 25 |
| `night-stars` | The sky clears for a moment. You remember why you keep going. | +1 Hope | 20 |
| `night-find` | While settling in, you notice something half-buried nearby. | +1 Supply | 15 |
| `night-wound` | You wake to a scratch you don't remember getting. | -1 Health | 10 |
| `night-dream` | A vivid dream of the world before the sun stalled. It felt real. | +2 Hope | 5 |

## The Searing

At game start, one of 6 hex directions is chosen randomly. The Searing advances along that axis every 4 turns. Any hex past the Searing line is consumed — impassable, settlements destroyed, player death if standing there when it advances.

The player must move generally away from the Searing. The random axis prevents memorized optimal paths across games.

## Fog of War

Hope-driven visibility:
- Hope >= 3: all 6 neighbors visible (biome + feature glyphs shown)
- Hope 1-2: 3 neighbors visible (in the 3 directions away from the Searing)
- Hope 0: game over

## Resources

| Resource | Spent by | Gained by | Zero = |
|----------|----------|-----------|--------|
| Supply | Push (-1 per move) | Encounters, foraging (Pause, biome-dependent) | Can't Push — must forage (recoverable) |
| Hope | Passive decay (every 6 turns), bad encounters, Searing proximity | Good encounters, resting does NOT restore Hope | Game over |
| Health | Combat encounters, failed risky choices | Resting (Pause, +1 Health) | Game over |

**Key distinction:** Resting recovers Health. Foraging recovers Supply. Hope is only gained from encounters, discoveries, and night incidents — it is the scarcest resource.

## Rendering

### Map View

Canvas 2D with terminal color palette (dark background, muted biome colors, bright red Searing edge).

Each hex displays:
- Centered biome glyph: `♠` forest, `▲` mountain, `Ω` ruins, `⌂` settlement, `~` wastes
- Smaller feature tag glyphs beneath: `≈` water, `○` stone, `╫` wood, `▵` elevated, `⌐` sheltered, `❋` overgrown, `▿` flooded, `◠` hollow, `†` sacred, `∴` ancient, `☗` inhabited, `∅` abandoned, `╳` scarred
- Player position: `@`
- Unresolved encounter marker: `!`
- Searing edge: `░▒▓█` gradient advancing from consumed side
- Fog hexes: dimmed or hidden

HUD overlay shows resource bars as text (`Supply: ████░░ 4/6`), turn counter, Searing proximity warning.

### Encounter View

Full-screen takeover — hex map hidden. Displays:
- Encounter narrative text
- Hex biome and tags as context
- Numbered choice options
- Resource cost/gain preview per choice
- On choices with `chance < 1.0`: show the probability

Dismisses after resolution, returns to map view with log updated.

### Camp View

Brief screen for Pause actions showing rest/forage result and any night incident before returning to map.

### Game Over View

Death/escape screen with reason and "New Game" option.

## Input

- **Map mode:** `QWEASD` for 6 hex directions (Push). `R` to rest, `F` to forage (Pause). Click adjacent hex as alternative.
- **Encounter mode:** `1`, `2`, `3` keys for choices.
- **Game over:** `Enter` for new game.

## Event Log

HTML `<div>` panel alongside the canvas. All narrative text flows here — encounter descriptions, outcomes, Searing warnings, resource changes. Scrollable history. This is where the game's atmosphere lives.

## Data Layer — Vercel + Turso

Encounter data lives in a Turso database (hosted SQLite), accessed via Vercel serverless API routes. The game is a static Vite app deployed to Vercel. This allows live encounter editing without rebuilding or redeploying.

### Turso Schema

```sql
CREATE TABLE encounters (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  required_tags TEXT NOT NULL,    -- JSON array: ["water", "ancient"]
  biomes TEXT,                    -- JSON array: ["forest", "ruins"] or null (any biome)
  choices TEXT NOT NULL,          -- JSON array of Choice objects
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Tags and choices are stored as JSON strings in SQLite — simple, queryable enough for this scale, and avoids join complexity. The `Encounter` TypeScript type is the canonical shape; the API layer handles serialization.

### API Routes

All routes live in `api/` (Vercel convention for serverless functions).

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/encounters` | GET | None | List all encounters (public — the game calls this) |
| `/api/encounters` | POST | API key | Create a new encounter |
| `/api/encounters/[id]` | GET | None | Get single encounter |
| `/api/encounters/[id]` | PUT | API key | Update an encounter |
| `/api/encounters/[id]` | DELETE | API key | Delete an encounter |
| `/api/seed` | POST | API key | Populate DB with seed encounters from spec |

### Authentication

Write endpoints require an `X-API-Key` header. The key is stored as a Vercel environment variable (`ADMIN_API_KEY`). Comparison must be constant-time to prevent timing attacks. Read endpoints are public — the game needs to fetch encounters without auth.

No user accounts, no sessions — just a single API key for the admin. This is a solo content tool, not a multi-user system.

### Game Startup Flow

1. Game calls `GET /api/encounters` on startup
2. Response is cached in memory for the session (encounters don't change mid-game)
3. Engine uses the cached encounter list for tag matching during hex generation
4. If the API is unreachable, fall back to a bundled seed encounter set (baked into the build as a safety net)

### Seed Data

The seed encounters defined in this spec (16 biome-specific + 2 universal) ship as both:
- A `POST /api/seed` endpoint that populates an empty Turso database
- A bundled fallback JSON file (`src/engine/data/seed-encounters.json`) for offline/failure scenarios

### Environment Variables

```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
ADMIN_API_KEY=your-secret-key
```

All stored in Vercel environment settings, never committed. `.env.example` documents required vars.

## Admin Panel

A separate route (`/admin`) for authoring and managing encounters. Not part of the game UI — this is a content tool. Protected client-side by requiring the API key before showing the interface (the real security is on the API routes, but this prevents casual access).

### Features

- **List all encounters** — sortable/filterable by biome, tags, ID
- **Create new encounter** — form with fields: ID, text, required tags (multi-select), optional biome restriction, choices (label, outcome resource deltas, optional chance + failure outcome)
- **Edit existing encounters** — same form, pre-populated
- **Delete encounters** (with confirmation)
- **Preview** — show how an encounter would render in the encounter view
- **Export/Import** — JSON export/import of full encounter table for backup or migration

### Implementation

The admin panel is an HTML UI layer in `src/ui/admin.ts`, rendered at the `/admin` route. It communicates with the API routes for all CRUD operations, passing the API key via `X-API-Key` header. The key is entered once per session and stored in `sessionStorage` (not `localStorage` — cleared on tab close).

Clean, functional form-based UI — does not need the terminal aesthetic. Content authoring benefits from clarity over atmosphere.

## Toolchain

- **Build:** Vite
- **Language:** TypeScript (strict mode)
- **Test:** Vitest — unit tests for `engine/` modules, API route tests against a test Turso DB
- **Hosting:** Vercel (static site + serverless functions)
- **Database:** Turso (hosted libSQL / SQLite-over-HTTP)
- **ORM/Client:** `@libsql/client` (Turso's official client, lightweight)
- **No external game framework** — Canvas 2D API directly

## Future Milestones (Not in MVP)

- Rumor Deck system (procedural quest spawning)
- Relics (permanent upgrades)
- Win conditions (Pillars of Frost, Restart the Gear)
- Save/load (state serialization — Map/Set helpers already in place)
- Sound design
- Low-Hope hallucination effects (visual distortion, Shadow Encounters)
