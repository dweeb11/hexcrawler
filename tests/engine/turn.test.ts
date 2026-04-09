import { describe, expect, it } from "vitest";

import { coordKey, cubeCoord, neighbor } from "../../src/engine/hex";
import {
  createInitialState,
  type Action,
  type Encounter,
  type GameState,
  type Relic,
  type Rumor,
} from "../../src/engine/state";
import { resolveTurn } from "../../src/engine/turn";
import { FROST_PROXIMITY_THRESHOLDS, GEAR_RELIC_THRESHOLD, PILLARS_DISTANCE_THRESHOLD } from "../../src/engine/win";
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

  it("biases generated hex tags toward active rumor hints", () => {
    const rumor: Rumor = {
      id: "water-lead",
      title: "Whispers of Water",
      steps: [
        {
          stepIndex: 0,
          encounterId: "water-step-0",
          hint: "Follow signs of water",
          hintTags: ["water"],
        },
      ],
      reward: null,
      hopeBonus: 1,
    };
    const encounter: Encounter = {
      id: "always",
      text: "Always available",
      requiredTags: [],
      choices: [{ label: "Continue", outcome: {} }],
    };
    const { state } = makeState();
    const baseState: GameState = { ...state, encounters: [encounter] };
    const weightedState: GameState = {
      ...baseState,
      rumors: {
        available: [rumor],
        active: [{ rumorId: "water-lead", currentStep: 0 }],
        completed: [],
      },
    };

    let baseWaterCount = 0;
    let weightedWaterCount = 0;

    for (let seed = 1; seed <= 200; seed += 1) {
      const baseNext = resolveTurn(baseState, { type: "push", direction: 0 }, seededRng(seed));
      const weightedNext = resolveTurn(weightedState, { type: "push", direction: 0 }, seededRng(seed));

      const baseTile = baseNext.map.get(coordKey(baseNext.player.hex));
      const weightedTile = weightedNext.map.get(coordKey(weightedNext.player.hex));

      if (baseTile?.tags.has("water")) baseWaterCount += 1;
      if (weightedTile?.tags.has("water")) weightedWaterCount += 1;
    }

    expect(weightedWaterCount).toBeGreaterThan(baseWaterCount);
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

  it("uses shadow encounter text at low Hope", () => {
    const encounter: Encounter = {
      id: "shadowed-test",
      text: "The path feels familiar.",
      shadowText: "The path tightens like a snare.",
      requiredTags: [],
      choices: [{ label: "OK", outcome: { hope: 1 } }],
    };
    const { state, rng } = makeState();
    const target = neighbor(state.player.hex, 0);
    const next = resolveTurn(
      {
        ...state,
        player: { ...state.player, hope: 2 },
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
    if (next.mode.type === "encounter") {
      expect(next.mode.encounter.text).toBe("The path tightens like a snare.");
    }
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

describe("rumor advancement on encounter resolution", () => {
  it("advances active rumor to the next step after resolving its encounter", () => {
    const firstStepEncounter: Encounter = {
      id: "ww-step-0",
      text: "You find the whispering well.",
      requiredTags: [],
      choices: [{ label: "Listen", outcome: {} }],
    };
    const rumor: Rumor = {
      id: "whispering-well",
      title: "The Whispering Well",
      steps: [
        {
          stepIndex: 0,
          encounterId: "ww-step-0",
          hint: "Seek ancient water",
          hintTags: ["water", "ancient"],
        },
        {
          stepIndex: 1,
          encounterId: "ww-step-1",
          hint: "Seek old stone",
          hintTags: ["stone"],
        },
      ],
      reward: null,
      hopeBonus: 2,
    };
    const { state, rng } = makeState();
    const inEncounter: GameState = {
      ...state,
      mode: { type: "encounter", encounter: firstStepEncounter, hex: cubeCoord(1, 0, -1) },
      rumors: {
        available: [rumor],
        active: [{ rumorId: "whispering-well", currentStep: 0 }],
        completed: [],
      },
    };

    const next = resolveTurn(inEncounter, { type: "choose", choiceIndex: 0 }, rng);

    expect(next.rumors.active).toEqual([{ rumorId: "whispering-well", currentStep: 1 }]);
    expect(next.rumors.completed).toEqual([]);
  });

  it("completes final rumor step and grants relic reward plus hope bonus", () => {
    const finalStepEncounter: Encounter = {
      id: "ww-step-1",
      text: "You unearth a relic from the well's chamber.",
      requiredTags: [],
      choices: [{ label: "Take it", outcome: {} }],
    };
    const relicReward: Relic = {
      id: "well-sigil",
      name: "Well Sigil",
      description: "An old token that strengthens resolve.",
      effect: {
        type: "max_resource",
        resource: "hope",
        bonus: 1,
      },
    };
    const rumor: Rumor = {
      id: "whispering-well",
      title: "The Whispering Well",
      steps: [
        {
          stepIndex: 0,
          encounterId: "ww-step-0",
          hint: "Seek ancient water",
          hintTags: ["water", "ancient"],
        },
        {
          stepIndex: 1,
          encounterId: "ww-step-1",
          hint: "Seek old stone",
          hintTags: ["stone"],
        },
      ],
      reward: relicReward,
      hopeBonus: 3,
    };
    const { state, rng } = makeState();
    const inFinalStep: GameState = {
      ...state,
      mode: { type: "encounter", encounter: finalStepEncounter, hex: cubeCoord(1, 0, -1) },
      player: { ...state.player, hope: 3 },
      rumors: {
        available: [rumor],
        active: [{ rumorId: "whispering-well", currentStep: 1 }],
        completed: [],
      },
      relics: [],
    };

    const next = resolveTurn(inFinalStep, { type: "choose", choiceIndex: 0 }, rng);

    expect(next.rumors.active).toEqual([]);
    expect(next.rumors.completed).toEqual([
      { rumorId: "whispering-well", completedAtTurn: inFinalStep.turn },
    ]);
    expect(next.relics).toContainEqual(relicReward);
    expect(next.player.hope).toBe(5);
  });
});

describe("resolveTurn searing and loss flow", () => {
  it("advances the searing on the configured turn", () => {
    const { state, rng } = makeState();
    const next = resolveTurn(
      { ...state, turn: state.searing.advanceRate - 1 },
      { type: "push", direction: 0 },
      rng
    );
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

  it("triggers game over immediately when the player is already on a consumed hex", () => {
    const { state, rng } = makeState();
    const next = resolveTurn(
      {
        ...state,
        player: { ...state.player, hex: { q: 0, r: 0, s: 0 } },
        searing: { ...state.searing, axis: "q", direction: 1, line: 0 },
      },
      { type: "pause", activity: "rest" },
      rng,
    );

    expect(next.status).toBe("lost");
    expect(next.mode.type).toBe("gameover");
    if (next.mode.type === "gameover") {
      expect(next.mode.reason).toContain("Searing catches you");
    }
  });
});

describe("frost proximity signals", () => {
  it("emits a frost log message when crossing into a new proximity band", () => {
    const { state, rng } = makeState();
    // Place the player just below band 1 threshold, facing the frost direction.
    // Use searing axis=q, direction=1, line=0 so distance = player.q - 0.
    // Band 1 fires at distance >= FROST_PROXIMITY_THRESHOLDS[0] (12).
    // Start at q = threshold - 1 (11), move to q = threshold (12).
    const band1 = FROST_PROXIMITY_THRESHOLDS[0];
    const startQ = band1 - 1;
    const startHex = cubeCoord(startQ, -startQ, 0);
    const destinationQ = band1;
    const destinationHex = cubeCoord(destinationQ, -destinationQ, 0);

    const logsBefore = state.log.length;
    const next = resolveTurn(
      {
        ...state,
        searing: { axis: "q", direction: 1, line: 0, advanceRate: 999 },
        player: { ...state.player, hex: startHex },
        map: new Map(state.map)
          .set(coordKey(startHex), {
            coord: startHex,
            biome: "wastes",
            tags: new Set(),
            encounter: null,
            revealed: true,
            consumed: false,
            visited: true,
          })
          .set(coordKey(destinationHex), {
            coord: destinationHex,
            biome: "wastes",
            tags: new Set(),
            encounter: null,
            revealed: true,
            consumed: false,
            visited: false,
          }),
      },
      { type: "push", direction: 0 },
      rng,
    );

    const frostLogs = next.log.filter((e) => e.type === "narrative" && e.text.includes("chill"));
    expect(frostLogs.length).toBeGreaterThan(0);
    expect(next.log.length).toBeGreaterThan(logsBefore);
  });

  it("does not emit a frost signal when moving within the same band", () => {
    const { state, rng } = makeState();
    // Band 1 is distance 12-14. Move from 12 to 13 — same band, no new message.
    const band1 = FROST_PROXIMITY_THRESHOLDS[0];
    const startQ = band1;
    const startHex = cubeCoord(startQ, -startQ, 0);
    const destinationQ = band1 + 1;
    const destinationHex = cubeCoord(destinationQ, -destinationQ, 0);

    const stateInBand: GameState = {
      ...state,
      searing: { axis: "q", direction: 1, line: 0, advanceRate: 999 },
      player: { ...state.player, hex: startHex },
      map: new Map(state.map)
        .set(coordKey(startHex), {
          coord: startHex,
          biome: "wastes",
          tags: new Set(),
          encounter: null,
          revealed: true,
          consumed: false,
          visited: true,
        })
        .set(coordKey(destinationHex), {
          coord: destinationHex,
          biome: "wastes",
          tags: new Set(),
          encounter: null,
          revealed: true,
          consumed: false,
          visited: false,
        }),
    };

    const next = resolveTurn(stateInBand, { type: "push", direction: 0 }, rng);
    const frostLogs = next.log.filter((e) => e.type === "narrative" && (e.text.includes("chill") || e.text.includes("crystals") || e.text.includes("plummets")));
    expect(frostLogs.length).toBe(0);
  });
});

describe("resolveTurn win flow", () => {
  it("wins when the player crosses the Pillars of Frost threshold", () => {
    const { state, rng } = makeState();
    const thresholdQ = state.searing.line + PILLARS_DISTANCE_THRESHOLD;
    const startHex = cubeCoord(thresholdQ - 1, -(thresholdQ - 1), 0);

    const next = resolveTurn(
      {
        ...state,
        searing: { ...state.searing, axis: "q", direction: 1, advanceRate: 999 },
        player: { ...state.player, hex: startHex },
        map: new Map(state.map).set(coordKey(startHex), {
          coord: startHex,
          biome: "forest",
          tags: new Set(["wood"]),
          encounter: null,
          revealed: true,
          consumed: false,
          visited: true,
        }),
      },
      { type: "push", direction: 0 },
      rng,
    );

    expect(next.status).toBe("won");
    expect(next.mode.type).toBe("gameover");
    if (next.mode.type === "gameover") {
      expect(next.mode.reason.toLowerCase()).toContain("pillars of frost");
    }
  });

  it("wins when relic count reaches the Gear threshold", () => {
    const { state, rng } = makeState();
    const relics: Relic[] = Array.from({ length: GEAR_RELIC_THRESHOLD }, (_, i) => ({
      id: `gear-${i}`,
      name: `Gear ${i}`,
      description: "Ritual relic",
      effect: { type: "forage_bonus", bonus: 1 },
    }));
    const encounter: Encounter = {
      id: "gear-ritual-prep",
      text: "The ritual is within reach.",
      requiredTags: [],
      choices: [{ label: "Continue", outcome: {} }],
    };

    const next = resolveTurn(
      {
        ...state,
        relics,
        mode: { type: "encounter", encounter, hex: cubeCoord(0, 0, 0) },
      },
      { type: "choose", choiceIndex: 0 },
      rng,
    );

    expect(next.status).toBe("won");
    expect(next.mode.type).toBe("gameover");
    if (next.mode.type === "gameover") {
      expect(next.mode.reason.toLowerCase()).toContain("gear");
    }
  });

  it("sets outcome=win_pillars on Pillars of Frost win", () => {
    const { state, rng } = makeState();
    const thresholdQ = state.searing.line + PILLARS_DISTANCE_THRESHOLD;
    const startHex = cubeCoord(thresholdQ - 1, -(thresholdQ - 1), 0);
    const next = resolveTurn(
      {
        ...state,
        searing: { ...state.searing, axis: "q", direction: 1, advanceRate: 999 },
        player: { ...state.player, hex: startHex },
        map: new Map(state.map).set(coordKey(startHex), {
          coord: startHex,
          biome: "forest",
          tags: new Set(["wood"]),
          encounter: null,
          revealed: true,
          consumed: false,
          visited: true,
        }),
      },
      { type: "push", direction: 0 },
      rng,
    );
    expect(next.status).toBe("won");
    if (next.mode.type === "gameover") {
      expect(next.mode.outcome).toBe("win_pillars");
    }
  });

  it("sets outcome=loss_health on health depletion", () => {
    const { state, rng } = makeState();
    const next = resolveTurn(
      { ...state, player: { ...state.player, health: 0 } },
      { type: "push", direction: 0 },
      rng,
    );
    expect(next.status).toBe("lost");
    if (next.mode.type === "gameover") {
      expect(next.mode.outcome).toBe("loss_health");
    }
  });
});

describe("stats tracking", () => {
  it("increments hexesExplored when entering a new hex", () => {
    const { state, rng } = makeState();
    expect(state.stats.hexesExplored).toBe(0);
    const next = resolveTurn(state, { type: "push", direction: 0 }, rng);
    expect(next.stats.hexesExplored).toBe(1);
  });

  it("does not increment hexesExplored when revisiting a hex", () => {
    const { state, rng } = makeState();
    const target = neighbor(state.player.hex, 0);
    const targetKey = coordKey(target);
    const visitedMap = new Map(state.map).set(targetKey, {
      coord: target,
      biome: "forest",
      tags: new Set(["wood"]),
      encounter: null,
      revealed: true,
      consumed: false,
      visited: true,
    });
    const alreadyVisited = { ...state, map: visitedMap };
    const next = resolveTurn(alreadyVisited, { type: "push", direction: 0 }, rng);
    expect(next.stats.hexesExplored).toBe(0);
  });

  it("increments encountersResolved when choosing in an encounter", () => {
    const encounter: Encounter = {
      id: "stat-test",
      text: "A choice awaits.",
      requiredTags: [],
      choices: [{ label: "Choose", outcome: {} }],
    };
    const { state, rng } = makeState();
    expect(state.stats.encountersResolved).toBe(0);
    const next = resolveTurn(
      { ...state, mode: { type: "encounter", encounter, hex: state.player.hex } },
      { type: "choose", choiceIndex: 0 },
      rng,
    );
    expect(next.stats.encountersResolved).toBe(1);
  });

  it("initializes all stats to zero", () => {
    const { state } = makeState();
    expect(state.stats).toEqual({
      hexesExplored: 0,
      encountersResolved: 0,
      rumorsDiscovered: 0,
      rumorsCompleted: 0,
      relicsCollected: 0,
    });
  });
});
