import { describe, expect, it } from "vitest";

import { coordKey, cubeCoord, neighbor } from "../../src/engine/hex";
import { pickEncounter } from "../../src/engine/map";
import {
  shouldBoostRumorDiscovery,
  discoveryEncounterWeight,
  encounterHasDiscoveryChoice,
} from "../../src/engine/rumors";
import {
  createInitialState,
  deserializeState,
  type Encounter,
  type GameState,
  type Relic,
  type Rumor,
  type RumorState,
} from "../../src/engine/state";
import { resolveTurn } from "../../src/engine/turn";
import { seededRng } from "../helpers";

const relicReward: Relic = {
  id: "well-sigil",
  name: "Well Sigil",
  description: "A token from the whispering well.",
  effect: { type: "max_resource", resource: "hope", bonus: 1 },
};

function makeRumor(overrides: Partial<Rumor> = {}): Rumor {
  return {
    id: "whispering-well",
    title: "The Whispering Well",
    premise: "A well whispers beneath the forest.",
    steps: [
      {
        stepIndex: 0,
        stepTitle: "Forest Marker",
        encounterId: "ww-step-0",
        journalHint: "Seek ancient water in the forest",
        hintTags: ["water", "ancient"],
        hintBiomes: ["forest"],
      },
      {
        stepIndex: 1,
        stepTitle: "Buried Conduit",
        encounterId: "ww-step-1",
        journalHint: "Seek old stone beneath the ruins",
        hintTags: ["stone"],
        hintBiomes: ["ruins"],
      },
    ],
    reward: relicReward,
    hopeBonus: 3,
    ...overrides,
  };
}

describe("shouldBoostRumorDiscovery", () => {
  it("returns true when the player has no rumor progress", () => {
    const rumorState: RumorState = { available: [], active: [], completed: [] };
    expect(shouldBoostRumorDiscovery(rumorState)).toBe(true);
  });

  it("returns false after the first rumor is discovered", () => {
    const rumorState: RumorState = {
      available: [makeRumor()],
      active: [{ rumorId: "whispering-well", currentStep: 0 }],
      completed: [],
    };
    expect(shouldBoostRumorDiscovery(rumorState)).toBe(false);
  });

  it("returns false when rumors are completed but none active", () => {
    const rumorState: RumorState = {
      available: [makeRumor()],
      active: [],
      completed: [{ rumorId: "whispering-well", completedAtTurn: 12 }],
    };
    expect(shouldBoostRumorDiscovery(rumorState)).toBe(false);
  });
});

describe("pickEncounter discovery weight boost", () => {
  const genericEncounter: Encounter = {
    id: "generic",
    text: "A quiet stretch of road.",
    requiredTags: [],
    choices: [{ label: "Move on", outcome: {} }],
  };
  const discoveryEncounter: Encounter = {
    id: "ww-discovery",
    text: "A spiral etched in bark.",
    requiredTags: [],
    choices: [
      { label: "Trace the spiral", outcome: { hope: 1 }, discoversRumor: "whispering-well" },
      { label: "Move on quietly", outcome: {} },
    ],
  };

  it("assigns 3x weight to discovery encounters when boost is active", () => {
    expect(encounterHasDiscoveryChoice(discoveryEncounter)).toBe(true);
    expect(discoveryEncounterWeight(discoveryEncounter, true)).toBe(3);
    expect(discoveryEncounterWeight(genericEncounter, true)).toBe(1);
  });

  it("biases toward discovery encounters before the first rumor is found", () => {
    let boostedDiscoveryCount = 0;
    let baseDiscoveryCount = 0;

    for (let seed = 1; seed <= 300; seed += 1) {
      const boostedRng = seededRng(seed);
      const baseRng = seededRng(seed + 5000);
      for (let burn = 0; burn < 8; burn += 1) {
        boostedRng();
        baseRng();
      }

      const boosted = pickEncounter(
        [genericEncounter, discoveryEncounter],
        new Set<string>(),
        "forest",
        boostedRng,
        true,
      );
      const base = pickEncounter(
        [genericEncounter, discoveryEncounter],
        new Set<string>(),
        "forest",
        baseRng,
        false,
      );

      if (boosted?.id === "ww-discovery") boostedDiscoveryCount += 1;
      if (base?.id === "ww-discovery") baseDiscoveryCount += 1;
    }

    expect(boostedDiscoveryCount).toBeGreaterThan(100);
    expect(boostedDiscoveryCount).toBeGreaterThan(baseDiscoveryCount);
  });
});

describe("rumorContext on encounter mode", () => {
  it("attaches rumor context when entering a rumor step encounter", () => {
    const rumorEncounter: Encounter = {
      id: "ww-step-0",
      text: "You find the whispering well.",
      requiredTags: ["water", "ancient"],
      choices: [{ label: "Listen", outcome: {} }],
    };
    const rumor = makeRumor();
    const rng = seededRng(42);
    const state = createInitialState([rumorEncounter], rng, [rumor]);
    const target = neighbor(state.player.hex, 0);
    const prepared: GameState = {
      ...state,
      map: new Map(state.map).set(coordKey(target), {
        coord: target,
        biome: "forest",
        tags: new Set(["water", "ancient", "wood"]),
        encounter: null,
        revealed: true,
        consumed: false,
        visited: false,
      }),
      rumors: {
        ...state.rumors,
        active: [{ rumorId: "whispering-well", currentStep: 0 }],
      },
    };

    const next = resolveTurn(prepared, { type: "push", direction: 0 }, seededRng(99));

    expect(next.mode.type).toBe("encounter");
    if (next.mode.type !== "encounter") return;
    expect(next.mode.rumorContext).toEqual({
      rumorId: "whispering-well",
      rumorTitle: "The Whispering Well",
      stepIndex: 0,
      stepCount: 2,
      isFinalStep: false,
    });
  });

  it("marks the final rumor step in rumorContext", () => {
    const finalEncounter: Encounter = {
      id: "ww-step-1",
      text: "The well chamber opens.",
      requiredTags: ["stone"],
      choices: [{ label: "Take the sigil", outcome: {} }],
    };
    const rumor = makeRumor();
    const state = createInitialState([finalEncounter], seededRng(1), [rumor]);
    const target = neighbor(state.player.hex, 0);
    const prepared: GameState = {
      ...state,
      map: new Map(state.map).set(coordKey(target), {
        coord: target,
        biome: "ruins",
        tags: new Set(["stone", "ancient"]),
        encounter: null,
        revealed: true,
        consumed: false,
        visited: false,
      }),
      rumors: {
        ...state.rumors,
        active: [{ rumorId: "whispering-well", currentStep: 1 }],
      },
    };

    const next = resolveTurn(prepared, { type: "push", direction: 0 }, seededRng(99));

    if (next.mode.type !== "encounter") {
      throw new Error("expected encounter mode");
    }
    expect(next.mode.rumorContext?.isFinalStep).toBe(true);
    expect(next.mode.rumorContext?.stepIndex).toBe(1);
  });
});

describe("rumor log messages", () => {
  it("logs rumor discovery with journal prompt", () => {
    const discoveryEncounter: Encounter = {
      id: "ww-discovery",
      text: "A spiral in the bark.",
      requiredTags: [],
      choices: [
        { label: "Trace the spiral", outcome: {}, discoversRumor: "whispering-well" },
      ],
    };
    const rumor = makeRumor({ reward: null });
    const state = createInitialState([discoveryEncounter], seededRng(1), [rumor]);
    const inEncounter: GameState = {
      ...state,
      mode: {
        type: "encounter",
        encounter: discoveryEncounter,
        hex: cubeCoord(1, 0, -1),
      },
    };

    const next = resolveTurn(inEncounter, { type: "choose", choiceIndex: 0 }, seededRng(2));
    const rumorLog = next.log.find((entry) => entry.type === "rumor" && entry.text.includes("Lead recorded"));

    expect(rumorLog).toBeDefined();
    expect(rumorLog?.text).toContain("The Whispering Well");
    expect(rumorLog?.text).toContain("press J");
  });

  it("logs step advancement after resolving a rumor step", () => {
    const stepEncounter: Encounter = {
      id: "ww-step-0",
      text: "You hear the well.",
      requiredTags: [],
      choices: [{ label: "Listen", outcome: {} }],
    };
    const rumor = makeRumor({ reward: null });
    const state = createInitialState([stepEncounter], seededRng(1), [rumor]);
    const inEncounter: GameState = {
      ...state,
      mode: {
        type: "encounter",
        encounter: stepEncounter,
        hex: cubeCoord(1, 0, -1),
        rumorContext: {
          rumorId: "whispering-well",
          rumorTitle: "The Whispering Well",
          stepIndex: 0,
          stepCount: 2,
          isFinalStep: false,
        },
      },
      rumors: {
        ...state.rumors,
        active: [{ rumorId: "whispering-well", currentStep: 0 }],
      },
    };

    const next = resolveTurn(inEncounter, { type: "choose", choiceIndex: 0 }, seededRng(2));
    const stepLog = next.log.find((entry) => entry.type === "rumor" && entry.text.includes("trail deepens"));

    expect(stepLog).toBeDefined();
    expect(stepLog?.text).toContain("Whispering Well");
    expect(stepLog?.text).toContain("journal");
  });

  it("logs chain completion with relic name", () => {
    const finalEncounter: Encounter = {
      id: "ww-step-1",
      text: "The sigil waits.",
      requiredTags: [],
      choices: [{ label: "Claim it", outcome: {} }],
    };
    const rumor = makeRumor();
    const state = createInitialState([finalEncounter], seededRng(1), [rumor]);
    const inEncounter: GameState = {
      ...state,
      player: { ...state.player, hope: 3 },
      mode: {
        type: "encounter",
        encounter: finalEncounter,
        hex: cubeCoord(1, 0, -1),
        rumorContext: {
          rumorId: "whispering-well",
          rumorTitle: "The Whispering Well",
          stepIndex: 1,
          stepCount: 2,
          isFinalStep: true,
        },
      },
      rumors: {
        ...state.rumors,
        active: [{ rumorId: "whispering-well", currentStep: 1 }],
      },
    };

    const next = resolveTurn(inEncounter, { type: "choose", choiceIndex: 0 }, seededRng(2));
    const completionLog = next.log.find(
      (entry) => entry.type === "rumor" && entry.text.includes("resolved"),
    );

    expect(completionLog).toBeDefined();
    expect(completionLog?.text).toContain("Well Sigil");
  });
});

describe("rumor schema migration", () => {
  it("maps legacy hint fields to journalHint on deserialize", () => {
    const legacySave = {
      player: {
        hex: { q: 0, r: 0, s: 0 },
        supply: 7,
        hope: 5,
        health: 3,
      },
      map: {
        "0,0,0": {
          coord: { q: 0, r: 0, s: 0 },
          biome: "settlement",
          tags: ["inhabited", "sheltered"],
          encounter: null,
          revealed: true,
          consumed: false,
          visited: true,
        },
      },
      searing: { axis: "q", direction: 1, line: -10, advanceRate: 5 },
      turn: 0,
      mode: { type: "map" },
      log: [],
      status: "playing",
      encounters: [],
      rumors: {
        available: [
          {
            id: "legacy-rumor",
            title: "Legacy Rumor",
            steps: [
              {
                stepIndex: 0,
                encounterId: "legacy-step",
                hint: "Follow the old road east.",
                hintTags: ["road"],
              },
            ],
            reward: null,
            hopeBonus: 1,
          },
        ],
        active: [],
        completed: [],
      },
      relics: [],
      stats: {
        hexesExplored: 0,
        encountersResolved: 0,
        rumorsDiscovered: 0,
        rumorsCompleted: 0,
        relicsCollected: 0,
      },
    };

    const restored = deserializeState(legacySave);
    const step = restored.rumors.available[0]?.steps[0];

    expect(step?.journalHint).toBe("Follow the old road east.");
    expect(restored.rumors.available[0]?.premise).toBe("");
    expect(step?.stepTitle).toBe("");
  });
});
