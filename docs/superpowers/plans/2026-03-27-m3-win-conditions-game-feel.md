# M3: Win Conditions + Game Feel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game has two win conditions, atmospheric effects, sound design, and narrative death/win screens. The game feels complete.

**Architecture:** Win conditions are pure engine logic checked in `resolveTurn`. Game feel changes touch the renderer (low-Hope effects, Searing drama) and add a new audio system. Sound uses the Web Audio API with no external libraries.

**Tech Stack:** TypeScript, Canvas 2D, Web Audio API, Vitest

**Design Spec:** `docs/superpowers/specs/2026-03-27-friends-family-demo-design.md` — Milestone 3 section

**Prerequisite:** M2 must be complete (rumor deck, relics, encounter overhaul).

---

### Task 1: Pillars of Frost Win Condition

**Files:**
- Create: `src/engine/win.ts`
- Test: `tests/engine/win.test.ts`
- Modify: `src/engine/turn.ts`
- Modify: `src/engine/map.ts`

- [ ] **Step 1: Write win condition tests**

```typescript
// tests/engine/win.test.ts
import { describe, expect, it } from "vitest";
import {
  checkPillarsOfFrost,
  checkRestartTheGear,
  PILLARS_DISTANCE_THRESHOLD,
  GEAR_RELIC_THRESHOLD,
} from "../../src/engine/win";
import { cubeCoord } from "../../src/engine/hex";
import type { SearingState, Relic } from "../../src/engine/state";

describe("checkPillarsOfFrost", () => {
  const searing: SearingState = { axis: "q", direction: 1, line: -10, advanceRate: 4 };

  it("returns false when player is too close to searing origin", () => {
    expect(checkPillarsOfFrost(cubeCoord(0, 0, 0), searing)).toBe(false);
  });

  it("returns true when player reaches threshold distance opposite the searing", () => {
    // Searing advances along +q, so player needs to go far in +q direction
    // Distance from searing line is playerQ - searingLine
    const farCoord = cubeCoord(PILLARS_DISTANCE_THRESHOLD + (-10) + 1, -(PILLARS_DISTANCE_THRESHOLD + (-10) + 1), 0);
    // Actually: distance = playerAxisValue - searingLine for direction=1
    // We need playerQ - (-10) >= threshold
    // So playerQ >= threshold - 10
    const needed = PILLARS_DISTANCE_THRESHOLD;
    const playerQ = needed + searing.line;
    expect(checkPillarsOfFrost(cubeCoord(playerQ, -playerQ, 0), searing)).toBe(true);
  });

  it("returns false when player is on the wrong side", () => {
    // Player behind the searing line
    expect(checkPillarsOfFrost(cubeCoord(-15, 15, 0), searing)).toBe(false);
  });
});

describe("checkRestartTheGear", () => {
  const makeRelic = (id: string): Relic => ({
    id,
    name: id,
    description: "",
    effect: { type: "forage_bonus", chance: 0.1 },
  });

  it("returns false when not enough relics", () => {
    const relics = Array.from({ length: GEAR_RELIC_THRESHOLD - 1 }, (_, i) => makeRelic(`r${i}`));
    expect(checkRestartTheGear(relics)).toBe(false);
  });

  it("returns true when relic count meets threshold", () => {
    const relics = Array.from({ length: GEAR_RELIC_THRESHOLD }, (_, i) => makeRelic(`r${i}`));
    expect(checkRestartTheGear(relics)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/win.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement win.ts**

```typescript
// src/engine/win.ts
import type { CubeCoord } from "./hex";
import type { SearingState, Relic } from "./state";

// Tuning constants — adjusted in M4 based on playtesting
export const PILLARS_DISTANCE_THRESHOLD = 20;
export const GEAR_RELIC_THRESHOLD = 5;

export function checkPillarsOfFrost(
  playerHex: CubeCoord,
  searing: SearingState
): boolean {
  const playerAxisValue = playerHex[searing.axis];
  const distance =
    searing.direction === 1
      ? playerAxisValue - searing.line
      : searing.line - playerAxisValue;
  return distance >= PILLARS_DISTANCE_THRESHOLD;
}

export function checkRestartTheGear(relics: Relic[]): boolean {
  return relics.length >= GEAR_RELIC_THRESHOLD;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/engine/win.test.ts`
Expected: All pass

- [ ] **Step 5: Integrate Pillars check into `handlePush` in `src/engine/turn.ts`**

After moving the player, check if they've reached the Pillars threshold. If so, generate a Pillars of Frost landmark hex and trigger a win encounter:

```typescript
import { checkPillarsOfFrost, checkRestartTheGear } from "./win";

// In handlePush, after moving:
if (checkPillarsOfFrost(newPlayerHex, state.searing)) {
  // Generate the Pillars landmark hex
  const pillarsEncounter: Encounter = {
    id: "pillars-of-frost",
    text: "Towering columns of ice rise from the earth, ancient beyond measure. The air is still and cold. You have reached the Pillars of Frost — the edge of the frozen world. The Searing cannot reach you here.",
    requiredTags: [],
    choices: [{ label: "You made it.", outcome: { hope: 5 } }],
  };
  return {
    ...newState,
    mode: { type: "encounter", encounter: pillarsEncounter, hex: newPlayerHex },
    status: "won",
  };
}
```

- [ ] **Step 6: Integrate Gear check into turn resolution**

After resolving an encounter choice that grants a relic, check the Gear threshold:

```typescript
if (checkRestartTheGear(newState.relics)) {
  // Don't auto-win — flag it so the next hex triggers the Gear ritual encounter
  // Add a flag to state or check in handlePush
}
```

The Gear ritual is a player choice: when they have enough relics and enter a new hex, trigger the ritual encounter. The player can choose to perform it or continue exploring.

- [ ] **Step 7: Update GameState status to include win type**

Extend the `status` field or `GameMode` gameover to distinguish win types:

```typescript
type GameMode =
  | { type: "map" }
  | { type: "encounter"; encounter: Encounter; hex: CubeCoord }
  | { type: "camp"; result: string; incident: IncidentResult | null }
  | { type: "gameover"; reason: string; outcome: "win_pillars" | "win_gear" | "loss_health" | "loss_hope" | "loss_searing" };
```

- [ ] **Step 8: Run all tests, fix any breakage from status type change**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add src/engine/win.ts tests/engine/win.test.ts src/engine/turn.ts src/engine/state.ts
git commit -m "feat: add Pillars of Frost and Restart the Gear win conditions"
```

---

### Task 2: Frost Proximity Signals

**Files:**
- Modify: `src/engine/turn.ts`

- [ ] **Step 1: Add frost proximity log messages**

In `handlePush`, when the player is within a few hexes of the Pillars threshold, add atmospheric log entries:

```typescript
const distanceToPillars = PILLARS_DISTANCE_THRESHOLD - distance;
if (distanceToPillars <= 5 && distanceToPillars > 0) {
  const frostMessages = [
    "The air grows colder. Frost clings to everything.",
    "Your breath crystallizes. The Pillars must be near.",
    "Ice patterns form on stone surfaces. You're close.",
    "The temperature drops sharply. The frozen world is ahead.",
    "You can feel it — the edge of the world, cold and still.",
  ];
  const message = frostMessages[Math.min(5 - distanceToPillars, frostMessages.length - 1)];
  newState = appendLog(newState, message, "narrative");
}
```

- [ ] **Step 2: Manually verify in browser**

Play toward the Pillars and confirm frost messages appear in the log as you get close.

- [ ] **Step 3: Commit**

```bash
git add src/engine/turn.ts
git commit -m "feat: add frost proximity narrative messages near Pillars of Frost"
```

---

### Task 3: Win/Loss Screen with Stats

**Files:**
- Modify: `src/renderer/views/gameover.ts`
- Modify: `src/engine/state.ts` (add game stats tracking)

- [ ] **Step 1: Add stats tracking to GameState**

```typescript
export interface GameStats {
  hexesExplored: number;
  encountersResolved: number;
  rumorsDiscovered: number;
  rumorsCompleted: number;
  relicsCollected: number;
}
```

Add `stats: GameStats` to `GameState`. Initialize all to 0 in `createInitialState`. Increment in relevant places:
- `hexesExplored`: in `handlePush` when entering a new (unvisited) hex
- `encountersResolved`: in `handleChoose` after resolving
- `rumorsDiscovered`/`rumorsCompleted`: in rumor handling code
- `relicsCollected`: when a relic is added

- [ ] **Step 2: Update gameover view to show stats**

```typescript
// In src/renderer/views/gameover.ts, replace the simple death screen with:
export function renderGameOver(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState
): void {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const mode = state.mode as { type: "gameover"; reason: string; outcome: string };
  const isWin = mode.outcome.startsWith("win");

  ctx.textAlign = "center";
  const centerX = canvas.width / 2;
  let y = canvas.height / 4;

  // Title
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = isWin ? "#4a9" : "#d44";
  ctx.fillText(isWin ? "Victory" : "Game Over", centerX, y);
  y += 40;

  // Narrative reason
  ctx.font = "16px monospace";
  ctx.fillStyle = "#c0c0c0";
  const reasonLines = wrapText(ctx, mode.reason, canvas.width - 100);
  for (const line of reasonLines) {
    ctx.fillText(line, centerX, y);
    y += 22;
  }
  y += 30;

  // Stats
  ctx.font = "14px monospace";
  ctx.fillStyle = "#888";
  const stats = state.stats;
  const statLines = [
    `Turns survived: ${state.turn}`,
    `Hexes explored: ${stats.hexesExplored}`,
    `Encounters resolved: ${stats.encountersResolved}`,
    `Rumors discovered: ${stats.rumorsDiscovered}`,
    `Rumors completed: ${stats.rumorsCompleted}`,
    `Relics collected: ${stats.relicsCollected}`,
  ];
  for (const line of statLines) {
    ctx.fillText(line, centerX, y);
    y += 20;
  }

  y += 30;
  ctx.fillStyle = "#666";
  ctx.font = "14px monospace";
  ctx.fillText("Press Enter for New Game", centerX, y);
}
```

- [ ] **Step 3: Write narrative death/win text**

Replace the generic "Game Over" with narrative text per outcome:
- `loss_health`: "Your body gives out. The Twilight Strip claims another."
- `loss_hope`: "The light inside you fades. You sit down, and do not rise."
- `loss_searing`: "The Searing catches you. In the end, you could not outrun the sun."
- `win_pillars`: "You stand before the Pillars of Frost, monuments to a world that was. The Searing is far behind. You are safe — for now."
- `win_gear`: "The Gear turns. The mechanism groans to life. The sun shudders — and moves. You have restarted the world."

- [ ] **Step 4: Update serialization for stats**

Add `stats` to `serializeState`/`deserializeState` with safe defaults for backward compatibility.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/engine/state.ts src/engine/turn.ts src/renderer/views/gameover.ts
git commit -m "feat: add stats tracking and narrative win/loss screens"
```

---

### Task 4: Low-Hope Visual Effects

**Files:**
- Modify: `src/renderer/views/map.ts`
- Modify: `src/renderer/renderer.ts`

- [ ] **Step 1: Add color desaturation at low Hope**

In `src/renderer/renderer.ts` or `src/renderer/views/map.ts`, after the main render pass, apply a desaturation overlay when Hope is 1-2:

```typescript
if (state.player.hope <= 2 && state.player.hope > 0) {
  // Semi-transparent dark overlay for desaturation effect
  ctx.fillStyle = `rgba(10, 10, 10, ${0.15 * (3 - state.player.hope)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
```

- [ ] **Step 2: Add text flicker effect in the log at low Hope**

In `src/ui/log.ts`, when rendering entries at low Hope, occasionally apply a CSS class that causes subtle flicker:

```css
.log-entry.low-hope {
  animation: flicker 3s infinite;
}

@keyframes flicker {
  0%, 95%, 100% { opacity: 1; }
  97% { opacity: 0.4; }
}
```

Tag recent log entries with `low-hope` class when `state.player.hope <= 2`.

- [ ] **Step 3: Manually verify**

Run: `npm run dev`
Lower Hope to 1-2 via encounters or waiting. Verify the screen dims and log text flickers subtly.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ src/ui/log.ts index.html
git commit -m "feat: add low-Hope visual effects (desaturation and log flicker)"
```

---

### Task 5: Searing Visual Drama

**Files:**
- Modify: `src/renderer/views/map.ts`
- Modify: `src/renderer/hud.ts`

- [ ] **Step 1: Improve Searing gradient on consumed hexes**

Replace the simple `░▒▓█` text rendering with an actual color gradient:

```typescript
// For consumed or near-searing hexes, draw a heat gradient:
function getSearingIntensity(coord: CubeCoord, searing: SearingState): number {
  const dist = searing.direction === 1
    ? coord[searing.axis] - searing.line
    : searing.line - coord[searing.axis];
  if (dist <= 0) return 1.0;  // fully consumed
  if (dist <= 3) return 1.0 - (dist / 3) * 0.7;  // gradient zone
  return 0;
}

// In hex drawing, if intensity > 0:
if (intensity > 0) {
  ctx.fillStyle = `rgba(200, 50, 20, ${intensity * 0.6})`;
  ctx.fill();  // overlay on the hex
}
```

- [ ] **Step 2: Add screen edge pulse when Searing is close**

When the Searing is within 3 hexes of the player, draw a pulsing red vignette at the screen edge:

```typescript
function drawSearingVignette(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  proximity: number // 1-3
): void {
  const pulse = Math.sin(Date.now() / 500) * 0.5 + 0.5; // 0-1 oscillation
  const alpha = (0.1 + pulse * 0.1) * (4 - proximity) / 3;
  const gradient = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, canvas.width * 0.3,
    canvas.width / 2, canvas.height / 2, canvas.width * 0.7
  );
  gradient.addColorStop(0, "rgba(200, 50, 20, 0)");
  gradient.addColorStop(1, `rgba(200, 50, 20, ${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`
Let the Searing approach. Verify heat gradient on hexes and pulsing red edge effect.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/map.ts src/renderer/hud.ts
git commit -m "feat: add Searing visual drama with heat gradient and screen pulse"
```

---

### Task 6: Sound Design (Web Audio API)

**Files:**
- Create: `src/audio/audio.ts`
- Create: `src/audio/sounds.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create the audio system**

```typescript
// src/audio/audio.ts

let audioCtx: AudioContext | null = null;

export function initAudio(): void {
  // AudioContext requires user gesture to start
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
}

export function getAudioContext(): AudioContext | null {
  return audioCtx;
}

export function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.1
): void {
  const ctx = audioCtx;
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

export function playNoise(duration: number, volume: number = 0.05): void {
  const ctx = audioCtx;
  if (!ctx) return;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}
```

- [ ] **Step 2: Create sound effect definitions**

```typescript
// src/audio/sounds.ts
import { playTone, playNoise } from "./audio";

export function playMoveSound(): void {
  playTone(200, 0.1, "triangle", 0.05);
}

export function playEncounterSound(): void {
  playTone(440, 0.3, "sine", 0.08);
  setTimeout(() => playTone(550, 0.2, "sine", 0.06), 150);
}

export function playChoiceSound(succeeded: boolean): void {
  if (succeeded) {
    playTone(523, 0.15, "sine", 0.08);
    setTimeout(() => playTone(659, 0.2, "sine", 0.08), 100);
  } else {
    playTone(300, 0.3, "sawtooth", 0.06);
  }
}

export function playSearingWarning(): void {
  playNoise(0.5, 0.03);
  playTone(80, 0.5, "sawtooth", 0.04);
}

export function playWinSound(): void {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.4, "sine", 0.1), i * 200);
  });
}

export function playLossSound(): void {
  [400, 350, 300, 200].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.5, "sawtooth", 0.06), i * 300);
  });
}

export function playRumorDiscoverySound(): void {
  playTone(440, 0.2, "sine", 0.08);
  setTimeout(() => playTone(660, 0.3, "sine", 0.08), 200);
  setTimeout(() => playTone(880, 0.4, "sine", 0.06), 400);
}
```

- [ ] **Step 3: Integrate sound triggers into main.ts**

```typescript
import { initAudio } from "./audio/audio";
import { playMoveSound, playEncounterSound, ... } from "./audio/sounds";

// Initialize audio on first user interaction
document.addEventListener("keydown", () => initAudio(), { once: true });
document.addEventListener("click", () => initAudio(), { once: true });

// After resolveTurn, check what happened and play appropriate sounds:
// - Push action → playMoveSound()
// - Entered encounter → playEncounterSound()
// - Choice resolved → playChoiceSound(succeeded)
// - Searing advanced nearby → playSearingWarning()
// - Game won → playWinSound()
// - Game lost → playLossSound()
// - Rumor discovered → playRumorDiscoverySound()
```

- [ ] **Step 4: Manually test sounds**

Run: `npm run dev`
Move around (hear move tone). Enter encounter (hear encounter sting). Make choices. Let Searing get close (hear rumble). Win or lose (hear appropriate audio).

- [ ] **Step 5: Commit**

```bash
git add src/audio/
git commit -m "feat: add Web Audio API sound design with procedural tones"
```

---

### Task 7: Shadow Encounters at Low Hope

**Files:**
- Modify: `src/engine/encounters.ts`
- Modify: `src/engine/turn.ts`

- [ ] **Step 1: Add shadow encounter variant logic**

When Hope is 1-2, encounters have a chance to show an "unsettling variant" — same choices and outcomes, but the text is rewritten to feel paranoid/unreliable.

Approach: Add an optional `shadowText` field to `Encounter`. When rendering at low Hope, use `shadowText` instead of `text` if it exists.

```typescript
// In Encounter interface:
shadowText?: string;  // paranoid/unreliable version shown at low Hope
```

- [ ] **Step 2: Add shadow text to select encounters in seed data**

For 10-15 of the common encounters, add a `shadowText` variant:

```json
{
  "id": "forest-stream-common",
  "text": "A narrow stream cuts through the underbrush. The water is cold and clear.",
  "shadowText": "A stream... or is it? The water seems to move wrong. You could swear it's watching you.",
  "requiredTags": ["water"],
  "choices": [...]
}
```

- [ ] **Step 3: Use shadow text in encounter view**

In `src/renderer/views/encounter.ts`, check the player's Hope:

```typescript
const displayText = state.player.hope <= 2 && encounter.shadowText
  ? encounter.shadowText
  : encounter.text;
```

- [ ] **Step 4: Manually verify**

Lower Hope and trigger encounters. Verify paranoid text appears.

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts src/engine/data/seed-encounters.json src/renderer/views/encounter.ts
git commit -m "feat: add shadow encounter text variants at low Hope"
```

---

### Task 8: Final M3 Integration and Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Manual playtest checklist**

Run: `npm run dev`
- [ ] Pillars of Frost win: reach far enough from searing, see frost messages, trigger win
- [ ] Restart the Gear win: collect enough relics, trigger Gear ritual, choose to win
- [ ] Win screens show stats and narrative text
- [ ] Loss screens show appropriate narrative per cause
- [ ] Low-Hope desaturation and log flicker work
- [ ] Shadow encounter text appears at low Hope
- [ ] Searing heat gradient renders on approaching hexes
- [ ] Screen pulse at close searing proximity
- [ ] All sounds trigger correctly (move, encounter, choice, searing, win, loss)
- [ ] Save/load preserves stats, win state

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: M3 integration fixes"
```
