# M1: Minimum Viable UX + Save/Load — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current game playable by non-developers — readable HUD, intuitive controls, save/load so players can leave and come back.

**Architecture:** Pure additions and modifications to existing files. Save/load extends the existing `serializeState`/`deserializeState` in `state.ts` with LocalStorage persistence in `main.ts`. UX changes touch the renderer views and add new UI components. No new engine systems.

**Tech Stack:** TypeScript, Canvas 2D, LocalStorage, Vitest

**Design Spec:** `docs/2026-03-27-friends-family-demo-design.md` — Milestone 1 section

---

### Task 1: Verify and Harden State Serialization

`serializeState` and `deserializeState` already exist in `src/engine/state.ts`. This task ensures they round-trip correctly and handles edge cases.

**Files:**
- Modify: `src/engine/state.ts`
- Test: `tests/engine/state.test.ts` (create)

- [ ] **Step 1: Write round-trip serialization test**

```typescript
// tests/engine/state.test.ts
import { describe, expect, it } from "vitest";
import {
  createInitialState,
  serializeState,
  deserializeState,
  type Encounter,
  type GameState,
} from "../../src/engine/state";
import { coordKey } from "../../src/engine/hex";

function seededRng(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

describe("serializeState / deserializeState", () => {
  it("round-trips initial state without data loss", () => {
    const rng = seededRng(42);
    const encounters: Encounter[] = [];
    const state = createInitialState(encounters, rng);

    const serialized = serializeState(state);
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);
    const restored = deserializeState(parsed);

    expect(restored.player).toEqual(state.player);
    expect(restored.turn).toBe(state.turn);
    expect(restored.status).toBe(state.status);
    expect(restored.searing).toEqual(state.searing);
    expect(restored.mode).toEqual(state.mode);
    expect(restored.log).toEqual(state.log);

    // Map round-trip: same keys, same tile data
    expect(restored.map.size).toBe(state.map.size);
    for (const [key, tile] of state.map) {
      const restoredTile = restored.map.get(key);
      expect(restoredTile).toBeDefined();
      expect(restoredTile!.biome).toBe(tile.biome);
      expect([...restoredTile!.tags]).toEqual([...tile.tags]);
      expect(restoredTile!.revealed).toBe(tile.revealed);
      expect(restoredTile!.consumed).toBe(tile.consumed);
    }
  });

  it("round-trips state with encounters on tiles", () => {
    const rng = seededRng(42);
    const encounter: Encounter = {
      id: "test-enc",
      text: "A test",
      requiredTags: ["water"],
      choices: [{ label: "Drink", outcome: { hope: 1 } }],
    };
    const state = createInitialState([encounter], rng);

    const serialized = serializeState(state);
    const restored = deserializeState(JSON.parse(JSON.stringify(serialized)));

    for (const [key, tile] of state.map) {
      const restoredTile = restored.map.get(key);
      if (tile.encounter) {
        expect(restoredTile!.encounter).toEqual(tile.encounter);
      }
    }
  });

  it("round-trips encounter mode", () => {
    const rng = seededRng(42);
    const encounter: Encounter = {
      id: "test",
      text: "Test",
      requiredTags: [],
      choices: [{ label: "OK", outcome: {} }],
    };
    const state = createInitialState([], rng);
    const encounterState: GameState = {
      ...state,
      mode: { type: "encounter", encounter, hex: { q: 1, r: 0, s: -1 } },
    };

    const restored = deserializeState(
      JSON.parse(JSON.stringify(serializeState(encounterState)))
    );
    expect(restored.mode.type).toBe("encounter");
    if (restored.mode.type === "encounter") {
      expect(restored.mode.encounter.id).toBe("test");
      expect(restored.mode.hex).toEqual({ q: 1, r: 0, s: -1 });
    }
  });

  it("caps log entries to 50 on serialization", () => {
    const rng = seededRng(42);
    const state = createInitialState([], rng);
    const bigLogState: GameState = {
      ...state,
      log: Array.from({ length: 100 }, (_, i) => ({ turn: i, text: `Entry ${i}` })),
    };

    const serialized = serializeState(bigLogState);
    expect(serialized.log.length).toBeLessThanOrEqual(50);

    const restored = deserializeState(JSON.parse(JSON.stringify(serialized)));
    expect(restored.log.length).toBeLessThanOrEqual(50);
    expect(restored.log[restored.log.length - 1].text).toBe("Entry 99");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/state.test.ts`
Expected: Some tests may fail — particularly the log capping test since `serializeState` may not cap logs yet.

- [ ] **Step 3: Update serializeState to cap log entries**

In `src/engine/state.ts`, modify `serializeState` to cap `log` to the last 50 entries:

```typescript
// In serializeState, when building the serialized object:
log: state.log.slice(-50),
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run tests/engine/state.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add tests/engine/state.test.ts src/engine/state.ts
git commit -m "test: add serialization round-trip tests, cap log at 50 entries"
```

---

### Task 2: LocalStorage Save/Load

**Files:**
- Create: `src/engine/save.ts`
- Test: `tests/engine/save.test.ts`

- [ ] **Step 1: Write save/load tests**

```typescript
// tests/engine/save.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import { saveGame, loadGame, clearSave, hasSave, SAVE_KEY } from "../../src/engine/save";
import { createInitialState } from "../../src/engine/state";

function seededRng(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

vi.stubGlobal("localStorage", localStorageMock);

describe("save/load", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("reports no save when storage is empty", () => {
    expect(hasSave()).toBe(false);
  });

  it("saves and loads a game state", () => {
    const state = createInitialState([], seededRng(42));
    saveGame(state);
    expect(hasSave()).toBe(true);

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player).toEqual(state.player);
    expect(loaded!.turn).toBe(state.turn);
    expect(loaded!.searing).toEqual(state.searing);
  });

  it("clears saved game", () => {
    const state = createInitialState([], seededRng(42));
    saveGame(state);
    expect(hasSave()).toBe(true);

    clearSave();
    expect(hasSave()).toBe(false);
    expect(loadGame()).toBeNull();
  });

  it("returns null for corrupted save data", () => {
    storage.set(SAVE_KEY, "not valid json{{{");
    expect(loadGame()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/save.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement save.ts**

```typescript
// src/engine/save.ts
import { serializeState, deserializeState, type GameState } from "./state";

export const SAVE_KEY = "waning-light-save";

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame(state: GameState): void {
  const serialized = serializeState(state);
  localStorage.setItem(SAVE_KEY, JSON.stringify(serialized));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return deserializeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/save.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/engine/save.ts tests/engine/save.test.ts
git commit -m "feat: add LocalStorage save/load with corruption handling"
```

---

### Task 3: Integrate Save/Load into Game Loop

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add save-on-turn and continue/new-game prompt to main.ts**

Add imports at the top of `src/main.ts`:

```typescript
import { saveGame, loadGame, hasSave, clearSave } from "./engine/save";
```

After each `resolveTurn` call that produces a new state:
```typescript
// Auto-save after each turn
if (state.status === "playing") {
  saveGame(state);
} else {
  // Game ended (win or loss) — clear the save
  clearSave();
}
```

At game startup, before `createInitialState`, add the continue/new game prompt:

```typescript
let state: GameState;
if (hasSave()) {
  const saved = loadGame();
  if (saved && saved.status === "playing") {
    const shouldContinue = await showContinuePrompt(canvas, ctx);
    if (shouldContinue) {
      state = saved;
    } else {
      clearSave();
      state = createInitialState(encounters, rng);
    }
  } else {
    clearSave();
    state = createInitialState(encounters, rng);
  }
} else {
  state = createInitialState(encounters, rng);
}
```

- [ ] **Step 2: Implement the continue prompt as a simple canvas overlay**

Add to `src/main.ts` or create `src/ui/continue-prompt.ts`:

```typescript
function showContinuePrompt(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<boolean> {
  return new Promise((resolve) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#c0c0c0";
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Saved game found", canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "16px monospace";
    ctx.fillText("Press C to Continue  |  Press N for New Game", canvas.width / 2, canvas.height / 2 + 20);

    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c") {
        document.removeEventListener("keydown", handler);
        resolve(true);
      } else if (e.key.toLowerCase() === "n") {
        document.removeEventListener("keydown", handler);
        resolve(false);
      }
    };
    document.addEventListener("keydown", handler);
  });
}
```

- [ ] **Step 3: Manually test in browser**

Run: `npm run dev`
Expected: Play a few turns, refresh the page, see "Saved game found" prompt. Press C to continue (state restored), press N for new game (fresh start). Verify game over clears the save.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: integrate save/load with auto-save and continue prompt"
```

---

### Task 4: Simplify Hex Display — Remove Tag Glyphs

**Files:**
- Modify: `src/engine/state.ts` (add `visited` to HexTile)
- Modify: `src/engine/map.ts` (set `visited: false` on generated hexes)
- Modify: `src/engine/turn.ts` (set `visited: true` on player entry)
- Modify: `src/renderer/views/map.ts` (remove tag glyphs, add visited dimming)
- Modify: `tests/engine/map.test.ts`
- Modify: `tests/engine/turn.test.ts`

- [ ] **Step 1: Add `visited` field to HexTile in `src/engine/state.ts`**

```typescript
interface HexTile {
  coord: CubeCoord;
  biome: Biome;
  tags: Set<string>;
  encounter: Encounter | null;
  revealed: boolean;
  consumed: boolean;
  visited: boolean;  // NEW: true when player has entered this hex
}
```

Update `serializeState` and `deserializeState` to include `visited`.

- [ ] **Step 2: Set `visited: false` in `generateHex` in `src/engine/map.ts`**

```typescript
// In generateHex return object, add:
visited: false,
```

Also set `visited: true` on the starting settlement hex in `createInitialState`.

- [ ] **Step 3: Set `visited: true` on player entry in `handlePush` in `src/engine/turn.ts`**

After moving the player to a new hex:
```typescript
const destTile = newMap.get(coordKey(newPlayerHex))!;
newMap.set(coordKey(newPlayerHex), { ...destTile, visited: true });
```

- [ ] **Step 4: Write tests for visited tracking**

Add to `tests/engine/turn.test.ts`:
```typescript
it("marks the destination hex as visited after push", () => {
  const { state, rng } = makeState();
  const next = resolveTurn(state, { type: "push", direction: 0 }, rng);
  const destTile = next.map.get(coordKey(next.player.hex));
  expect(destTile!.visited).toBe(true);
});
```

Add to `tests/engine/map.test.ts`:
```typescript
it("generates hexes with visited set to false", () => {
  const tile = generateHex(cubeCoord(1, 0, -1), new Map(), [], seededRng(42));
  expect(tile.visited).toBe(false);
});
```

- [ ] **Step 5: Remove tag glyph rendering from `src/renderer/views/map.ts`**

Find the section that draws tag glyphs (small symbols beneath biome glyphs) and remove it. Also remove the `!` encounter marker.

- [ ] **Step 6: Add visited/unvisited visual distinction**

In the hex drawing code in `src/renderer/views/map.ts`:
```typescript
// When drawing a revealed tile:
ctx.globalAlpha = tile.visited ? 1.0 : 0.4;
// ... draw hex border and biome glyph ...
ctx.globalAlpha = 1.0;
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 8: Manually verify in browser**

Run: `npm run dev`
Expected: Hexes show only biome glyphs. Unvisited hexes are dimmer. Visited hexes are full brightness. No tag symbols or `!` markers.

- [ ] **Step 9: Commit**

```bash
git add src/engine/state.ts src/engine/turn.ts src/engine/map.ts src/renderer/views/map.ts tests/
git commit -m "feat: simplify hex display, add visited tracking, remove tag glyphs from map"
```

---

### Task 5: Persistent Key Legend

**Files:**
- Create: `src/renderer/legend.ts`
- Modify: `src/renderer/views/map.ts`
- Modify: `src/renderer/views/encounter.ts`
- Modify: `src/renderer/views/gameover.ts`

- [ ] **Step 1: Check actual key-to-direction mapping in `src/ui/input.ts`**

Read the `keyToAction` function to determine which keys map to which hex directions. The legend diagram must match exactly.

- [ ] **Step 2: Create the legend renderer**

```typescript
// src/renderer/legend.ts
import { COLORS } from "./glyphs";

export type LegendMode = "map" | "encounter" | "camp" | "gameover";

/**
 * Draws a persistent key legend in the top-right corner of the canvas.
 * The hex diagram must match the actual key-to-direction mapping in input.ts.
 */
export function drawLegend(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  mode: LegendMode
): void {
  const padding = 12;
  const lineHeight = 18;
  const legendWidth = 180;
  const x = canvasWidth - legendWidth - padding;
  let y = padding;

  ctx.save();
  ctx.textAlign = "left";

  if (mode === "map") {
    drawMapLegend(ctx, x, y, legendWidth, padding, lineHeight);
  } else if (mode === "encounter") {
    drawEncounterLegend(ctx, x, y, legendWidth, padding, lineHeight);
  } else if (mode === "gameover") {
    drawGameOverLegend(ctx, x, y, legendWidth, padding, lineHeight);
  }

  ctx.restore();
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  padding: number
): void {
  ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
  ctx.fillRect(x - padding, y - padding, w + padding * 2, h + padding * 2);
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(x - padding, y - padding, w + padding * 2, h + padding * 2);
}

function drawMapLegend(
  ctx: CanvasRenderingContext2D,
  x: number, startY: number,
  width: number, padding: number,
  lineHeight: number
): void {
  // NOTE: Update this diagram to match the actual QWEASD mapping
  // from input.ts. The keys below are placeholders — verify before shipping.
  const lines = [
    { label: "MOVEMENT", style: "header" },
    { label: "  Q   W", style: "normal" },
    { label: "   \\ /", style: "normal" },
    { label: "A - @ - D", style: "normal" },
    { label: "   / \\", style: "normal" },
    { label: "  Z   X", style: "normal" },
    { label: "", style: "spacer" },
    { label: "ACTIONS", style: "header" },
    { label: "R  Rest (+Health)", style: "normal" },
    { label: "F  Forage (+Supply)", style: "normal" },
  ];

  const totalHeight = lines.length * lineHeight + 8;
  drawPanel(ctx, x, startY, width, totalHeight, padding);

  let y = startY;
  for (const line of lines) {
    if (line.style === "header") {
      ctx.fillStyle = "#888";
      ctx.font = "bold 11px monospace";
      ctx.fillText(line.label, x, y + 12);
    } else if (line.style === "normal") {
      ctx.fillStyle = COLORS.text;
      ctx.font = "13px monospace";
      ctx.fillText(line.label, x, y + 12);
    }
    y += lineHeight;
  }
}

function drawEncounterLegend(
  ctx: CanvasRenderingContext2D,
  x: number, startY: number,
  width: number, padding: number,
  lineHeight: number
): void {
  const totalHeight = 2 * lineHeight + 8;
  drawPanel(ctx, x, startY, width, totalHeight, padding);

  ctx.fillStyle = "#888";
  ctx.font = "bold 11px monospace";
  ctx.fillText("CHOICES", x, startY + 12);
  ctx.fillStyle = COLORS.text;
  ctx.font = "13px monospace";
  ctx.fillText("1-3  Select choice", x, startY + lineHeight + 12);
}

function drawGameOverLegend(
  ctx: CanvasRenderingContext2D,
  x: number, startY: number,
  width: number, padding: number,
  lineHeight: number
): void {
  const totalHeight = 2 * lineHeight + 8;
  drawPanel(ctx, x, startY, width, totalHeight, padding);

  ctx.fillStyle = "#888";
  ctx.font = "bold 11px monospace";
  ctx.fillText("", x, startY + 12);
  ctx.fillStyle = COLORS.text;
  ctx.font = "13px monospace";
  ctx.fillText("Enter  New Game", x, startY + lineHeight + 12);
}
```

- [ ] **Step 3: Integrate into views**

In `src/renderer/views/map.ts`, after drawing the HUD:
```typescript
import { drawLegend } from "../legend";
drawLegend(ctx, canvas.width, canvas.height, "map");
```

In `src/renderer/views/encounter.ts`:
```typescript
import { drawLegend } from "../legend";
drawLegend(ctx, canvas.width, canvas.height, "encounter");
```

In `src/renderer/views/gameover.ts`:
```typescript
import { drawLegend } from "../legend";
drawLegend(ctx, canvas.width, canvas.height, "gameover");
```

- [ ] **Step 4: Remove any existing control hints from the views**

The current `map.ts` view draws control hints at the bottom. Remove those since the legend replaces them.

- [ ] **Step 5: Manually test in browser**

Run: `npm run dev`
Expected: Legend panel visible in top-right corner. Shows movement diagram + actions in map mode, choice keys in encounter mode, Enter in gameover.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/legend.ts src/renderer/views/
git commit -m "feat: add persistent key legend panel across all game modes"
```

---

### Task 6: Resource HUD Improvements

**Files:**
- Modify: `src/renderer/hud.ts`

- [ ] **Step 1: Add color-coding helper**

```typescript
function resourceColor(current: number, max: number): string {
  const ratio = current / max;
  if (ratio > 0.6) return "#4a9"; // green
  if (ratio > 0.3) return "#da4"; // amber
  return "#d44";                   // red
}
```

- [ ] **Step 2: Update resource bar rendering**

Replace the existing `bar()` helper and resource rendering with:
- Unicode icons paired with labels: `◆ Supply`, `✦ Hope`, `♥ Health`
- Colored fill bars using `resourceColor()`
- Numeric value: `4/10`

```typescript
function drawResourceBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  icon: string, label: string,
  current: number, max: number
): void {
  const color = resourceColor(current, max);
  const barWidth = 100;
  const barHeight = 12;
  const fillWidth = (current / max) * barWidth;

  // Icon and label
  ctx.fillStyle = color;
  ctx.font = "14px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`${icon} ${label}`, x, y);

  // Bar background
  ctx.fillStyle = "#333";
  ctx.fillRect(x + 110, y - 10, barWidth, barHeight);

  // Bar fill
  ctx.fillStyle = color;
  ctx.fillRect(x + 110, y - 10, fillWidth, barHeight);

  // Numeric
  ctx.fillStyle = "#c0c0c0";
  ctx.fillText(`${current}/${max}`, x + 220, y);
}
```

- [ ] **Step 3: Add searing proximity warning**

```typescript
function searingDistance(state: GameState): number {
  const playerAxisValue = state.player.hex[state.searing.axis];
  if (state.searing.direction === 1) {
    return playerAxisValue - state.searing.line;
  }
  return state.searing.line - playerAxisValue;
}
```

When distance <= 5, draw a warning below the resource bars:
```typescript
const dist = searingDistance(state);
if (dist <= 5) {
  ctx.fillStyle = dist <= 2 ? "#d44" : "#da4";
  ctx.font = "bold 14px monospace";
  ctx.fillText(`⚠ SEARING: ${dist} hex${dist === 1 ? "" : "es"}`, x, y + 24);
}
```

- [ ] **Step 4: Manually verify in browser**

Run: `npm run dev`
Expected: Resource bars show colored fill with icons and numeric values. Searing warning appears when close.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hud.ts
git commit -m "feat: improve HUD with color-coded resources, icons, and searing warning"
```

---

### Task 7: Event Log Visual Hierarchy

**Files:**
- Modify: `src/engine/state.ts` (add `type` to LogEntry)
- Modify: `src/engine/turn.ts` (tag log messages with types)
- Modify: `src/ui/log.ts` (styled rendering)
- Modify: `index.html` (CSS for log styles)

- [ ] **Step 1: Add optional `type` field to LogEntry**

In `src/engine/state.ts`:
```typescript
interface LogEntry {
  turn: number;
  text: string;
  type?: "narrative" | "resource" | "searing" | "system";
}
```

- [ ] **Step 2: Tag existing log messages in `src/engine/turn.ts`**

Update all `appendLog` calls to include `type`:
- Encounter text / story text → `"narrative"`
- Resource change messages ("+2 Supply", "-1 Hope") → `"resource"`
- Searing warnings ("The Searing advances") → `"searing"`
- System messages ("Not enough supply", "You cannot move there") → `"system"`

- [ ] **Step 3: Update log rendering in `src/ui/log.ts`**

Use safe DOM methods (no innerHTML) to render styled log entries:

```typescript
export function updateLog(logEl: HTMLElement, entries: LogEntry[], lastRendered: number): number {
  for (let i = lastRendered; i < entries.length; i++) {
    const entry = entries[i];
    const div = document.createElement("div");
    div.className = `log-entry log-${entry.type ?? "narrative"}`;

    const turnSpan = document.createElement("span");
    turnSpan.className = "log-turn";
    turnSpan.textContent = `[${entry.turn}] `;
    div.appendChild(turnSpan);

    const textSpan = document.createElement("span");
    textSpan.textContent = entry.text;
    div.appendChild(textSpan);

    logEl.appendChild(div);
  }
  logEl.scrollTop = logEl.scrollHeight;
  return entries.length;
}
```

- [ ] **Step 4: Add CSS to `index.html`**

```css
.log-entry { margin-bottom: 4px; }
.log-turn { color: #666; }
.log-narrative { color: #c0c0c0; }
.log-resource { color: #4a9; }
.log-searing { color: #d44; font-weight: bold; }
.log-system { color: #888; font-style: italic; }
```

- [ ] **Step 5: Manually verify in browser**

Run: `npm run dev`
Expected: Log entries have distinct colors by type. Searing warnings in red. System messages in gray italic.

- [ ] **Step 6: Commit**

```bash
git add src/engine/state.ts src/engine/turn.ts src/ui/log.ts index.html
git commit -m "feat: add visual hierarchy to event log with typed, colored entries"
```

---

### Task 8: Tutorial Hints

**Files:**
- Create: `src/ui/hints.ts`
- Modify: `src/renderer/views/map.ts`
- Modify: `src/renderer/views/encounter.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create the hints system**

```typescript
// src/ui/hints.ts
const HINTS_KEY = "waning-light-hints";

export type HintId = "first-turn" | "low-supply" | "first-encounter" | "first-rumor";

interface HintState {
  dismissed: HintId[];
}

function loadHintState(): HintState {
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    return raw ? JSON.parse(raw) : { dismissed: [] };
  } catch {
    return { dismissed: [] };
  }
}

function saveHintState(state: HintState): void {
  localStorage.setItem(HINTS_KEY, JSON.stringify(state));
}

export function isHintDismissed(id: HintId): boolean {
  return loadHintState().dismissed.includes(id);
}

export function dismissHint(id: HintId): void {
  const state = loadHintState();
  if (!state.dismissed.includes(id)) {
    state.dismissed.push(id);
    saveHintState(state);
  }
}

export function getActiveHint(context: {
  turn: number;
  supply: number;
  maxSupply: number;
  mode: string;
}): { id: HintId; text: string } | null {
  if (context.turn === 0 && !isHintDismissed("first-turn")) {
    return { id: "first-turn", text: "QWEASD to move  |  R to rest  |  F to forage" };
  }
  if (context.mode === "encounter" && !isHintDismissed("first-encounter")) {
    return { id: "first-encounter", text: "Press 1, 2, or 3 to choose" };
  }
  if (context.supply <= 1 && context.supply < context.maxSupply && !isHintDismissed("low-supply")) {
    return { id: "low-supply", text: "Supplies are low — press F to forage" };
  }
  return null;
}
```

- [ ] **Step 2: Render hints as a canvas overlay bar in map and encounter views**

In the relevant view renderers, after other drawing:

```typescript
import { getActiveHint } from "../../ui/hints";
import { MAX_SUPPLY } from "../../engine/state";

// At the end of the render function:
const hint = getActiveHint({
  turn: state.turn,
  supply: state.player.supply,
  maxSupply: MAX_SUPPLY,
  mode: state.mode.type,
});

if (hint) {
  ctx.save();
  ctx.font = "13px monospace";
  const hintWidth = ctx.measureText(hint.text).width + 40;
  const hintX = (canvas.width - hintWidth) / 2;
  const hintY = canvas.height - 50;
  ctx.fillStyle = "rgba(40, 40, 20, 0.9)";
  ctx.fillRect(hintX, hintY, hintWidth, 30);
  ctx.strokeStyle = "#da4";
  ctx.strokeRect(hintX, hintY, hintWidth, 30);
  ctx.fillStyle = "#da4";
  ctx.textAlign = "center";
  ctx.fillText(hint.text, canvas.width / 2, hintY + 19);
  ctx.restore();
}
```

- [ ] **Step 3: Dismiss hints on relevant actions in `src/main.ts`**

In the keydown handler, after processing an action:
```typescript
import { dismissHint } from "./ui/hints";

// After a successful push:
dismissHint("first-turn");

// After a choose action:
dismissHint("first-encounter");

// After a forage action:
dismissHint("low-supply");
```

- [ ] **Step 4: Manually verify in browser**

Run: `npm run dev`
Expected: Hint bar appears on first turn, disappears after first move. Low supply hint appears when supply drops. Encounter hint appears on first encounter. Hints don't reappear after page reload.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hints.ts src/renderer/views/ src/main.ts
git commit -m "feat: add contextual tutorial hints with LocalStorage persistence"
```

---

### Task 9: Final Integration Test and Typecheck

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (44 existing + new tests from this milestone)

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Manual playtest checklist**

Run: `npm run dev`
Verify the full M1 checklist:
- [ ] Hex display shows biome glyphs only, no tag symbols
- [ ] Visited/unvisited hexes are visually distinct
- [ ] Key legend is visible and context-appropriate per mode
- [ ] Resource bars are color-coded with labels and numbers
- [ ] Searing proximity warning appears when close
- [ ] Event log has colored entries by type
- [ ] Tutorial hints appear and dismiss correctly
- [ ] Save/load works: play a few turns, refresh, continue game
- [ ] New game clears save
- [ ] Game over clears save

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: M1 integration fixes"
```
