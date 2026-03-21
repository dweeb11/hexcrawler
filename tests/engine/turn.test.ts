import { describe, expect, it } from "vitest";

import { coordKey, cubeCoord } from "../../src/engine/hex";
import { createInitialState, type Action, type Encounter, type GameState } from "../../src/engine/state";
import { resolveTurn } from "../../src/engine/turn";

function seededRng(seed: number) {
  let value = seed;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

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
    const target = cubeCoord(1, 0, -1);
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
});
