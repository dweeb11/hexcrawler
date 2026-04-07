import { describe, expect, it } from "vitest";

import { coordKey, cubeCoord, neighbor } from "../../src/engine/hex";
import { createInitialState, type Action, type Encounter, type GameState, type Relic, type Rumor } from "../../src/engine/state";
import { resolveTurn } from "../../src/engine/turn";
import { seededRng } from "../helpers";

function makeState(seed = 42): { state: GameState; rng: () => number } {
  const setupRng = seededRng(seed);
  return {
    state: createInitialState([], setupRng),
    rng: seededRng(seed + 1),
  };
}

describe("resolveTurn push flow", () => {
  it("moves the player, spends supply, and generates a hex", () => {
    const { state, rng } = makeState();
    const next = resolveTurn(state, { type: "push", direction: 0 }, rng);

    expect(next.player.supply).toBe(state.player.supply - 1);
    expect(coordKey(next.player.hex)).not.toBe(coordKey(state.player.hex));
    expect(next.map.has(coordKey(next.player.hex))).toBe(true);
    expect(next.turn).toBe(state.turn + 1);
  });

  it("marks the destination hex as visited after push", () => {
    const { state, rng } = makeState();
    const next = resolveTurn(state, { type: "push", direction: 0 }, rng);
    const destination = next.map.get(coordKey(next.player.hex));
    expect(destination?.visited).toBe(true);
  });

  it("refuses to move without supply", () => {
    const { state, rng } = makeState();
    const emptyState: GameState = {
      ...state,
      player: { ...state.player, supply: 0 },
    };
    const next = resolveTurn(emptyState, { type: "push", direction: 0 }, rng);

    expect(coordKey(next.player.hex)).toBe(coordKey(emptyState.player.hex));
    expect(next.log.length).toBeGreaterThan(emptyState.log.length);
  });

  it("moves without spending supply when a move-discount relic procs", () => {
    const { state } = makeState();
    const guaranteedFreeMoveRelic: Relic = {
      id: "free-step",
      name: "Free Step",
      description: "Move without spending supply.",
      effect: { type: "move_discount", chance: 1 },
    };
    const next = resolveTurn(
      {
        ...state,
        relics: [guaranteedFreeMoveRelic],
      },
      { type: "push", direction: 0 },
      () => 0,
    );

    expect(coordKey(next.player.hex)).not.toBe(coordKey(state.player.hex));
    expect(next.player.supply).toBe(state.player.supply);
  });
});

describe("resolveTurn pause flow", () => {
  it("enters camp mode for rest and forage", () => {
    const { state, rng } = makeState();
    const rested = resolveTurn(
      {
        ...state,
        player: { ...state.player, health: 2 },
      },
      { type: "pause", activity: "rest" },
      rng,
    );
    const foraged = resolveTurn(state, { type: "pause", activity: "forage" }, rng);

    expect(rested.mode.type).toBe("camp");
    expect(foraged.mode.type).toBe("camp");
  });
});

describe("resolveTurn encounter flow", () => {
  it("enters encounter mode on encounter hexes", () => {
    const encounter: Encounter = {
      id: "test",
      text: "Test encounter",
      requiredTags: [],
      choices: [{ label: "OK", outcome: { hope: 1 } }],
    };
    const { state, rng } = makeState();
    const target = neighbor(state.player.hex, 0);
    const next = resolveTurn(
      {
        ...state,
        map: new Map(state.map).set(coordKey(target), {
          coord: target,
          biome: "forest",
          tags: new Set(["wood", "water"]),
          encounter,
          revealed: true,
          consumed: false,
          visited: false,
        }),
      },
      { type: "push", direction: 0 },
      rng,
    );

    expect(next.mode.type).toBe("encounter");
  });

  it("resolves encounter choices and returns to map", () => {
    const encounter: Encounter = {
      id: "test",
      text: "Test encounter",
      requiredTags: [],
      choices: [{ label: "OK", outcome: { hope: 1 } }],
    };
    const { state, rng } = makeState();
    const next = resolveTurn(
      {
        ...state,
        player: { ...state.player, hope: 3 },
        mode: { type: "encounter", encounter, hex: cubeCoord(1, 0, -1) },
      },
      { type: "choose", choiceIndex: 0 },
      rng,
    );

    expect(next.mode.type).toBe("map");
    expect(next.player.hope).toBeGreaterThan(3);
  });
});

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
    const target = neighbor(state.player.hex, 0);
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

describe("resolveTurn searing and loss flow", () => {
  it("advances the searing on the configured turn", () => {
    const { state, rng } = makeState();
    const next = resolveTurn({ ...state, turn: 3 }, { type: "push", direction: 0 }, rng);
    expect(next.searing.line).not.toBe(state.searing.line);
  });

  it("triggers game over when resources are depleted", () => {
    const { state, rng } = makeState();
    const next = resolveTurn(
      {
        ...state,
        player: { ...state.player, health: 0 },
      },
      { type: "push", direction: 0 },
      rng,
    );

    expect(next.status).toBe("lost");
    expect(next.mode.type).toBe("gameover");
  });

  it("triggers immediate game over when entering a consumed hex with an encounter", () => {
    const encounter: Encounter = {
      id: "test",
      text: "Too late.",
      requiredTags: [],
      choices: [{ label: "OK", outcome: {} }],
    };
    const { state, rng } = makeState();
    const target = neighbor(state.player.hex, 0);
    const next = resolveTurn(
      {
        ...state,
        searing: {
          ...state.searing,
          axis: "q",
          direction: 1,
          line: target.q,
        },
        map: new Map(state.map).set(coordKey(target), {
          coord: target,
          biome: "forest",
          tags: new Set(["wood"]),
          encounter,
          revealed: true,
          consumed: true,
          visited: false,
        }),
      },
      { type: "push", direction: 0 },
      rng,
    );

    expect(next.status).toBe("lost");
    expect(next.mode.type).toBe("gameover");
  });
});
