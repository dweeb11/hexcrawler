# The Waning Light MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable solo hexcrawl web game with procedural map generation, resource management, encounters fetched from a Turso database, the Searing mechanic, and an admin panel for live encounter editing.

**Architecture:** Pure turn engine (`resolveTurn(state, action) → newState`) with zero DOM dependencies, Canvas 2D renderer with ASCII-glyph terminal aesthetic, Vercel serverless API routes for encounter CRUD backed by Turso (hosted SQLite). Game fetches encounters at startup and caches them.

**Tech Stack:** TypeScript (strict), Vite, Vitest, Vercel (hosting + serverless), Turso (`@libsql/client`), Canvas 2D API

**Spec:** `docs/2026-03-20-waning-light-design.md`

---

## File Map

### Create

**Engine (pure logic, no DOM):**
- `src/engine/hex.ts` — CubeCoord type, directions, neighbors, distance, coordinate key
- `src/engine/state.ts` — GameState, HexTile, SearingState, Action, GameMode types; constants; createInitialState; serialize/deserialize
- `src/engine/resources.ts` — applyDelta, clampResources, checkLoss
- `src/engine/data/biomes.ts` — biome weight table, per-biome tag pools
- `src/engine/map.ts` — generateHex (biome roll, tag propagation, encounter assignment), fog of war visibility
- `src/engine/searing.ts` — initSearing (random axis), advanceSearing, isConsumed
- `src/engine/encounters.ts` — findMatchingEncounters, resolveChoice (chance roll)
- `src/engine/data/incidents.ts` — night incident table, rollIncident
- `src/engine/resources.ts` — forage logic (biome/tag modifiers) lives here alongside resource helpers
- `src/engine/turn.ts` — resolveTurn reducer composing all subsystems
- `src/engine/data/seed-encounters.json` — 18 seed encounters as JSON

**Data layer:**
- `api/lib/db.ts` — Turso client singleton
- `api/lib/auth.ts` — API key validation (constant-time comparison)
- `api/encounters/index.ts` — GET (list all) + POST (create, authed)
- `api/encounters/[id].ts` — GET/PUT/DELETE single encounter
- `api/seed.ts` — POST seed endpoint
- `src/api/encounters.ts` — client-side fetch + cache + fallback

**Renderer:**
- `src/renderer/canvas.ts` — canvas setup, hex polygon drawing, coordinate conversions
- `src/renderer/glyphs.ts` — biome glyphs, tag glyphs, color palette
- `src/renderer/camera.ts` — viewport offset tracking player
- `src/renderer/hud.ts` — resource bars, turn counter, searing warning
- `src/renderer/views/map.ts` — map view (hex grid + fog + searing edge + player)
- `src/renderer/views/encounter.ts` — full-screen encounter view
- `src/renderer/views/camp.ts` — camp result view
- `src/renderer/views/gameover.ts` — game over screen
- `src/renderer/renderer.ts` — top-level render dispatcher based on GameMode

**UI:**
- `src/ui/input.ts` — keyboard + click → Action mapping
- `src/ui/log.ts` — scrollable event log HTML panel
- `src/ui/admin.ts` — admin panel at /admin route

**Bootstrap:**
- `src/main.ts` — wire engine + renderer + input + encounter fetch
- `index.html` — entry HTML

**Config:**
- `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `vercel.json`
- `.env.example`, `.gitignore`

**Tests:**
- `tests/engine/hex.test.ts`
- `tests/engine/resources.test.ts`
- `tests/engine/map.test.ts`
- `tests/engine/searing.test.ts`
- `tests/engine/encounters.test.ts`
- `tests/engine/incidents.test.ts`
- `tests/engine/turn.test.ts`
- `tests/api/encounters.test.ts`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `vercel.json`, `.env.example`, `.gitignore`, `index.html`

- [ ] **Step 1: Initialize npm project and install dependencies**

```bash
npm init -y
npm install @libsql/client
npm install -D typescript vite vitest @types/node
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*", "api/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create vercel.json**

```json
{
  "buildCommand": "npx vite build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

- [ ] **Step 6: Create .env.example**

```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
ADMIN_API_KEY=your-secret-key
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
.vercel/
```

- [ ] **Step 8: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Waning Light</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #c0c0c0; font-family: monospace; overflow: hidden; }
    #app { display: flex; width: 100vw; height: 100vh; }
    #game-canvas { flex: 1; }
    #log-panel { width: 300px; overflow-y: auto; padding: 8px; border-left: 1px solid #333; font-size: 13px; line-height: 1.4; }
  </style>
</head>
<body>
  <div id="app">
    <canvas id="game-canvas"></canvas>
    <div id="log-panel"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 9: Create placeholder src/main.ts**

```typescript
console.log("The Waning Light");
```

- [ ] **Step 10: Verify build and dev server work**

Run: `npx vite build && npx vite preview --port 4173 &; sleep 2; curl -s http://localhost:4173 | head -5; kill %1`
Expected: HTML output with "The Waning Light" title.

- [ ] **Step 11: Verify test runner works**

Create `tests/smoke.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx vitest run`
Expected: 1 test passed.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts vercel.json .env.example .gitignore index.html src/main.ts tests/smoke.test.ts
git commit -m "feat: scaffold Vite + TypeScript + Vitest project"
```

---

## Task 2: Hex Math

**Files:**
- Create: `src/engine/hex.ts`, `tests/engine/hex.test.ts`

- [ ] **Step 1: Write failing tests for hex math**

```typescript
// tests/engine/hex.test.ts
import { describe, it, expect } from "vitest";
import {
  type CubeCoord,
  cubeCoord,
  coordKey,
  coordFromKey,
  HEX_DIRECTIONS,
  neighbor,
  neighbors,
  hexDistance,
  ring,
} from "../../src/engine/hex";

describe("cubeCoord", () => {
  it("enforces q + r + s = 0", () => {
    const c = cubeCoord(1, -1, 0);
    expect(c.q + c.r + c.s).toBe(0);
  });

  it("throws on invalid coordinates", () => {
    expect(() => cubeCoord(1, 1, 1)).toThrow();
  });
});

describe("coordKey / coordFromKey", () => {
  it("round-trips", () => {
    const c = cubeCoord(3, -1, -2);
    expect(coordFromKey(coordKey(c))).toEqual(c);
  });
});

describe("HEX_DIRECTIONS", () => {
  it("has 6 directions", () => {
    expect(HEX_DIRECTIONS).toHaveLength(6);
  });

  it("each direction sums to 0", () => {
    for (const d of HEX_DIRECTIONS) {
      expect(d.q + d.r + d.s).toBe(0);
    }
  });
});

describe("neighbor", () => {
  it("returns adjacent hex in given direction", () => {
    const origin = cubeCoord(0, 0, 0);
    const n = neighbor(origin, 0); // east
    expect(n).toEqual(cubeCoord(1, 0, -1));
  });
});

describe("neighbors", () => {
  it("returns 6 neighbors", () => {
    const origin = cubeCoord(0, 0, 0);
    expect(neighbors(origin)).toHaveLength(6);
  });
});

describe("hexDistance", () => {
  it("returns 0 for same coord", () => {
    const c = cubeCoord(0, 0, 0);
    expect(hexDistance(c, c)).toBe(0);
  });

  it("returns 1 for adjacent hexes", () => {
    const a = cubeCoord(0, 0, 0);
    const b = cubeCoord(1, -1, 0);
    expect(hexDistance(a, b)).toBe(1);
  });

  it("returns correct distance for far hexes", () => {
    const a = cubeCoord(0, 0, 0);
    const b = cubeCoord(3, -2, -1);
    expect(hexDistance(a, b)).toBe(3);
  });
});

describe("ring", () => {
  it("returns 6 hexes at radius 1", () => {
    const origin = cubeCoord(0, 0, 0);
    expect(ring(origin, 1)).toHaveLength(6);
  });

  it("returns 12 hexes at radius 2", () => {
    const origin = cubeCoord(0, 0, 0);
    expect(ring(origin, 2)).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/hex.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement hex.ts**

```typescript
// src/engine/hex.ts

export interface CubeCoord {
  readonly q: number;
  readonly r: number;
  readonly s: number;
}

export function cubeCoord(q: number, r: number, s: number): CubeCoord {
  if (q + r + s !== 0) {
    throw new Error(`Invalid cube coord: q=${q} r=${r} s=${s} (sum=${q + r + s})`);
  }
  return { q, r, s };
}

export function coordKey(c: CubeCoord): string {
  return `${c.q},${c.r},${c.s}`;
}

export function coordFromKey(key: string): CubeCoord {
  const [q, r, s] = key.split(",").map(Number);
  return cubeCoord(q, r, s);
}

// Directions: E, NE, NW, W, SW, SE
export const HEX_DIRECTIONS: readonly CubeCoord[] = [
  cubeCoord(1, 0, -1),   // 0: E
  cubeCoord(1, -1, 0),   // 1: NE
  cubeCoord(0, -1, 1),   // 2: NW
  cubeCoord(-1, 0, 1),   // 3: W
  cubeCoord(-1, 1, 0),   // 4: SW
  cubeCoord(0, 1, -1),   // 5: SE
];

export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

export function neighbor(coord: CubeCoord, direction: HexDirection): CubeCoord {
  const d = HEX_DIRECTIONS[direction];
  return cubeCoord(coord.q + d.q, coord.r + d.r, coord.s + d.s);
}

export function neighbors(coord: CubeCoord): CubeCoord[] {
  return [0, 1, 2, 3, 4, 5].map((d) => neighbor(coord, d as HexDirection));
}

export function hexDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s)
  );
}

export function ring(center: CubeCoord, radius: number): CubeCoord[] {
  if (radius === 0) return [center];
  const results: CubeCoord[] = [];
  let current = cubeCoord(
    center.q + HEX_DIRECTIONS[4].q * radius,
    center.r + HEX_DIRECTIONS[4].r * radius,
    center.s + HEX_DIRECTIONS[4].s * radius
  );
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(current);
      current = neighbor(current, i as HexDirection);
    }
  }
  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/hex.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/hex.ts tests/engine/hex.test.ts
git commit -m "feat: hex coordinate math with cube coords"
```

---

## Task 3: Game State Types & Constants

**Files:**
- Create: `src/engine/state.ts`

- [ ] **Step 1: Write state.ts with all types, constants, and factory**

```typescript
// src/engine/state.ts
import type { CubeCoord, HexDirection } from "./hex";
import { cubeCoord, coordKey } from "./hex";

// --- Biome ---
export type Biome = "forest" | "mountain" | "ruins" | "settlement" | "wastes";

// --- Resources ---
export interface ResourceDelta {
  supply?: number;
  hope?: number;
  health?: number;
}

// --- Encounter ---
export interface Choice {
  label: string;
  outcome: ResourceDelta;
  chance?: number; // 0-1, default 1.0
  failureOutcome?: ResourceDelta;
}

export interface Encounter {
  id: string;
  text: string;
  requiredTags: string[];
  biomes?: Biome[];
  choices: Choice[];
}

// --- Hex ---
export interface HexTile {
  coord: CubeCoord;
  biome: Biome;
  tags: Set<string>;
  encounter: Encounter | null;
  revealed: boolean;
  consumed: boolean;
}

// --- Log ---
export interface LogEntry {
  turn: number;
  text: string;
}

// --- Searing ---
export type HexAxis = "q" | "r" | "s";

export interface SearingState {
  axis: HexAxis;
  direction: 1 | -1;
  line: number;
  advanceRate: number;
}

// --- Game Mode ---
export type GameMode =
  | { type: "map" }
  | { type: "encounter"; encounter: Encounter; hex: CubeCoord }
  | { type: "camp"; result: LogEntry; incident: LogEntry | null }
  | { type: "gameover"; reason: string };

// --- Actions ---
export type Action =
  | { type: "push"; direction: HexDirection }
  | { type: "pause"; activity: "rest" | "forage" }
  | { type: "choose"; choiceIndex: number }
  | { type: "dismiss" }; // dismiss camp/encounter result, return to map

// --- Player ---
export interface Player {
  hex: CubeCoord;
  supply: number;
  hope: number;
  health: number;
}

// --- Game State ---
export interface GameState {
  player: Player;
  map: Map<string, HexTile>;
  searing: SearingState;
  turn: number;
  mode: GameMode;
  log: LogEntry[];
  status: "playing" | "won" | "lost";
  encounters: Encounter[]; // loaded from API at startup
}

// --- Constants ---
export const STARTING_SUPPLY = 6;
export const MAX_SUPPLY = 10;
export const STARTING_HOPE = 5;
export const MAX_HOPE = 5;
export const STARTING_HEALTH = 3;
export const MAX_HEALTH = 5;
export const SEARING_ADVANCE_RATE = 4;
export const HOPE_DECAY_INTERVAL = 6;

// --- RNG ---
export type RNG = () => number; // returns [0, 1)

// --- Factory ---
export function createInitialState(encounters: Encounter[], rng: RNG): GameState {
  const startCoord = cubeCoord(0, 0, 0);
  const startHex: HexTile = {
    coord: startCoord,
    biome: "settlement",
    tags: new Set(["inhabited", "sheltered"]),
    encounter: null,
    revealed: true,
    consumed: false,
  };

  const map = new Map<string, HexTile>();
  map.set(coordKey(startCoord), startHex);

  // Random searing axis and direction
  const axes: HexAxis[] = ["q", "r", "s"];
  const axis = axes[Math.floor(rng() * 3)];
  const direction: 1 | -1 = rng() < 0.5 ? 1 : -1;

  return {
    player: {
      hex: startCoord,
      supply: STARTING_SUPPLY,
      hope: STARTING_HOPE,
      health: STARTING_HEALTH,
    },
    map,
    searing: {
      axis,
      direction,
      line: direction === 1 ? -10 : 10, // start far away
      advanceRate: SEARING_ADVANCE_RATE,
    },
    turn: 0,
    mode: { type: "map" },
    log: [{ turn: 0, text: "You stand at the edge of a small settlement. The Searing glows on the horizon." }],
    status: "playing",
    encounters,
  };
}

// --- Serialization ---
export interface SerializedGameState {
  player: Player;
  map: Record<string, { coord: CubeCoord; biome: Biome; tags: string[]; encounter: Encounter | null; revealed: boolean; consumed: boolean }>;
  searing: SearingState;
  turn: number;
  mode: GameMode;
  log: LogEntry[];
  status: "playing" | "won" | "lost";
  encounters: Encounter[];
}

export function serializeState(state: GameState): SerializedGameState {
  const map: SerializedGameState["map"] = {};
  for (const [key, tile] of state.map) {
    map[key] = { ...tile, tags: [...tile.tags] };
  }
  return { ...state, map };
}

export function deserializeState(data: SerializedGameState): GameState {
  const map = new Map<string, HexTile>();
  for (const [key, tile] of Object.entries(data.map)) {
    map.set(key, { ...tile, tags: new Set(tile.tags) });
  }
  return { ...data, map };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/state.ts
git commit -m "feat: game state types, constants, and factory"
```

---

## Task 4: Resource System

**Files:**
- Create: `src/engine/resources.ts`, `tests/engine/resources.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/resources.test.ts
import { describe, it, expect } from "vitest";
import {
  applyDelta,
  checkLoss,
  forageResult,
} from "../../src/engine/resources";
import type { Player } from "../../src/engine/state";
import { STARTING_SUPPLY, STARTING_HOPE, STARTING_HEALTH, MAX_SUPPLY, MAX_HOPE, MAX_HEALTH } from "../../src/engine/state";

const makePlayer = (overrides?: Partial<Player>): Player => ({
  hex: { q: 0, r: 0, s: 0 },
  supply: STARTING_SUPPLY,
  hope: STARTING_HOPE,
  health: STARTING_HEALTH,
  ...overrides,
});

describe("applyDelta", () => {
  it("adds resources", () => {
    const p = applyDelta(makePlayer(), { supply: 2, hope: 1 });
    expect(p.supply).toBe(8);
    expect(p.hope).toBe(5); // capped at max
  });

  it("subtracts resources", () => {
    const p = applyDelta(makePlayer(), { supply: -2 });
    expect(p.supply).toBe(4);
  });

  it("clamps at zero", () => {
    const p = applyDelta(makePlayer({ supply: 1 }), { supply: -5 });
    expect(p.supply).toBe(0);
  });

  it("clamps at max", () => {
    const p = applyDelta(makePlayer(), { supply: 100 });
    expect(p.supply).toBe(MAX_SUPPLY);
  });
});

describe("checkLoss", () => {
  it("returns null when alive", () => {
    expect(checkLoss(makePlayer())).toBeNull();
  });

  it("returns reason when health is 0", () => {
    expect(checkLoss(makePlayer({ health: 0 }))).toBe("Your body gives out. The Twilight Strip claims another.");
  });

  it("returns reason when hope is 0", () => {
    expect(checkLoss(makePlayer({ hope: 0 }))).toBe("The light inside you fades. You surrender to the heat.");
  });
});

describe("forageResult", () => {
  it("returns supply on success", () => {
    const result = forageResult("forest", new Set(["wood"]), () => 0.1); // low roll = success
    expect(result.success).toBe(true);
    expect(result.delta.supply).toBe(2);
  });

  it("returns nothing on failure", () => {
    const result = forageResult("forest", new Set(["wood"]), () => 0.99); // high roll = fail
    expect(result.success).toBe(false);
    expect(result.delta.supply).toBeUndefined();
  });

  it("water tag adds 10% success chance", () => {
    // Forest base = 70%. With water = 80%. Roll 0.75 should succeed.
    const result = forageResult("forest", new Set(["water"]), () => 0.75);
    expect(result.success).toBe(true);
  });

  it("abandoned tag adds +1 yield", () => {
    const result = forageResult("ruins", new Set(["abandoned", "ancient"]), () => 0.1);
    expect(result.delta.supply).toBe(3); // ruins base 2 + abandoned 1
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/resources.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement resources.ts**

```typescript
// src/engine/resources.ts
import type { Player, ResourceDelta, Biome, RNG } from "./state";
import { MAX_SUPPLY, MAX_HOPE, MAX_HEALTH } from "./state";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyDelta(player: Player, delta: ResourceDelta): Player {
  return {
    ...player,
    supply: clamp(player.supply + (delta.supply ?? 0), 0, MAX_SUPPLY),
    hope: clamp(player.hope + (delta.hope ?? 0), 0, MAX_HOPE),
    health: clamp(player.health + (delta.health ?? 0), 0, MAX_HEALTH),
  };
}

export function checkLoss(player: Player): string | null {
  if (player.health <= 0) return "Your body gives out. The Twilight Strip claims another.";
  if (player.hope <= 0) return "The light inside you fades. You surrender to the heat.";
  return null;
}

const FORAGE_TABLE: Record<Biome, { chance: number; yield: number }> = {
  forest: { chance: 0.7, yield: 2 },
  mountain: { chance: 0.3, yield: 1 },
  ruins: { chance: 0.5, yield: 2 },
  settlement: { chance: 0.8, yield: 3 },
  wastes: { chance: 0.2, yield: 1 },
};

export interface ForageResult {
  success: boolean;
  delta: ResourceDelta;
  text: string;
}

export function forageResult(biome: Biome, tags: Set<string>, rng: RNG): ForageResult {
  const base = FORAGE_TABLE[biome];
  let chance = base.chance;
  let yieldAmount = base.yield;

  if (tags.has("water")) chance += 0.1;
  if (tags.has("overgrown")) chance += 0.1;
  if (tags.has("abandoned")) yieldAmount += 1;

  chance = Math.min(chance, 1.0);

  if (rng() < chance) {
    return {
      success: true,
      delta: { supply: yieldAmount },
      text: `You forage successfully and find ${yieldAmount} supply.`,
    };
  }
  return {
    success: false,
    delta: {},
    text: "You search but find nothing useful.",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/resources.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/resources.ts tests/engine/resources.test.ts
git commit -m "feat: resource system with forage mechanics"
```

---

## Task 5: Biome Data & Map Generation

**Files:**
- Create: `src/engine/data/biomes.ts`, `src/engine/map.ts`, `tests/engine/map.test.ts`

- [ ] **Step 1: Create biome data**

```typescript
// src/engine/data/biomes.ts
import type { Biome } from "../state";

export interface BiomeConfig {
  weight: number;
  primaryTags: string[];
  secondaryTags: string[];
}

export const BIOME_CONFIGS: Record<Biome, BiomeConfig> = {
  forest:     { weight: 35, primaryTags: ["wood", "water", "overgrown"],       secondaryTags: ["sheltered", "sacred", "ancient"] },
  mountain:   { weight: 20, primaryTags: ["stone", "elevated", "ice"],         secondaryTags: ["hollow", "ancient", "scarred"] },
  ruins:      { weight: 15, primaryTags: ["stone", "ancient", "abandoned"],    secondaryTags: ["sacred", "scarred", "hollow"] },
  settlement: { weight: 10, primaryTags: ["wood", "inhabited", "sheltered"],   secondaryTags: ["water", "stone", "sacred"] },
  wastes:     { weight: 20, primaryTags: ["sand", "scarred", "flooded"],       secondaryTags: ["ice", "abandoned", "hollow"] },
};

export const ALL_BIOMES: Biome[] = ["forest", "mountain", "ruins", "settlement", "wastes"];

export const NEIGHBOR_BIOME_BONUS = 15;
export const PRIMARY_TAG_WEIGHT = 0.7;
```

- [ ] **Step 2: Write failing tests for map generation**

```typescript
// tests/engine/map.test.ts
import { describe, it, expect } from "vitest";
import { rollBiome, rollTags, generateHex } from "../../src/engine/map";
import { cubeCoord, coordKey } from "../../src/engine/hex";
import type { HexTile, Encounter } from "../../src/engine/state";

// Deterministic RNG for testing
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("rollBiome", () => {
  it("returns a valid biome", () => {
    const rng = seededRng(42);
    const biome = rollBiome([], rng);
    expect(["forest", "mountain", "ruins", "settlement", "wastes"]).toContain(biome);
  });

  it("neighbor influence increases biome probability", () => {
    // With 3 forest neighbors, forest should appear more often
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const rng = seededRng(i);
      const biome = rollBiome(["forest", "forest", "forest"], rng);
      counts[biome] = (counts[biome] ?? 0) + 1;
    }
    // Forest should dominate
    expect(counts["forest"]).toBeGreaterThan(400);
  });
});

describe("rollTags", () => {
  it("returns 2-3 tags", () => {
    const rng = seededRng(42);
    const tags = rollTags("forest", [], rng);
    expect(tags.size).toBeGreaterThanOrEqual(2);
    expect(tags.size).toBeLessThanOrEqual(3);
  });

  it("can inherit tags from neighbors", () => {
    const neighborTags = [new Set(["water", "ancient"]), new Set(["water", "sacred"])];
    // Over many runs, "water" should appear more often with these neighbors
    let waterCount = 0;
    for (let i = 0; i < 100; i++) {
      const tags = rollTags("forest", neighborTags, seededRng(i));
      if (tags.has("water")) waterCount++;
    }
    expect(waterCount).toBeGreaterThan(30);
  });
});

describe("generateHex", () => {
  it("creates a hex tile with biome and tags", () => {
    const coord = cubeCoord(1, 0, -1);
    const rng = seededRng(42);
    const encounters: Encounter[] = [];
    const tile = generateHex(coord, new Map(), encounters, rng);
    expect(tile.coord).toEqual(coord);
    expect(tile.biome).toBeTruthy();
    expect(tile.tags.size).toBeGreaterThanOrEqual(2);
    expect(tile.revealed).toBe(true);
    expect(tile.consumed).toBe(false);
  });

  it("assigns matching encounter when available", () => {
    const coord = cubeCoord(1, 0, -1);
    const encounter: Encounter = {
      id: "test",
      text: "Test encounter",
      requiredTags: [], // matches any hex
      choices: [{ label: "OK", outcome: {} }],
    };
    // Run until we get a hex (should always match since requiredTags is empty)
    const rng = seededRng(42);
    const tile = generateHex(coord, new Map(), [encounter], rng);
    expect(tile.encounter).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/map.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement map.ts**

```typescript
// src/engine/map.ts
import type { CubeCoord } from "./hex";
import { neighbors as getNeighbors, coordKey } from "./hex";
import type { Biome, HexTile, Encounter, RNG } from "./state";
import { BIOME_CONFIGS, ALL_BIOMES, NEIGHBOR_BIOME_BONUS, PRIMARY_TAG_WEIGHT } from "./data/biomes";

export function rollBiome(neighborBiomes: Biome[], rng: RNG): Biome {
  const weights: Record<string, number> = {};
  for (const biome of ALL_BIOMES) {
    weights[biome] = BIOME_CONFIGS[biome].weight;
  }
  for (const nb of neighborBiomes) {
    weights[nb] = (weights[nb] ?? 0) + NEIGHBOR_BIOME_BONUS;
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const biome of ALL_BIOMES) {
    roll -= weights[biome];
    if (roll <= 0) return biome;
  }
  return ALL_BIOMES[ALL_BIOMES.length - 1];
}

export function rollTags(biome: Biome, neighborTagSets: Set<string>[], rng: RNG): Set<string> {
  const config = BIOME_CONFIGS[biome];
  const tags = new Set<string>();

  // Inherit 0-2 tags from neighbors
  if (neighborTagSets.length > 0) {
    const allNeighborTags: string[] = [];
    for (const nts of neighborTagSets) {
      for (const t of nts) allNeighborTags.push(t);
    }
    const inheritCount = Math.floor(rng() * 3); // 0, 1, or 2
    for (let i = 0; i < inheritCount && allNeighborTags.length > 0; i++) {
      const idx = Math.floor(rng() * allNeighborTags.length);
      tags.add(allNeighborTags[idx]);
    }
  }

  // Roll 1-2 fresh tags from biome pool
  const freshCount = 1 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < freshCount; i++) {
    const usePrimary = rng() < PRIMARY_TAG_WEIGHT;
    const pool = usePrimary ? config.primaryTags : config.secondaryTags;
    const tag = pool[Math.floor(rng() * pool.length)];
    tags.add(tag);
  }

  // Ensure at least 2 tags
  while (tags.size < 2) {
    const pool = config.primaryTags;
    tags.add(pool[Math.floor(rng() * pool.length)]);
  }

  return tags;
}

function findMatchingEncounter(tags: Set<string>, biome: Biome, encounters: Encounter[], rng: RNG): Encounter | null {
  const matching = encounters.filter((enc) => {
    if (enc.biomes && enc.biomes.length > 0 && !enc.biomes.includes(biome)) return false;
    return enc.requiredTags.every((t) => tags.has(t));
  });
  if (matching.length === 0) return null;
  // ~50% chance of encounter per hex
  if (rng() > 0.5) return null;
  return matching[Math.floor(rng() * matching.length)];
}

export function generateHex(
  coord: CubeCoord,
  existingMap: Map<string, HexTile>,
  encounters: Encounter[],
  rng: RNG
): HexTile {
  // Gather neighbor info
  const nCoords = getNeighbors(coord);
  const neighborBiomes: Biome[] = [];
  const neighborTagSets: Set<string>[] = [];
  for (const nc of nCoords) {
    const tile = existingMap.get(coordKey(nc));
    if (tile) {
      neighborBiomes.push(tile.biome);
      neighborTagSets.push(tile.tags);
    }
  }

  const biome = rollBiome(neighborBiomes, rng);
  const tags = rollTags(biome, neighborTagSets, rng);
  const encounter = findMatchingEncounter(tags, biome, encounters, rng);

  return {
    coord,
    biome,
    tags,
    encounter,
    revealed: true,
    consumed: false,
  };
}

export function getVisibleNeighbors(
  coord: CubeCoord,
  hope: number,
  searingAxis: string,
  searingDirection: 1 | -1
): CubeCoord[] {
  if (hope <= 0) return [];
  const allNeighbors = getNeighbors(coord);
  if (hope >= 3) return allNeighbors;

  // Hope 1-2: 3 neighbors away from the Searing
  return allNeighbors.filter((n) => {
    const axisValue = n[searingAxis as keyof CubeCoord] as number;
    const centerValue = coord[searingAxis as keyof CubeCoord] as number;
    // "Away from searing" means in the opposite direction
    return (axisValue - centerValue) * searingDirection <= 0;
  }).slice(0, 3);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/map.test.ts`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/data/biomes.ts src/engine/map.ts tests/engine/map.test.ts
git commit -m "feat: procedural map generation with biome weights and tag propagation"
```

---

## Task 6: Searing System

**Files:**
- Create: `src/engine/searing.ts`, `tests/engine/searing.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/searing.test.ts
import { describe, it, expect } from "vitest";
import { advanceSearing, isConsumed } from "../../src/engine/searing";
import { cubeCoord } from "../../src/engine/hex";
import type { SearingState } from "../../src/engine/state";

describe("advanceSearing", () => {
  it("advances the line by 1", () => {
    const searing: SearingState = { axis: "q", direction: 1, line: -5, advanceRate: 4 };
    const next = advanceSearing(searing);
    expect(next.line).toBe(-4);
  });

  it("respects direction", () => {
    const searing: SearingState = { axis: "r", direction: -1, line: 5, advanceRate: 4 };
    const next = advanceSearing(searing);
    expect(next.line).toBe(4);
  });
});

describe("isConsumed", () => {
  it("returns false for hex ahead of searing", () => {
    const searing: SearingState = { axis: "q", direction: 1, line: -3, advanceRate: 4 };
    expect(isConsumed(cubeCoord(0, 0, 0), searing)).toBe(false);
  });

  it("returns true for hex at searing line (direction 1)", () => {
    const searing: SearingState = { axis: "q", direction: 1, line: 2, advanceRate: 4 };
    // direction 1 means searing comes from negative side
    expect(isConsumed(cubeCoord(1, 0, -1), searing)).toBe(true);
  });

  it("returns true for hex behind searing (direction -1)", () => {
    const searing: SearingState = { axis: "q", direction: -1, line: 0, advanceRate: 4 };
    expect(isConsumed(cubeCoord(2, -1, -1), searing)).toBe(true);
  });

  it("returns false for hex ahead of searing (direction -1)", () => {
    const searing: SearingState = { axis: "q", direction: -1, line: 3, advanceRate: 4 };
    expect(isConsumed(cubeCoord(2, -1, -1), searing)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/searing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement searing.ts**

```typescript
// src/engine/searing.ts
import type { CubeCoord } from "./hex";
import type { SearingState } from "./state";

export function advanceSearing(searing: SearingState): SearingState {
  return {
    ...searing,
    line: searing.line + searing.direction,
  };
}

export function isConsumed(coord: CubeCoord, searing: SearingState): boolean {
  const value = coord[searing.axis];
  if (searing.direction === 1) {
    // Searing advances in +direction, consuming everything at line or below
    return value <= searing.line;
  } else {
    // Searing advances in -direction, consuming everything at line or above
    return value >= searing.line;
  }
}

export function shouldAdvance(turn: number, advanceRate: number): boolean {
  return turn > 0 && turn % advanceRate === 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/searing.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/searing.ts tests/engine/searing.test.ts
git commit -m "feat: searing advancement and hex consumption"
```

---

## Task 7: Encounter Matching & Resolution

**Files:**
- Create: `src/engine/encounters.ts`, `tests/engine/encounters.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/encounters.test.ts
import { describe, it, expect } from "vitest";
import { resolveChoice } from "../../src/engine/encounters";
import type { Choice } from "../../src/engine/state";

describe("resolveChoice", () => {
  it("applies outcome on deterministic choice", () => {
    const choice: Choice = { label: "Take", outcome: { supply: 2, hope: -1 } };
    const result = resolveChoice(choice, () => 0.5);
    expect(result.delta).toEqual({ supply: 2, hope: -1 });
    expect(result.succeeded).toBe(true);
  });

  it("applies outcome on successful chance roll", () => {
    const choice: Choice = {
      label: "Risk it",
      outcome: { supply: 3 },
      chance: 0.7,
      failureOutcome: { health: -1 },
    };
    const result = resolveChoice(choice, () => 0.5); // 0.5 < 0.7 = success
    expect(result.delta).toEqual({ supply: 3 });
    expect(result.succeeded).toBe(true);
  });

  it("applies failureOutcome on failed chance roll", () => {
    const choice: Choice = {
      label: "Risk it",
      outcome: { supply: 3 },
      chance: 0.7,
      failureOutcome: { health: -1 },
    };
    const result = resolveChoice(choice, () => 0.8); // 0.8 >= 0.7 = fail
    expect(result.delta).toEqual({ health: -1 });
    expect(result.succeeded).toBe(false);
  });

  it("applies empty delta on failed chance with no failureOutcome", () => {
    const choice: Choice = {
      label: "Risk it",
      outcome: { supply: 3 },
      chance: 0.3,
    };
    const result = resolveChoice(choice, () => 0.5); // 0.5 >= 0.3 = fail
    expect(result.delta).toEqual({});
    expect(result.succeeded).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/encounters.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement encounters.ts**

```typescript
// src/engine/encounters.ts
import type { Choice, ResourceDelta, RNG } from "./state";

export interface ChoiceResult {
  delta: ResourceDelta;
  succeeded: boolean;
}

export function resolveChoice(choice: Choice, rng: RNG): ChoiceResult {
  const chance = choice.chance ?? 1.0;
  if (rng() < chance) {
    return { delta: choice.outcome, succeeded: true };
  }
  return { delta: choice.failureOutcome ?? {}, succeeded: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/encounters.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/encounters.ts tests/engine/encounters.test.ts
git commit -m "feat: encounter choice resolution with chance mechanics"
```

---

## Task 8: Night Incidents

**Files:**
- Create: `src/engine/data/incidents.ts`, `tests/engine/incidents.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/incidents.test.ts
import { describe, it, expect } from "vitest";
import { rollNightIncident } from "../../src/engine/data/incidents";

describe("rollNightIncident", () => {
  it("returns null for quiet night (60% chance)", () => {
    // rng returns 0.3 -> 0.3 < 0.6 -> quiet night
    const result = rollNightIncident(() => 0.3);
    expect(result).toBeNull();
  });

  it("returns an incident when triggered", () => {
    // rng returns 0.7 first (triggers incident), then 0.1 (picks from table)
    let call = 0;
    const rng = () => {
      call++;
      return call === 1 ? 0.7 : 0.1;
    };
    const result = rollNightIncident(rng);
    expect(result).not.toBeNull();
    expect(result!.text).toBeTruthy();
    expect(result!.delta).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/incidents.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement incidents.ts**

```typescript
// src/engine/data/incidents.ts
import type { ResourceDelta, RNG } from "../state";

interface NightIncident {
  id: string;
  text: string;
  delta: ResourceDelta;
  weight: number;
}

const INCIDENTS: NightIncident[] = [
  { id: "night-theft",  text: "Something crept into your camp. Supplies are missing.",                    delta: { supply: -1 }, weight: 25 },
  { id: "night-noise",  text: "Strange sounds in the dark. You barely sleep.",                            delta: { hope: -1 },  weight: 25 },
  { id: "night-stars",  text: "The sky clears for a moment. You remember why you keep going.",            delta: { hope: 1 },   weight: 20 },
  { id: "night-find",   text: "While settling in, you notice something half-buried nearby.",              delta: { supply: 1 }, weight: 15 },
  { id: "night-wound",  text: "You wake to a scratch you don't remember getting.",                        delta: { health: -1 }, weight: 10 },
  { id: "night-dream",  text: "A vivid dream of the world before the sun stalled. It felt real.",         delta: { hope: 2 },   weight: 5 },
];

const QUIET_NIGHT_CHANCE = 0.6;

export interface IncidentResult {
  id: string;
  text: string;
  delta: ResourceDelta;
}

export function rollNightIncident(rng: RNG): IncidentResult | null {
  if (rng() < QUIET_NIGHT_CHANCE) return null;

  const totalWeight = INCIDENTS.reduce((sum, inc) => sum + inc.weight, 0);
  let roll = rng() * totalWeight;
  for (const inc of INCIDENTS) {
    roll -= inc.weight;
    if (roll <= 0) {
      return { id: inc.id, text: inc.text, delta: inc.delta };
    }
  }
  const last = INCIDENTS[INCIDENTS.length - 1];
  return { id: last.id, text: last.text, delta: last.delta };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/incidents.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/data/incidents.ts tests/engine/incidents.test.ts
git commit -m "feat: night incident system with weighted random table"
```

---

## Task 9: Turn Engine

**Files:**
- Create: `src/engine/turn.ts`, `tests/engine/turn.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/turn.test.ts
import { describe, it, expect } from "vitest";
import { resolveTurn } from "../../src/engine/turn";
import { createInitialState } from "../../src/engine/state";
import type { Action, Encounter } from "../../src/engine/state";
import { coordKey, cubeCoord } from "../../src/engine/hex";

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeState(seed = 42) {
  const rng = seededRng(seed);
  return { state: createInitialState([], rng), rng: seededRng(seed + 1) };
}

describe("resolveTurn - push", () => {
  it("moves the player and spends 1 supply", () => {
    const { state, rng } = makeState();
    const action: Action = { type: "push", direction: 0 }; // east
    const next = resolveTurn(state, action, rng);
    expect(next.player.supply).toBe(state.player.supply - 1);
    expect(coordKey(next.player.hex)).not.toBe(coordKey(state.player.hex));
  });

  it("generates the new hex on the map", () => {
    const { state, rng } = makeState();
    const action: Action = { type: "push", direction: 0 };
    const next = resolveTurn(state, action, rng);
    expect(next.map.has(coordKey(next.player.hex))).toBe(true);
  });

  it("rejects push with 0 supply", () => {
    const { state, rng } = makeState();
    state.player = { ...state.player, supply: 0 };
    const action: Action = { type: "push", direction: 0 };
    const next = resolveTurn(state, action, rng);
    // Should not move
    expect(coordKey(next.player.hex)).toBe(coordKey(state.player.hex));
    expect(next.log.length).toBeGreaterThan(state.log.length);
  });

  it("increments turn counter", () => {
    const { state, rng } = makeState();
    const action: Action = { type: "push", direction: 0 };
    const next = resolveTurn(state, action, rng);
    expect(next.turn).toBe(state.turn + 1);
  });
});

describe("resolveTurn - pause", () => {
  it("rest transitions to camp mode", () => {
    const { state, rng } = makeState();
    state.player = { ...state.player, health: 2 };
    const action: Action = { type: "pause", activity: "rest" };
    const next = resolveTurn(state, action, rng);
    expect(next.mode.type).toBe("camp");
  });

  it("forage transitions to camp mode", () => {
    const { state, rng } = makeState();
    const action: Action = { type: "pause", activity: "forage" };
    const next = resolveTurn(state, action, rng);
    expect(next.mode.type).toBe("camp");
  });
});

describe("resolveTurn - encounter flow", () => {
  it("transitions to encounter mode when hex has encounter", () => {
    const encounter: Encounter = {
      id: "test",
      text: "Test",
      requiredTags: [],
      choices: [{ label: "OK", outcome: { hope: 1 } }],
    };
    const { state, rng } = makeState();
    // Plant an encounter on the target hex
    const targetCoord = cubeCoord(1, 0, -1);
    state.map.set(coordKey(targetCoord), {
      coord: targetCoord,
      biome: "forest",
      tags: new Set(["wood", "water"]),
      encounter,
      revealed: true,
      consumed: false,
    });
    const action: Action = { type: "push", direction: 0 };
    const next = resolveTurn(state, action, rng);
    expect(next.mode.type).toBe("encounter");
  });

  it("resolves choice and returns to map", () => {
    const encounter: Encounter = {
      id: "test",
      text: "Test",
      requiredTags: [],
      choices: [{ label: "OK", outcome: { hope: 1 } }],
    };
    const { state, rng } = makeState();
    // Set up encounter mode
    const s = {
      ...state,
      mode: { type: "encounter" as const, encounter, hex: cubeCoord(1, 0, -1) },
    };
    const action: Action = { type: "choose", choiceIndex: 0 };
    const next = resolveTurn(s, action, rng);
    expect(next.mode.type).toBe("map");
  });
});

describe("resolveTurn - searing", () => {
  it("advances searing on correct turn", () => {
    const { state, rng } = makeState();
    // Set turn to just before searing advance
    const s = { ...state, turn: 3 };
    const action: Action = { type: "push", direction: 0 };
    const next = resolveTurn(s, action, rng);
    // Turn becomes 4, searing should advance
    expect(next.searing.line).not.toBe(s.searing.line);
  });
});

describe("resolveTurn - loss conditions", () => {
  it("triggers game over when health reaches 0", () => {
    const { state, rng } = makeState();
    state.player = { ...state.player, health: 0 };
    const action: Action = { type: "push", direction: 0 };
    const next = resolveTurn(state, action, rng);
    expect(next.status).toBe("lost");
    expect(next.mode.type).toBe("gameover");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/turn.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement turn.ts**

```typescript
// src/engine/turn.ts
import type { GameState, Action, LogEntry, RNG } from "./state";
import { HOPE_DECAY_INTERVAL } from "./state";
import { neighbor, coordKey } from "./hex";
import { applyDelta, checkLoss, forageResult } from "./resources";
import { generateHex } from "./map";
import { advanceSearing, isConsumed, shouldAdvance } from "./searing";
import { resolveChoice } from "./encounters";
import { rollNightIncident } from "./data/incidents";

function addLog(state: GameState, text: string): GameState {
  return { ...state, log: [...state.log, { turn: state.turn, text }] };
}

function handlePush(state: GameState, action: Extract<Action, { type: "push" }>, rng: RNG): GameState {
  if (state.player.supply <= 0) {
    return addLog(state, "You have no supplies. You must forage or rest.");
  }

  const targetCoord = neighbor(state.player.hex, action.direction);
  let s = { ...state };

  // Spend supply
  s = { ...s, player: applyDelta(s.player, { supply: -1 }) };

  // Generate hex if not already on map
  const newMap = new Map(s.map);
  if (!newMap.has(coordKey(targetCoord))) {
    const tile = generateHex(targetCoord, newMap, s.encounters, rng);
    newMap.set(coordKey(targetCoord), tile);
  }
  s = { ...s, map: newMap };

  // Move player
  s = { ...s, player: { ...s.player, hex: targetCoord } };

  // Check for encounter
  const tile = newMap.get(coordKey(targetCoord))!;
  if (tile.encounter) {
    s = addLog(s, tile.encounter.text);
    s = { ...s, mode: { type: "encounter", encounter: tile.encounter, hex: targetCoord } };
    // Clear encounter from tile so it doesn't trigger again
    const clearedTile = { ...tile, encounter: null };
    const mapCopy = new Map(s.map);
    mapCopy.set(coordKey(targetCoord), clearedTile);
    s = { ...s, map: mapCopy };
  }

  return s;
}

function handlePause(state: GameState, action: Extract<Action, { type: "pause" }>, rng: RNG): GameState {
  let s = { ...state };
  const tile = s.map.get(coordKey(s.player.hex))!;
  let resultText: string;

  if (action.activity === "rest") {
    s = { ...s, player: applyDelta(s.player, { health: 1 }) };
    resultText = "You rest and recover some strength. (+1 Health)";
  } else {
    const result = forageResult(tile.biome, tile.tags, rng);
    if (result.success) {
      s = { ...s, player: applyDelta(s.player, result.delta) };
    }
    resultText = result.text;
  }

  // Night incident
  const incident = rollNightIncident(rng);
  let incidentLog: LogEntry | null = null;
  if (incident) {
    s = { ...s, player: applyDelta(s.player, incident.delta) };
    incidentLog = { turn: s.turn, text: incident.text };
  }

  s = addLog(s, resultText);
  if (incidentLog) s = addLog(s, incidentLog.text);

  s = { ...s, mode: { type: "camp", result: { turn: s.turn, text: resultText }, incident: incidentLog } };
  return s;
}

function handleChoose(state: GameState, action: Extract<Action, { type: "choose" }>, rng: RNG): GameState {
  if (state.mode.type !== "encounter") return state;

  const encounter = state.mode.encounter;
  const choice = encounter.choices[action.choiceIndex];
  if (!choice) return state;

  const result = resolveChoice(choice, rng);
  let s = { ...state, player: applyDelta(state.player, result.delta) };

  const outcomeText = result.succeeded
    ? `You chose: ${choice.label}. Success.`
    : `You chose: ${choice.label}. It didn't go well.`;
  s = addLog(s, outcomeText);
  s = { ...s, mode: { type: "map" } };

  // Apply end-of-turn effects that were deferred when encounter started
  return applyEndOfTurnEffects(s, rng);
}

function handleDismiss(state: GameState, rng: RNG): GameState {
  const s = { ...state, mode: { type: "map" } as const };
  return applyEndOfTurnEffects(s, rng);
}

function applyEndOfTurnEffects(state: GameState, _rng: RNG): GameState {
  let s = { ...state };

  // Hope decay
  if (s.turn > 0 && s.turn % HOPE_DECAY_INTERVAL === 0) {
    s = { ...s, player: applyDelta(s.player, { hope: -1 }) };
    s = addLog(s, "The weight of the journey bears down on you. (-1 Hope)");
  }

  // Searing advance
  if (shouldAdvance(s.turn, s.searing.advanceRate)) {
    s = { ...s, searing: advanceSearing(s.searing) };
    s = addLog(s, "The Searing advances. The heat grows closer.");

    // Consume hexes
    const newMap = new Map(s.map);
    for (const [key, tile] of newMap) {
      if (!tile.consumed && isConsumed(tile.coord, s.searing)) {
        newMap.set(key, { ...tile, consumed: true });
      }
    }
    s = { ...s, map: newMap };

    // Check if player is consumed
    if (isConsumed(s.player.hex, s.searing)) {
      s = { ...s, status: "lost", mode: { type: "gameover", reason: "The Searing catches you. There is no escape from the light." } };
      return s;
    }
  }

  // Check loss conditions
  const lossReason = checkLoss(s.player);
  if (lossReason) {
    s = { ...s, status: "lost", mode: { type: "gameover", reason: lossReason } };
  }

  return s;
}

export function resolveTurn(state: GameState, action: Action, rng: RNG): GameState {
  if (state.status !== "playing") return state;

  // Handle dismiss — applies deferred end-of-turn effects
  if (action.type === "dismiss") return handleDismiss(state, rng);

  // Handle encounter choice (no turn increment)
  if (action.type === "choose") return handleChoose(state, action, rng);

  // Only push and pause increment the turn
  let s = { ...state, turn: state.turn + 1 };

  if (action.type === "push") {
    s = handlePush(s, action, rng);
  } else if (action.type === "pause") {
    s = handlePause(s, action, rng);
  }

  // If we're now in encounter or camp mode, defer end-of-turn effects.
  // They'll apply when the player resolves the encounter (choose action)
  // or dismisses the camp screen (dismiss action).
  if (s.mode.type === "encounter" || s.mode.type === "camp") return s;

  return applyEndOfTurnEffects(s, rng);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/turn.test.ts`
Expected: All PASS.

- [ ] **Step 5: Run all engine tests**

Run: `npx vitest run tests/engine/`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/turn.ts tests/engine/turn.test.ts
git commit -m "feat: turn engine reducer composing all game subsystems"
```

---

## Task 10: Seed Encounter Data

**Files:**
- Create: `src/engine/data/seed-encounters.json`

- [ ] **Step 1: Create seed encounters JSON**

Write `src/engine/data/seed-encounters.json` with all 18 encounters from the spec (4 forest, 3 mountain, 3 ruins, 3 settlement, 3 wastes, 2 universal). Each entry follows the `Encounter` interface shape with `id`, `text`, `requiredTags`, optional `biomes`, and `choices` array.

Reference the full encounter tables in the spec at lines 246-292.

- [ ] **Step 2: Verify it parses**

Create a quick test:
```typescript
// tests/engine/seed-data.test.ts
import { describe, it, expect } from "vitest";
import seedEncounters from "../../src/engine/data/seed-encounters.json";

describe("seed encounters", () => {
  it("has 18 encounters", () => {
    expect(seedEncounters).toHaveLength(18);
  });

  it("each has required fields", () => {
    for (const enc of seedEncounters) {
      expect(enc.id).toBeTruthy();
      expect(enc.text).toBeTruthy();
      expect(Array.isArray(enc.requiredTags)).toBe(true);
      expect(enc.choices.length).toBeGreaterThan(0);
    }
  });

  it("each choice has label and outcome", () => {
    for (const enc of seedEncounters) {
      for (const choice of enc.choices) {
        expect(choice.label).toBeTruthy();
        expect(choice.outcome).toBeDefined();
      }
    }
  });
});
```

Run: `npx vitest run tests/engine/seed-data.test.ts`
Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/engine/data/seed-encounters.json tests/engine/seed-data.test.ts
git commit -m "feat: seed encounter data (18 encounters)"
```

---

## Task 11: Turso DB & API Routes

**Files:**
- Create: `api/lib/db.ts`, `api/lib/auth.ts`, `api/encounters/index.ts`, `api/encounters/[id].ts`, `api/seed.ts`

- [ ] **Step 1: Create DB client helper**

```typescript
// api/lib/db.ts
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export async function ensureTable(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS encounters (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      required_tags TEXT NOT NULL,
      biomes TEXT,
      choices TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
```

- [ ] **Step 2: Create auth helper**

```typescript
// api/lib/auth.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    res.status(500).json({ error: "Server misconfigured: no API key set" });
    return false;
  }

  if (!apiKey || !constantTimeEqual(apiKey, expectedKey)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to burn same time, then return false
    require("crypto").timingSafeEqual(bufA, bufA);
    return false;
  }
  return require("crypto").timingSafeEqual(bufA, bufB);
}
```

- [ ] **Step 3: Create GET/POST encounters endpoint**

```typescript
// api/encounters/index.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureTable } from "../lib/db";
import { requireAuth } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDb();
  await ensureTable(db);

  if (req.method === "GET") {
    const result = await db.execute("SELECT * FROM encounters ORDER BY id");
    const encounters = result.rows.map((row) => ({
      id: row.id,
      text: row.text,
      requiredTags: JSON.parse(row.required_tags as string),
      biomes: row.biomes ? JSON.parse(row.biomes as string) : undefined,
      choices: JSON.parse(row.choices as string),
    }));
    return res.status(200).json(encounters);
  }

  if (req.method === "POST") {
    if (!requireAuth(req, res)) return;
    const { id, text, requiredTags, biomes, choices } = req.body;
    if (!id || !text || !requiredTags || !choices) {
      return res.status(400).json({ error: "Missing required fields: id, text, requiredTags, choices" });
    }
    await db.execute({
      sql: `INSERT INTO encounters (id, text, required_tags, biomes, choices) VALUES (?, ?, ?, ?, ?)`,
      args: [id, text, JSON.stringify(requiredTags), biomes ? JSON.stringify(biomes) : null, JSON.stringify(choices)],
    });
    return res.status(201).json({ id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 4: Create single encounter endpoint**

```typescript
// api/encounters/[id].ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureTable } from "../lib/db";
import { requireAuth } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDb();
  await ensureTable(db);
  const { id } = req.query;

  if (req.method === "GET") {
    const result = await db.execute({ sql: "SELECT * FROM encounters WHERE id = ?", args: [id as string] });
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const row = result.rows[0];
    return res.status(200).json({
      id: row.id,
      text: row.text,
      requiredTags: JSON.parse(row.required_tags as string),
      biomes: row.biomes ? JSON.parse(row.biomes as string) : undefined,
      choices: JSON.parse(row.choices as string),
    });
  }

  if (req.method === "PUT") {
    if (!requireAuth(req, res)) return;
    const { text, requiredTags, biomes, choices } = req.body;
    await db.execute({
      sql: `UPDATE encounters SET text = ?, required_tags = ?, biomes = ?, choices = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [text, JSON.stringify(requiredTags), biomes ? JSON.stringify(biomes) : null, JSON.stringify(choices), id as string],
    });
    return res.status(200).json({ id });
  }

  if (req.method === "DELETE") {
    if (!requireAuth(req, res)) return;
    await db.execute({ sql: "DELETE FROM encounters WHERE id = ?", args: [id as string] });
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 5: Create seed endpoint**

```typescript
// api/seed.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureTable } from "./lib/db";
import { requireAuth } from "./lib/auth";
import seedEncounters from "../src/engine/data/seed-encounters.json";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAuth(req, res)) return;

  const db = getDb();
  await ensureTable(db);

  let inserted = 0;
  for (const enc of seedEncounters) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO encounters (id, text, required_tags, biomes, choices) VALUES (?, ?, ?, ?, ?)`,
        args: [
          enc.id,
          enc.text,
          JSON.stringify(enc.requiredTags),
          enc.biomes ? JSON.stringify(enc.biomes) : null,
          JSON.stringify(enc.choices),
        ],
      });
      inserted++;
    } catch {
      // Skip duplicates
    }
  }

  return res.status(200).json({ inserted, total: seedEncounters.length });
}
```

- [ ] **Step 6: Install @vercel/node types**

```bash
npm install -D @vercel/node
```

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add api/
git commit -m "feat: Turso DB client, API routes for encounter CRUD"
```

---

## Task 12: Client-Side Encounter Fetching

**Files:**
- Create: `src/api/encounters.ts`

- [ ] **Step 1: Implement client-side fetch with fallback**

```typescript
// src/api/encounters.ts
import type { Encounter } from "../engine/state";
import seedEncounters from "../engine/data/seed-encounters.json";

let cachedEncounters: Encounter[] | null = null;

export async function fetchEncounters(): Promise<Encounter[]> {
  if (cachedEncounters) return cachedEncounters;

  try {
    const res = await fetch("/api/encounters");
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    cachedEncounters = data as Encounter[];
    return cachedEncounters;
  } catch (err) {
    console.warn("Failed to fetch encounters from API, using seed data:", err);
    cachedEncounters = seedEncounters as Encounter[];
    return cachedEncounters;
  }
}

export function clearEncounterCache(): void {
  cachedEncounters = null;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/encounters.ts
git commit -m "feat: client-side encounter fetch with seed fallback"
```

---

## Task 13: Canvas Renderer — Hex Grid & Glyphs

**Files:**
- Create: `src/renderer/glyphs.ts`, `src/renderer/canvas.ts`, `src/renderer/camera.ts`

- [ ] **Step 1: Create glyph definitions and color palette**

```typescript
// src/renderer/glyphs.ts
import type { Biome } from "../engine/state";

export const COLORS = {
  bg: "#0a0a0a",
  text: "#c0c0c0",
  textDim: "#606060",
  hexBorder: "#333333",
  player: "#ffcc00",
  encounter: "#ff6644",
  searing: "#ff2200",
  searingGlow: "#ff4400",
  consumed: "#1a0000",
  fog: "#1a1a1a",
  biome: {
    forest: "#2d5a27",
    mountain: "#7a7a7a",
    ruins: "#8a6642",
    settlement: "#c4a35a",
    wastes: "#5a3a2a",
  } as Record<Biome, string>,
};

export const BIOME_GLYPHS: Record<Biome, string> = {
  forest: "\u2660",     // ♠
  mountain: "\u25B2",   // ▲
  ruins: "\u03A9",      // Ω
  settlement: "\u2302", // ⌂
  wastes: "~",
};

export const TAG_GLYPHS: Record<string, string> = {
  water: "\u2248",      // ≈
  stone: "\u25CB",      // ○
  wood: "\u256B",       // ╫
  elevated: "\u25B5",   // ▵
  sheltered: "\u2310",  // ⌐
  overgrown: "\u274B",  // ❋
  flooded: "\u25BF",    // ▿
  hollow: "\u25E0",     // ◠
  sacred: "\u2020",     // †
  ancient: "\u2234",    // ∴
  inhabited: "\u2617",  // ☗
  abandoned: "\u2205",  // ∅
  scarred: "\u2573",    // ╳
  sand: "\u2237",       // ∷
  ice: "\u2736",        // ✶
};
```

- [ ] **Step 2: Create canvas helpers and hex drawing**

```typescript
// src/renderer/canvas.ts
import type { CubeCoord } from "../engine/hex";

export const HEX_SIZE = 40; // pixels from center to vertex

// Cube to pixel (flat-top hexes)
export function hexToPixel(coord: CubeCoord): { x: number; y: number } {
  const x = HEX_SIZE * (3 / 2) * coord.q;
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

// Pixel to nearest cube coord
export function pixelToHex(px: number, py: number): CubeCoord {
  const q = (2 / 3 * px) / HEX_SIZE;
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / HEX_SIZE;
  const s = -q - r;
  // Round to nearest hex
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  else rs = -rq - rr;
  return { q: rq, r: rr, s: rs };
}

export function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d")!;
  const resize = () => {
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(devicePixelRatio, devicePixelRatio);
  };
  resize();
  window.addEventListener("resize", resize);
  return ctx;
}
```

- [ ] **Step 3: Create camera**

```typescript
// src/renderer/camera.ts
import type { CubeCoord } from "../engine/hex";
import { hexToPixel } from "./canvas";

export interface Camera {
  offsetX: number;
  offsetY: number;
}

export function createCamera(): Camera {
  return { offsetX: 0, offsetY: 0 };
}

export function centerOnHex(camera: Camera, coord: CubeCoord, canvasWidth: number, canvasHeight: number): Camera {
  const { x, y } = hexToPixel(coord);
  return {
    offsetX: canvasWidth / 2 - x,
    offsetY: canvasHeight / 2 - y,
  };
}

export function worldToScreen(camera: Camera, wx: number, wy: number): { x: number; y: number } {
  return { x: wx + camera.offsetX, y: wy + camera.offsetY };
}

export function screenToWorld(camera: Camera, sx: number, sy: number): { x: number; y: number } {
  return { x: sx - camera.offsetX, y: sy - camera.offsetY };
}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/glyphs.ts src/renderer/canvas.ts src/renderer/camera.ts
git commit -m "feat: canvas renderer primitives, hex drawing, camera, glyphs"
```

---

## Task 14: Render Views (Map, Encounter, Camp, Game Over)

**Files:**
- Create: `src/renderer/views/map.ts`, `src/renderer/views/encounter.ts`, `src/renderer/views/camp.ts`, `src/renderer/views/gameover.ts`, `src/renderer/hud.ts`, `src/renderer/renderer.ts`

- [ ] **Step 1: Create map view renderer**

Renders all revealed hexes with biome glyph centered, tag glyphs beneath, encounter `!` marker, player `@`, fog hexes dimmed, searing edge as `░▒▓█` gradient. Uses camera offset for scrolling. Reference spec lines 332-344 for glyph assignments.

- [ ] **Step 2: Create HUD renderer**

Renders resource bars as text art (`Supply: ████░░ 4/6`), turn counter, and searing proximity warning. Drawn at fixed screen position (top-left corner overlay).

- [ ] **Step 3: Create encounter view**

Full canvas takeover. Dark background with encounter text centered, hex biome and tag context shown, numbered choice buttons with resource delta preview. Choices with `chance < 1.0` show percentage.

- [ ] **Step 4: Create camp view**

Brief result display: activity outcome text, night incident text if any, "Press any key to continue" prompt at bottom.

- [ ] **Step 5: Create game over view**

Large centered text with death reason, "Press Enter for New Game" prompt.

- [ ] **Step 6: Create top-level renderer dispatcher**

```typescript
// src/renderer/renderer.ts
import type { GameState } from "../engine/state";
import type { Camera } from "./camera";
import { centerOnHex } from "./camera";
import { renderMap } from "./views/map";
import { renderEncounter } from "./views/encounter";
import { renderCamp } from "./views/camp";
import { renderGameOver } from "./views/gameover";
import { COLORS } from "./glyphs";

export function render(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): Camera {
  const w = ctx.canvas.width / devicePixelRatio;
  const h = ctx.canvas.height / devicePixelRatio;

  // Clear
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  // Update camera
  const cam = centerOnHex(camera, state.player.hex, w, h);

  switch (state.mode.type) {
    case "map":
      renderMap(ctx, state, cam, w, h);
      break;
    case "encounter":
      renderEncounter(ctx, state.mode, state.player, w, h);
      break;
    case "camp":
      renderCamp(ctx, state.mode, w, h);
      break;
    case "gameover":
      renderGameOver(ctx, state.mode.reason, w, h);
      break;
  }

  return cam;
}
```

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/
git commit -m "feat: render views for map, encounter, camp, and game over"
```

---

## Task 15: Input Handling & Event Log

**Files:**
- Create: `src/ui/input.ts`, `src/ui/log.ts`

- [ ] **Step 1: Create input handler**

```typescript
// src/ui/input.ts
import type { Action, GameMode } from "../engine/state";
import type { HexDirection } from "../engine/hex";

// QWEASD layout for flat-top hex grid:
//   Q W
//  A   E
//   S D
const KEY_TO_DIRECTION: Record<string, HexDirection> = {
  e: 0, // E
  w: 1, // NE
  q: 2, // NW
  a: 3, // W
  s: 4, // SW
  d: 5, // SE
};

export function keyToAction(key: string, mode: GameMode): Action | null {
  const k = key.toLowerCase();

  switch (mode.type) {
    case "map": {
      if (k in KEY_TO_DIRECTION) {
        return { type: "push", direction: KEY_TO_DIRECTION[k] };
      }
      if (k === "r") return { type: "pause", activity: "rest" };
      if (k === "f") return { type: "pause", activity: "forage" };
      return null;
    }
    case "encounter": {
      const idx = parseInt(k) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < mode.encounter.choices.length) {
        return { type: "choose", choiceIndex: idx };
      }
      return null;
    }
    case "camp":
      return { type: "dismiss" };
    case "gameover":
      return null; // handled by main.ts for new game
  }
}
```

- [ ] **Step 2: Create event log panel**

```typescript
// src/ui/log.ts
import type { LogEntry } from "../engine/state";

export function updateLog(panel: HTMLElement, entries: LogEntry[]): void {
  const existing = panel.children.length;
  for (let i = existing; i < entries.length; i++) {
    const entry = entries[i];
    const div = document.createElement("div");
    div.style.marginBottom = "4px";
    div.style.borderBottom = "1px solid #222";
    div.style.paddingBottom = "4px";
    const turnSpan = document.createElement("span");
    turnSpan.style.color = "#666";
    turnSpan.textContent = `[${entry.turn}] `;
    div.appendChild(turnSpan);
    div.appendChild(document.createTextNode(entry.text));
    panel.appendChild(div);
  }
  panel.scrollTop = panel.scrollHeight;
}

export function clearLog(panel: HTMLElement): void {
  while (panel.firstChild) {
    panel.removeChild(panel.firstChild);
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/input.ts src/ui/log.ts
git commit -m "feat: keyboard/click input mapping and event log panel"
```

---

## Task 16: Bootstrap — Wire Everything Together

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Implement main.ts game loop**

```typescript
// src/main.ts
import { createInitialState } from "./engine/state";
import type { GameState } from "./engine/state";
import { resolveTurn } from "./engine/turn";
import { fetchEncounters } from "./api/encounters";
import { setupCanvas } from "./renderer/canvas";
import { createCamera } from "./renderer/camera";
import { render } from "./renderer/renderer";
import { keyToAction } from "./ui/input";
import { updateLog, clearLog } from "./ui/log";

async function main() {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const logPanel = document.getElementById("log-panel") as HTMLElement;
  const ctx = setupCanvas(canvas);

  const encounters = await fetchEncounters();
  let rngSeed = Date.now();
  function rng() {
    rngSeed = (rngSeed * 16807) % 2147483647;
    return (rngSeed - 1) / 2147483646;
  }

  let state: GameState = createInitialState(encounters, rng);
  let camera = createCamera();

  function gameLoop() {
    camera = render(ctx, state, camera);
    updateLog(logPanel, state.log);
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener("keydown", (e) => {
    // New game on Enter at game over
    if (state.mode.type === "gameover" && e.key === "Enter") {
      rngSeed = Date.now();
      state = createInitialState(encounters, rng);
      clearLog(logPanel);
      return;
    }

    const action = keyToAction(e.key, state.mode);
    if (action) {
      state = resolveTurn(state, action, rng);
    }
  });

  requestAnimationFrame(gameLoop);
}

main();
```

- [ ] **Step 2: Verify dev server runs**

Run: `npx vite` (start dev server, verify no console errors, game renders)

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: bootstrap game loop wiring engine, renderer, and input"
```

---

## Task 17: Admin Panel

**Files:**
- Create: `src/ui/admin.ts`, `admin.html`
- Modify: `vite.config.ts`

- [ ] **Step 1: Create admin.html entry point**

Simple HTML page with auth gate (password input), then encounter list table and create/edit form. Clean system-ui styled, no terminal aesthetic.

- [ ] **Step 2: Implement admin.ts**

Handles: API key entry stored in `sessionStorage`, fetch and display encounter list, create/edit/delete forms with all encounter fields, JSON export/import buttons. All CRUD operations use `fetch()` to `/api/encounters` with `X-API-Key` header. Use safe DOM methods (createElement, textContent, appendChild) for all dynamic content — no innerHTML with untrusted data.

- [ ] **Step 3: Update vite.config.ts for multi-page**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: "index.html",
        admin: "admin.html",
      },
    },
  },
});
```

- [ ] **Step 4: Verify admin page loads**

Run: `npx vite`, navigate to `http://localhost:5173/admin.html`
Expected: Auth gate renders, form appears after entering key.

- [ ] **Step 5: Commit**

```bash
git add admin.html src/ui/admin.ts vite.config.ts
git commit -m "feat: admin panel for live encounter CRUD"
```

---

## Task 18: Integration & Smoke Test

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All PASS.

- [ ] **Step 2: Verify build succeeds**

Run: `npx vite build`
Expected: Clean build, dist/ created.

- [ ] **Step 3: Manual smoke test**

Start dev server, verify:
- Game renders hex grid with starting settlement
- Movement keys work, supply decreases
- Encounter triggers full-screen view, choices resolve
- Rest/forage shows camp view, resources change
- Searing advances and consumes hexes
- Game over triggers on resource depletion
- Event log updates with narrative text
- Admin panel loads at /admin.html

- [ ] **Step 4: Delete smoke test**

```bash
rm tests/smoke.test.ts
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: integration pass, remove smoke test"
```
