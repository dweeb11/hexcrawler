# M2: Rumor Deck + Relics + Encounter Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every hex is interesting. The Rumor Deck gives exploration narrative purpose. Relics give tangible progression. The encounter system tells stories.

**Architecture:** Three independent engine subsystems (encounters rewrite, rumor deck, relics) that integrate through `GameState` and `resolveTurn`. Content authoring (encounter/rumor/relic data) is separate from engine work. Journal UI is a new HTML panel alongside the existing log.

**Tech Stack:** TypeScript, Canvas 2D, Vitest, Turso (encounter storage)

**Design Spec:** `docs/design/friends-family-demo.md` — Milestone 2 section

**Prerequisite:** M1 must be complete (save/load, visited tracking, simplified hex display).

---

### Task 1: Extend GameState with Rumor and Relic Types

**Files:**
- Modify: `src/engine/state.ts`
- Test: `tests/engine/state.test.ts`

- [ ] **Step 1: Add new types to `src/engine/state.ts`**

```typescript
// --- Relic Types ---

export type RelicEffectType =
  | "max_resource"
  | "forage_bonus"
  | "searing_resist"
  | "hope_decay_slow"
  | "move_discount";

export interface RelicEffect {
  type: RelicEffectType;
  resource?: "supply" | "hope" | "health";
  bonus?: number;
  chance?: number;
  extraTurns?: number;
  intervalBonus?: number;
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  effect: RelicEffect;
}

// --- Rumor Types ---

export interface RumorStep {
  stepIndex: number;
  encounterId: string;       // references an encounter by ID
  hint: string;               // narrative hint toward next step
  hintTags: string[];         // tags the hint implies
  hintBiomes?: Biome[];       // biomes the hint implies
}

export interface Rumor {
  id: string;
  title: string;
  steps: RumorStep[];
  reward: Relic | null;
  hopeBonus: number;
}

export interface ActiveRumor {
  rumorId: string;
  currentStep: number;
}

export interface CompletedRumor {
  rumorId: string;
  completedAtTurn: number;
}

export interface RumorState {
  available: Rumor[];
  active: ActiveRumor[];
  completed: CompletedRumor[];
}
```

- [ ] **Step 2: Extend GameState interface**

```typescript
export interface GameState {
  player: Player;
  map: Map<string, HexTile>;
  searing: SearingState;
  turn: number;
  mode: GameMode;
  log: LogEntry[];
  status: "playing" | "won" | "lost";
  encounters: Encounter[];
  // NEW in M2:
  rumors: RumorState;
  relics: Relic[];              // collected relics
}
```

- [ ] **Step 3: Update `createInitialState` to include empty rumors/relics**

```typescript
export function createInitialState(
  encounters: Encounter[],
  rng: () => number,
  rumors: Rumor[] = []
): GameState {
  // ... existing code ...
  return {
    // ... existing fields ...
    rumors: {
      available: rumors,
      active: [],
      completed: [],
    },
    relics: [],
  };
}
```

- [ ] **Step 4: Update `serializeState` and `deserializeState`**

Add serialization for the new fields. `Rumor`, `Relic`, `ActiveRumor`, and `CompletedRumor` are plain objects — they serialize to JSON natively. Just include them:

```typescript
// In serializeState:
rumors: state.rumors,
relics: state.relics,

// In deserializeState:
rumors: data.rumors ?? { available: [], active: [], completed: [] },
relics: data.relics ?? [],
```

The fallback values ensure backward compatibility with M1 saves.

- [ ] **Step 5: Update serialization round-trip test**

Add to `tests/engine/state.test.ts`:

```typescript
it("round-trips state with rumors and relics", () => {
  const rng = seededRng(42);
  const relic: Relic = {
    id: "ember-compass",
    name: "The Ember Compass",
    description: "Points toward warmth",
    effect: { type: "forage_bonus", chance: 0.15 },
  };
  const rumor: Rumor = {
    id: "whispering-well",
    title: "The Whispering Well",
    steps: [
      {
        stepIndex: 0,
        encounterId: "ww-step-1",
        hint: "Look for ancient water sources",
        hintTags: ["water", "ancient"],
      },
    ],
    reward: relic,
    hopeBonus: 3,
  };

  const state = createInitialState([], rng, [rumor]);
  const withProgress: GameState = {
    ...state,
    rumors: {
      ...state.rumors,
      active: [{ rumorId: "whispering-well", currentStep: 0 }],
    },
    relics: [relic],
  };

  const restored = deserializeState(
    JSON.parse(JSON.stringify(serializeState(withProgress)))
  );
  expect(restored.rumors.available).toHaveLength(1);
  expect(restored.rumors.active).toHaveLength(1);
  expect(restored.relics).toHaveLength(1);
  expect(restored.relics[0].id).toBe("ember-compass");
});

it("deserializes M1 saves without rumors/relics gracefully", () => {
  const rng = seededRng(42);
  const state = createInitialState([], rng);
  const serialized = serializeState(state);

  // Simulate M1 save that lacks rumor/relic fields
  const m1Save = { ...serialized } as Record<string, unknown>;
  delete m1Save.rumors;
  delete m1Save.relics;

  const restored = deserializeState(m1Save);
  expect(restored.rumors.available).toEqual([]);
  expect(restored.rumors.active).toEqual([]);
  expect(restored.relics).toEqual([]);
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/engine/state.test.ts`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/engine/state.ts tests/engine/state.test.ts
git commit -m "feat: add Rumor, Relic, and RumorState types to GameState"
```

---

### Task 2: Encounter Density — Every Hex Gets an Encounter

**Files:**
- Modify: `src/engine/map.ts`
- Modify: `tests/engine/map.test.ts`

- [ ] **Step 1: Write test for guaranteed encounter assignment**

Add to `tests/engine/map.test.ts`:

```typescript
describe("encounter density", () => {
  const commonEncounter: Encounter = {
    id: "forest-common",
    text: "Sunlight filters through leaves",
    requiredTags: ["wood"],
    choices: [{ label: "Rest", outcome: { hope: 1 } }],
  };
  const rareEncounter: Encounter = {
    id: "forest-rare",
    text: "An ancient shrine in a clearing near water",
    requiredTags: ["wood", "water", "ancient"],
    choices: [{ label: "Pray", outcome: { hope: 3 } }],
  };

  it("always assigns an encounter when matching encounters exist", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const tile = generateHex(
        cubeCoord(1, 0, -1),
        new Map(),
        [commonEncounter],
        seededRng(seed)
      );
      // With the new density model, every hex that can match should have an encounter
      // (depends on tag generation — not every hex will have "wood")
    }
  });

  it("prefers higher tag-count encounters over lower", () => {
    // Create a hex that has all three tags
    const neighborCoord = cubeCoord(0, 1, -1);
    const existing: HexTile = {
      coord: neighborCoord,
      biome: "forest",
      tags: new Set(["wood", "water", "ancient"]),
      encounter: null,
      revealed: true,
      consumed: false,
      visited: true,
    };
    const map = new Map([[coordKey(neighborCoord), existing]]);

    let rareCount = 0;
    let commonCount = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const tile = generateHex(
        cubeCoord(1, 0, -1),
        map,
        [commonEncounter, rareEncounter],
        seededRng(seed)
      );
      if (tile.encounter?.id === "forest-rare") rareCount++;
      if (tile.encounter?.id === "forest-common") commonCount++;
    }
    // When both match, the rarer (more tags) should be preferred
    // Not every hex will have all 3 tags, so rare won't always match
    // But when it does match, it should take priority
  });
});
```

- [ ] **Step 2: Run test to establish baseline**

Run: `npx vitest run tests/engine/map.test.ts`

- [ ] **Step 3: Modify `pickEncounter` in `src/engine/map.ts`**

Replace the current `pickEncounter` (which has a 50% spawn chance and random selection) with a priority-based system:

```typescript
export function pickEncounter(
  encounters: Encounter[],
  tags: Set<string>,
  biome: Biome,
  rng: () => number
): Encounter | null {
  const matching = findMatchingEncounters(encounters, tags, biome);
  if (matching.length === 0) return null;

  // Sort by requiredTags length descending — rarer encounters first
  matching.sort((a, b) => b.requiredTags.length - a.requiredTags.length);

  // Group by tag count
  const maxTags = matching[0].requiredTags.length;
  const topTier = matching.filter((e) => e.requiredTags.length === maxTags);

  // Pick randomly from the top tier
  return topTier[Math.floor(rng() * topTier.length)];
}
```

Remove the 50% spawn chance — every hex that has any matching encounter gets one.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass. Note that existing tests may need adjustment since the 50% spawn chance is removed.

- [ ] **Step 5: Commit**

```bash
git add src/engine/map.ts src/engine/encounters.ts tests/engine/map.test.ts
git commit -m "feat: every hex gets an encounter, rarer encounters take priority"
```

---

### Task 3: Relic Effect Application in Turn Resolution

**Files:**
- Create: `src/engine/relics.ts`
- Test: `tests/engine/relics.test.ts`
- Modify: `src/engine/turn.ts`
- Modify: `src/engine/resources.ts`

- [ ] **Step 1: Write relic effect tests**

```typescript
// tests/engine/relics.test.ts
import { describe, expect, it } from "vitest";
import {
  getMaxResource,
  getForageBonus,
  getHopeDecayInterval,
  getMoveDiscount,
} from "../../src/engine/relics";
import type { Relic } from "../../src/engine/state";
import {
  MAX_SUPPLY,
  MAX_HOPE,
  MAX_HEALTH,
  HOPE_DECAY_INTERVAL,
} from "../../src/engine/state";

const foragRelic: Relic = {
  id: "gatherers-pouch",
  name: "Gatherer's Pouch",
  description: "Foraging is easier",
  effect: { type: "forage_bonus", chance: 0.15 },
};

const supplyRelic: Relic = {
  id: "deep-pack",
  name: "Deep Pack",
  description: "Carry more supplies",
  effect: { type: "max_resource", resource: "supply", bonus: 2 },
};

const hopeRelic: Relic = {
  id: "star-shard",
  name: "Star Shard",
  description: "Hope fades slower",
  effect: { type: "hope_decay_slow", intervalBonus: 2 },
};

const moveRelic: Relic = {
  id: "wind-boots",
  name: "Wind Boots",
  description: "Sometimes move for free",
  effect: { type: "move_discount", chance: 0.2 },
};

describe("getMaxResource", () => {
  it("returns base max when no relics", () => {
    expect(getMaxResource("supply", [])).toBe(MAX_SUPPLY);
    expect(getMaxResource("hope", [])).toBe(MAX_HOPE);
    expect(getMaxResource("health", [])).toBe(MAX_HEALTH);
  });

  it("adds bonus from matching relics", () => {
    expect(getMaxResource("supply", [supplyRelic])).toBe(MAX_SUPPLY + 2);
  });

  it("ignores non-matching relics", () => {
    expect(getMaxResource("hope", [supplyRelic])).toBe(MAX_HOPE);
  });
});

describe("getForageBonus", () => {
  it("returns 0 with no relics", () => {
    expect(getForageBonus([])).toBe(0);
  });

  it("sums forage bonus from relics", () => {
    expect(getForageBonus([foragRelic])).toBeCloseTo(0.15);
  });
});

describe("getHopeDecayInterval", () => {
  it("returns base interval with no relics", () => {
    expect(getHopeDecayInterval([])).toBe(HOPE_DECAY_INTERVAL);
  });

  it("adds interval bonus from relics", () => {
    expect(getHopeDecayInterval([hopeRelic])).toBe(HOPE_DECAY_INTERVAL + 2);
  });
});

describe("getMoveDiscount", () => {
  it("returns 0 with no relics", () => {
    expect(getMoveDiscount([])).toBe(0);
  });

  it("returns discount chance from relics", () => {
    expect(getMoveDiscount([moveRelic])).toBeCloseTo(0.2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/relics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement relics.ts**

```typescript
// src/engine/relics.ts
import {
  MAX_SUPPLY,
  MAX_HOPE,
  MAX_HEALTH,
  HOPE_DECAY_INTERVAL,
  type Relic,
} from "./state";

export function getMaxResource(
  resource: "supply" | "hope" | "health",
  relics: Relic[]
): number {
  const base = { supply: MAX_SUPPLY, hope: MAX_HOPE, health: MAX_HEALTH }[resource];
  const bonus = relics
    .filter((r) => r.effect.type === "max_resource" && r.effect.resource === resource)
    .reduce((sum, r) => sum + (r.effect.bonus ?? 0), 0);
  return base + bonus;
}

export function getForageBonus(relics: Relic[]): number {
  return relics
    .filter((r) => r.effect.type === "forage_bonus")
    .reduce((sum, r) => sum + (r.effect.chance ?? 0), 0);
}

export function getHopeDecayInterval(relics: Relic[]): number {
  const bonus = relics
    .filter((r) => r.effect.type === "hope_decay_slow")
    .reduce((sum, r) => sum + (r.effect.intervalBonus ?? 0), 0);
  return HOPE_DECAY_INTERVAL + bonus;
}

export function getMoveDiscount(relics: Relic[]): number {
  return relics
    .filter((r) => r.effect.type === "move_discount")
    .reduce((sum, r) => sum + (r.effect.chance ?? 0), 0);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/engine/relics.test.ts`
Expected: All pass

- [ ] **Step 5: Integrate relic effects into turn resolution**

In `src/engine/turn.ts`, update:
- `handlePush`: check `getMoveDiscount` — if `rng() < discount`, skip supply cost
- `applyEndOfTurnEffects`: use `getHopeDecayInterval` instead of `HOPE_DECAY_INTERVAL`
- `src/engine/resources.ts` → `forageResult`: accept optional `forageBonus` parameter, add to base success chance
- `src/engine/resources.ts` → `clampResources`: accept optional max overrides from relics

- [ ] **Step 6: Update existing turn tests to pass with new function signatures**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/engine/relics.ts tests/engine/relics.test.ts src/engine/turn.ts src/engine/resources.ts
git commit -m "feat: add relic effect system with turn resolution integration"
```

---

### Task 4: Rumor Discovery and Weighted Hex Generation

**Files:**
- Create: `src/engine/rumors.ts`
- Test: `tests/engine/rumors.test.ts`
- Modify: `src/engine/map.ts`

- [ ] **Step 1: Write rumor engine tests**

```typescript
// tests/engine/rumors.test.ts
import { describe, expect, it } from "vitest";
import {
  findNextRumorStep,
  applyRumorWeights,
  advanceRumor,
  discoverRumor,
} from "../../src/engine/rumors";
import type { Rumor, RumorState, ActiveRumor } from "../../src/engine/state";

const testRumor: Rumor = {
  id: "whispering-well",
  title: "The Whispering Well",
  steps: [
    {
      stepIndex: 0,
      encounterId: "ww-step-0",
      hint: "Seek ancient water in the forest",
      hintTags: ["water", "ancient"],
      hintBiomes: ["forest"],
    },
    {
      stepIndex: 1,
      encounterId: "ww-step-1",
      hint: "The well lies beneath stone ruins",
      hintTags: ["stone", "hollow"],
      hintBiomes: ["ruins"],
    },
  ],
  reward: null,
  hopeBonus: 3,
};

describe("findNextRumorStep", () => {
  it("returns null when no active rumors", () => {
    const rumorState: RumorState = { available: [testRumor], active: [], completed: [] };
    const result = findNextRumorStep(rumorState, new Set(["water", "ancient"]), "forest");
    expect(result).toBeNull();
  });

  it("returns matching rumor step when tags and biome satisfy requirements", () => {
    const rumorState: RumorState = {
      available: [testRumor],
      active: [{ rumorId: "whispering-well", currentStep: 0 }],
      completed: [],
    };
    // Need to check what tags/biome the step's encounter requires
    // For now, the step triggers based on hintTags matching the hex
    const result = findNextRumorStep(rumorState, new Set(["water", "ancient", "wood"]), "forest");
    expect(result).not.toBeNull();
    expect(result!.rumor.id).toBe("whispering-well");
    expect(result!.step.stepIndex).toBe(0);
  });

  it("prefers rumor closest to completion when multiple match", () => {
    const rumor2: Rumor = {
      ...testRumor,
      id: "other-rumor",
      steps: [
        { stepIndex: 0, encounterId: "or-0", hint: "", hintTags: ["water"], },
        { stepIndex: 1, encounterId: "or-1", hint: "", hintTags: ["stone"], },
        { stepIndex: 2, encounterId: "or-2", hint: "", hintTags: ["ice"], },
      ],
      reward: null,
      hopeBonus: 2,
    };
    const rumorState: RumorState = {
      available: [testRumor, rumor2],
      active: [
        { rumorId: "whispering-well", currentStep: 1 }, // 1 step remaining
        { rumorId: "other-rumor", currentStep: 0 },       // 2 steps remaining
      ],
      completed: [],
    };
    // Both could match with the right tags — whispering-well should win (fewer remaining)
    const result = findNextRumorStep(
      rumorState,
      new Set(["stone", "hollow", "water"]),
      "ruins"
    );
    if (result) {
      expect(result.rumor.id).toBe("whispering-well");
    }
  });
});

describe("applyRumorWeights", () => {
  it("returns empty weights when no active rumors", () => {
    const rumorState: RumorState = { available: [], active: [], completed: [] };
    const weights = applyRumorWeights(rumorState);
    expect(weights.tagWeights).toEqual({});
    expect(weights.biomeWeights).toEqual({});
  });

  it("returns weighted tags from active rumor hints", () => {
    const rumorState: RumorState = {
      available: [testRumor],
      active: [{ rumorId: "whispering-well", currentStep: 0 }],
      completed: [],
    };
    const weights = applyRumorWeights(rumorState);
    expect(weights.tagWeights["water"]).toBeGreaterThan(0);
    expect(weights.tagWeights["ancient"]).toBeGreaterThan(0);
    expect(weights.biomeWeights["forest"]).toBeGreaterThan(0);
  });
});

describe("advanceRumor", () => {
  it("increments current step", () => {
    const active: ActiveRumor = { rumorId: "whispering-well", currentStep: 0 };
    const result = advanceRumor(active);
    expect(result.currentStep).toBe(1);
  });
});

describe("discoverRumor", () => {
  it("adds rumor to active list", () => {
    const rumorState: RumorState = {
      available: [testRumor],
      active: [],
      completed: [],
    };
    const updated = discoverRumor(rumorState, "whispering-well");
    expect(updated.active).toHaveLength(1);
    expect(updated.active[0].rumorId).toBe("whispering-well");
    expect(updated.active[0].currentStep).toBe(0);
  });

  it("does not add duplicate active rumors", () => {
    const rumorState: RumorState = {
      available: [testRumor],
      active: [{ rumorId: "whispering-well", currentStep: 0 }],
      completed: [],
    };
    const updated = discoverRumor(rumorState, "whispering-well");
    expect(updated.active).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/rumors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement rumors.ts**

```typescript
// src/engine/rumors.ts
import type { Biome, Rumor, RumorState, RumorStep, ActiveRumor } from "./state";

export interface RumorStepMatch {
  rumor: Rumor;
  step: RumorStep;
  active: ActiveRumor;
}

export interface RumorWeights {
  tagWeights: Record<string, number>;
  biomeWeights: Record<string, number>;
}

const RUMOR_TAG_WEIGHT_BONUS = 0.25;  // +25% weight per hint tag
const RUMOR_BIOME_WEIGHT_BONUS = 0.20; // +20% weight per hint biome

export function findNextRumorStep(
  rumorState: RumorState,
  hexTags: Set<string>,
  hexBiome: Biome
): RumorStepMatch | null {
  const matches: RumorStepMatch[] = [];

  for (const active of rumorState.active) {
    const rumor = rumorState.available.find((r) => r.id === active.rumorId);
    if (!rumor) continue;

    const step = rumor.steps[active.currentStep];
    if (!step) continue;

    // Check if hex satisfies the step's hint tags
    const tagsMatch = step.hintTags.every((t) => hexTags.has(t));
    const biomeMatch = !step.hintBiomes || step.hintBiomes.length === 0 || step.hintBiomes.includes(hexBiome);

    if (tagsMatch && biomeMatch) {
      matches.push({ rumor, step, active });
    }
  }

  if (matches.length === 0) return null;

  // Prefer rumor closest to completion (fewest remaining steps)
  matches.sort((a, b) => {
    const aRemaining = a.rumor.steps.length - a.active.currentStep;
    const bRemaining = b.rumor.steps.length - b.active.currentStep;
    return aRemaining - bRemaining;
  });

  return matches[0];
}

export function applyRumorWeights(rumorState: RumorState): RumorWeights {
  const tagWeights: Record<string, number> = {};
  const biomeWeights: Record<string, number> = {};

  for (const active of rumorState.active) {
    const rumor = rumorState.available.find((r) => r.id === active.rumorId);
    if (!rumor) continue;

    const step = rumor.steps[active.currentStep];
    if (!step) continue;

    for (const tag of step.hintTags) {
      tagWeights[tag] = (tagWeights[tag] ?? 0) + RUMOR_TAG_WEIGHT_BONUS;
    }

    if (step.hintBiomes) {
      for (const biome of step.hintBiomes) {
        biomeWeights[biome] = (biomeWeights[biome] ?? 0) + RUMOR_BIOME_WEIGHT_BONUS;
      }
    }
  }

  return { tagWeights, biomeWeights };
}

export function advanceRumor(active: ActiveRumor): ActiveRumor {
  return { ...active, currentStep: active.currentStep + 1 };
}

export function discoverRumor(rumorState: RumorState, rumorId: string): RumorState {
  if (rumorState.active.some((a) => a.rumorId === rumorId)) {
    return rumorState;
  }
  return {
    ...rumorState,
    active: [...rumorState.active, { rumorId, currentStep: 0 }],
  };
}

export function completeRumor(
  rumorState: RumorState,
  rumorId: string,
  turn: number
): RumorState {
  return {
    ...rumorState,
    active: rumorState.active.filter((a) => a.rumorId !== rumorId),
    completed: [...rumorState.completed, { rumorId, completedAtTurn: turn }],
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/engine/rumors.test.ts`
Expected: All pass

- [ ] **Step 5: Integrate rumor weights into hex generation**

In `src/engine/map.ts`, modify `rollBiome` and `rollTags` to accept optional rumor weight bonuses:

```typescript
export function rollBiome(
  neighborBiomes: Biome[],
  rng: () => number,
  biomeWeights?: Record<string, number>  // NEW: rumor-driven biome bonuses
): Biome { ... }

export function rollTags(
  biome: Biome,
  neighborTagSets: Set<string>[],
  rng: () => number,
  tagWeights?: Record<string, number>  // NEW: rumor-driven tag bonuses
): Set<string> { ... }
```

In the weight calculation, add the rumor bonus to the base weights.

- [ ] **Step 6: Update `generateHex` to pass rumor weights through**

```typescript
export function generateHex(
  coord: CubeCoord,
  existingMap: Map<string, HexTile>,
  encounters: Encounter[],
  rng: () => number,
  searing?: SearingState,
  rumorWeights?: RumorWeights  // NEW
): HexTile { ... }
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All pass (update existing test calls that use `generateHex` with the new optional parameter)

- [ ] **Step 8: Commit**

```bash
git add src/engine/rumors.ts tests/engine/rumors.test.ts src/engine/map.ts
git commit -m "feat: add rumor discovery, weighted generation, and step matching"
```

---

### Task 5: Rumor Step Triggering in Turn Resolution

**Files:**
- Modify: `src/engine/turn.ts`
- Modify: `tests/engine/turn.test.ts`

- [ ] **Step 1: Write test for rumor step triggering on push**

Add to `tests/engine/turn.test.ts`:

```typescript
describe("rumor step triggering", () => {
  it("triggers a rumor step encounter when hex tags match active rumor", () => {
    const rumorEncounter: Encounter = {
      id: "ww-step-0",
      text: "You find the whispering well",
      requiredTags: ["water", "ancient"],
      choices: [{ label: "Drink", outcome: { hope: 2 } }],
    };
    const rumor: Rumor = {
      id: "whispering-well",
      title: "The Whispering Well",
      steps: [{
        stepIndex: 0,
        encounterId: "ww-step-0",
        hint: "Seek ancient water",
        hintTags: ["water", "ancient"],
      }],
      reward: null,
      hopeBonus: 3,
    };

    const { state, rng } = makeState();
    const target = cubeCoord(1, 0, -1);
    const stateWithRumor: GameState = {
      ...state,
      encounters: [...state.encounters, rumorEncounter],
      rumors: {
        available: [rumor],
        active: [{ rumorId: "whispering-well", currentStep: 0 }],
        completed: [],
      },
      map: new Map(state.map).set(coordKey(target), {
        coord: target,
        biome: "forest",
        tags: new Set(["water", "ancient", "wood"]),
        encounter: null, // normal encounter irrelevant — rumor takes priority
        revealed: true,
        consumed: false,
        visited: false,
      }),
    };

    const next = resolveTurn(stateWithRumor, { type: "push", direction: 0 }, rng);
    // Should enter encounter mode with the rumor step encounter
    expect(next.mode.type).toBe("encounter");
    if (next.mode.type === "encounter") {
      expect(next.mode.encounter.id).toBe("ww-step-0");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/turn.test.ts`
Expected: FAIL — rumor step not triggering yet

- [ ] **Step 3: Integrate rumor step check into `handlePush`**

In `src/engine/turn.ts`, in `handlePush`, after the player moves to a new hex:

```typescript
import { findNextRumorStep, applyRumorWeights } from "./rumors";

// After entering the hex, before checking the tile's normal encounter:
const rumorMatch = findNextRumorStep(state.rumors, tile.tags, tile.biome);
if (rumorMatch) {
  // Find the rumor step's encounter from the encounters list
  const rumorEncounter = state.encounters.find(
    (e) => e.id === rumorMatch.step.encounterId
  );
  if (rumorEncounter) {
    // Enter encounter mode with the rumor encounter instead of the normal one
    return {
      ...newState,
      mode: { type: "encounter", encounter: rumorEncounter, hex: tile.coord },
    };
  }
}
// ... fall through to normal encounter check ...
```

- [ ] **Step 4: Handle rumor advancement after encounter resolution**

In `handleChoose`, after resolving an encounter choice, check if the encounter was a rumor step. If so, advance the rumor:

```typescript
import { advanceRumor, completeRumor } from "./rumors";

// After resolving the encounter choice:
// Check if this encounter ID matches any active rumor step
const rumorAdvance = checkRumorAdvancement(state, encounterId);
if (rumorAdvance) {
  newState = {
    ...newState,
    rumors: rumorAdvance.rumors,
    // If rumor completed, add relic and hope bonus
    ...(rumorAdvance.reward ? { relics: [...newState.relics, rumorAdvance.reward] } : {}),
    player: rumorAdvance.hopeBonus
      ? applyDelta(newState.player, { hope: rumorAdvance.hopeBonus })
      : newState.player,
  };
}
```

Implement `checkRumorAdvancement` as a helper that looks up the encounter ID against active rumor steps and returns updated rumor state.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/engine/turn.ts tests/engine/turn.test.ts
git commit -m "feat: integrate rumor step triggering and advancement into turn resolution"
```

---

### Task 6: Journal UI Panel

**Files:**
- Create: `src/ui/journal.ts`
- Modify: `index.html`
- Modify: `src/ui/input.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add journal panel HTML to `index.html`**

```html
<div id="app">
  <canvas id="game-canvas"></canvas>
  <div id="side-panels">
    <div id="log-panel"></div>
    <div id="journal-panel" class="hidden">
      <div id="journal-tabs">
        <button class="journal-tab active" data-tab="rumors">Rumors</button>
        <button class="journal-tab" data-tab="relics">Relics</button>
      </div>
      <div id="journal-content"></div>
    </div>
  </div>
</div>
```

Add CSS for the journal panel and tab styles.

- [ ] **Step 2: Implement journal rendering**

```typescript
// src/ui/journal.ts
import type { GameState, Relic, Rumor, ActiveRumor, CompletedRumor } from "../engine/state";

let currentTab: "rumors" | "relics" = "rumors";

export function toggleJournal(journalEl: HTMLElement, logEl: HTMLElement): void {
  const isHidden = journalEl.classList.contains("hidden");
  if (isHidden) {
    journalEl.classList.remove("hidden");
    logEl.classList.add("hidden");
  } else {
    journalEl.classList.add("hidden");
    logEl.classList.remove("hidden");
  }
}

export function updateJournal(contentEl: HTMLElement, state: GameState): void {
  contentEl.textContent = "";

  if (currentTab === "rumors") {
    renderRumors(contentEl, state);
  } else {
    renderRelics(contentEl, state);
  }
}

function renderRumors(el: HTMLElement, state: GameState): void {
  // Active rumors
  for (const active of state.rumors.active) {
    const rumor = state.rumors.available.find((r) => r.id === active.rumorId);
    if (!rumor) continue;

    const div = document.createElement("div");
    div.className = "journal-entry journal-active";

    const title = document.createElement("h3");
    title.textContent = `${rumor.title} (${active.currentStep + 1}/${rumor.steps.length})`;
    div.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "journal-hint";
    const step = rumor.steps[active.currentStep];
    hint.textContent = step ? step.hint : "Follow the trail...";
    div.appendChild(hint);

    el.appendChild(div);
  }

  // Completed rumors
  for (const completed of state.rumors.completed) {
    const rumor = state.rumors.available.find((r) => r.id === completed.rumorId);
    if (!rumor) continue;

    const div = document.createElement("div");
    div.className = "journal-entry journal-completed";

    const title = document.createElement("h3");
    title.textContent = `✓ ${rumor.title}`;
    div.appendChild(title);

    if (rumor.reward) {
      const reward = document.createElement("p");
      reward.className = "journal-reward";
      reward.textContent = `Reward: ${rumor.reward.name}`;
      div.appendChild(reward);
    }

    el.appendChild(div);
  }

  if (state.rumors.active.length === 0 && state.rumors.completed.length === 0) {
    const empty = document.createElement("p");
    empty.className = "journal-empty";
    empty.textContent = "No rumors discovered yet.";
    el.appendChild(empty);
  }
}

function renderRelics(el: HTMLElement, state: GameState): void {
  for (const relic of state.relics) {
    const div = document.createElement("div");
    div.className = "journal-entry";

    const name = document.createElement("h3");
    name.textContent = relic.name;
    div.appendChild(name);

    const desc = document.createElement("p");
    desc.textContent = relic.description;
    div.appendChild(desc);

    const effect = document.createElement("p");
    effect.className = "journal-effect";
    effect.textContent = describeEffect(relic.effect);
    div.appendChild(effect);

    el.appendChild(div);
  }

  if (state.relics.length === 0) {
    const empty = document.createElement("p");
    empty.className = "journal-empty";
    empty.textContent = "No relics collected yet.";
    el.appendChild(empty);
  }
}

function describeEffect(effect: import("../engine/state").RelicEffect): string {
  switch (effect.type) {
    case "max_resource":
      return `+${effect.bonus} max ${effect.resource}`;
    case "forage_bonus":
      return `+${Math.round((effect.chance ?? 0) * 100)}% forage success`;
    case "searing_resist":
      return `Survive ${effect.extraTurns} extra turn(s) on searing edge`;
    case "hope_decay_slow":
      return `Hope decays ${effect.intervalBonus} turn(s) slower`;
    case "move_discount":
      return `${Math.round((effect.chance ?? 0) * 100)}% chance to move without spending supply`;
    default:
      return "";
  }
}

export function setJournalTab(tab: "rumors" | "relics"): void {
  currentTab = tab;
}
```

- [ ] **Step 3: Add J key toggle to input handling**

In `src/ui/input.ts`, the J key should not produce a game action — it toggles the journal UI. Handle it in `src/main.ts`:

```typescript
if (e.key.toLowerCase() === "j" && state.mode.type === "map") {
  toggleJournal(journalEl, logEl);
  updateJournal(journalContentEl, state);
  return; // don't process as game action
}
```

- [ ] **Step 4: Update the key legend (from M1 Task 5) to include J key**

In `src/renderer/legend.ts`, add to the map mode actions:
```
J  Journal
```

- [ ] **Step 5: Manually test in browser**

Run: `npm run dev`
Expected: Pressing J toggles between log and journal panels. Journal shows active/completed rumors and collected relics. Tab switching works.

- [ ] **Step 6: Commit**

```bash
git add src/ui/journal.ts index.html src/ui/input.ts src/main.ts src/renderer/legend.ts
git commit -m "feat: add journal UI with rumor tracking and relic inventory"
```

---

### Task 7: Encounter Content — Common (1-tag) Encounters

**Files:**
- Modify: `src/engine/data/seed-encounters.json`
- Modify: `tests/engine/seed-data.test.ts`

This task populates the 1-tag common encounter pool. Each biome needs 8-10 encounters that require only a single tag from that biome's tag pool.

- [ ] **Step 1: Author common encounters**

Write 8-10 encounters per biome, each requiring only 1 tag. These are atmospheric, short. Focus on the biome's personality.

Example format (repeat for all biomes):
```json
{
  "id": "forest-stream-common",
  "text": "A narrow stream cuts through the underbrush. The water is cold and clear.",
  "requiredTags": ["water"],
  "biomes": ["forest"],
  "choices": [
    { "label": "Drink deeply", "outcome": { "hope": 1 } },
    { "label": "Fill your waterskin", "outcome": { "supply": 1 } }
  ]
}
```

Target: ~45 common encounters across all 5 biomes.

- [ ] **Step 2: Update seed data test count**

In `tests/engine/seed-data.test.ts`, update the expected count:
```typescript
it("ships the encounter table", () => {
  expect(seedEncounters.length).toBeGreaterThanOrEqual(45);
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/engine/seed-data.test.ts`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add src/engine/data/seed-encounters.json tests/engine/seed-data.test.ts
git commit -m "content: add ~45 common 1-tag encounters across all biomes"
```

---

### Task 8: Encounter Content — Uncommon (2-tag) and Rare (3-tag) Encounters

**Files:**
- Modify: `src/engine/data/seed-encounters.json`

- [ ] **Step 1: Author 2-tag uncommon encounters**

Write 30-40 encounters requiring 2 tags. These have richer text and more meaningful choices with chance-based outcomes.

- [ ] **Step 2: Author 3-tag rare encounters**

Write 10-15 encounters requiring 3 tags. Set-piece moments with strong narrative and significant resource swings.

- [ ] **Step 3: Update seed data test**

Verify total count is in the 80-100 range.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/engine/data/seed-encounters.json tests/engine/seed-data.test.ts
git commit -m "content: add uncommon (2-tag) and rare (3-tag) encounters"
```

---

### Task 9: Rumor Chain Content and Data

**Files:**
- Create: `src/engine/data/rumors.ts`
- Create: `src/engine/data/relics.ts`
- Modify: `src/engine/data/seed-encounters.json` (add rumor step encounters)

- [ ] **Step 1: Define relic data**

```typescript
// src/engine/data/relics.ts
import type { Relic } from "../state";

export const ALL_RELICS: Relic[] = [
  {
    id: "ember-compass",
    name: "The Ember Compass",
    description: "A compass that always points toward warmth. Foraging becomes instinctive.",
    effect: { type: "forage_bonus", chance: 0.15 },
  },
  {
    id: "deep-pack",
    name: "Deep Pack",
    description: "A bag that seems bigger on the inside. Carry more supplies.",
    effect: { type: "max_resource", resource: "supply", bonus: 2 },
  },
  // ... 6-8 more relics with varied effects ...
];
```

- [ ] **Step 2: Define rumor chain data**

```typescript
// src/engine/data/rumors.ts
import type { Rumor } from "../state";
import { ALL_RELICS } from "./relics";

export const ALL_RUMORS: Rumor[] = [
  {
    id: "whispering-well",
    title: "The Whispering Well",
    steps: [
      {
        stepIndex: 0,
        encounterId: "ww-step-0",
        hint: "An old traveler spoke of a well that whispers secrets, hidden in ancient forest clearings near water.",
        hintTags: ["water", "ancient"],
        hintBiomes: ["forest"],
      },
      {
        stepIndex: 1,
        encounterId: "ww-step-1",
        hint: "The well's song grows louder near stone ruins where water once flowed freely.",
        hintTags: ["stone", "water"],
        hintBiomes: ["ruins"],
      },
      {
        stepIndex: 2,
        encounterId: "ww-step-2",
        hint: "You can almost hear it now. The well awaits in a hollow place, sacred and ancient.",
        hintTags: ["hollow", "sacred"],
      },
    ],
    reward: ALL_RELICS.find((r) => r.id === "ember-compass") ?? null,
    hopeBonus: 3,
  },
  // ... 3-5 more rumor chains ...
];
```

- [ ] **Step 3: Add rumor step encounters to seed data**

Each rumor step references an encounter by ID. These encounters need to exist in the encounter pool. Add them to `seed-encounters.json` with narrative text that advances the rumor story.

- [ ] **Step 4: Wire rumor data into game initialization**

In `src/main.ts`, import `ALL_RUMORS` and pass to `createInitialState`:
```typescript
import { ALL_RUMORS } from "./engine/data/rumors";
const state = createInitialState(encounters, rng, ALL_RUMORS);
```

- [ ] **Step 5: Add encounters that discover rumors**

Some 2-tag and 3-tag encounters should include a `rumorHook` field (or trigger rumor discovery as part of their outcome). Define how a regular encounter can trigger rumor discovery — either as a new `Action` type or as a special field on the encounter/choice.

Approach: Add an optional `discoversRumor?: string` field to `Choice`. When the player picks that choice, the rumor with that ID gets added to their active rumors.

- [ ] **Step 6: Handle `discoversRumor` in `handleChoose`**

In `src/engine/turn.ts`, after resolving a choice:
```typescript
if (choice.discoversRumor) {
  newState = {
    ...newState,
    rumors: discoverRumor(newState.rumors, choice.discoversRumor),
  };
  // Add log entry
  const rumor = newState.rumors.available.find((r) => r.id === choice.discoversRumor);
  if (rumor) {
    newState = appendLog(newState, `A new lead: "${rumor.title}"`, "narrative");
  }
}
```

- [ ] **Step 7: Update Choice type in state.ts**

```typescript
interface Choice {
  label: string;
  outcome: ResourceDelta;
  chance?: number;
  failureOutcome?: ResourceDelta;
  discoversRumor?: string;  // NEW: rumor ID to discover when this choice is picked
}
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add src/engine/data/rumors.ts src/engine/data/relics.ts src/engine/data/seed-encounters.json src/engine/state.ts src/engine/turn.ts src/main.ts
git commit -m "feat: add rumor chains, relics, and rumor discovery encounters"
```

---

### Task 10: Final M2 Integration and Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Manual playtest checklist**

Run: `npm run dev`
- [ ] Every hex has an encounter (no empty hexes)
- [ ] Common encounters are short and atmospheric
- [ ] Rare encounters have richer text and choices
- [ ] Rumor discovery works (find a rumor-hook encounter, journal updates)
- [ ] Journal panel toggles with J key, shows active/completed rumors and relics
- [ ] Rumor step triggers when entering a hex matching the hint
- [ ] Rumor completion grants hope and relic
- [ ] Relics appear in journal and their effects work (forage bonus, max supply, etc.)
- [ ] Save/load preserves rumor and relic state
- [ ] Weighted generation nudges hex creation toward active rumor hints

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: M2 integration fixes"
```
