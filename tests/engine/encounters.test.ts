import { describe, expect, it } from "vitest";

import { encounterForHope, findMatchingEncounters, resolveChoice } from "../../src/engine/encounters";
import type { Choice, Encounter } from "../../src/engine/state";

describe("findMatchingEncounters", () => {
  it("filters by required tags and biome", () => {
    const encounters: Encounter[] = [
      {
        id: "water",
        text: "Water",
        requiredTags: ["water"],
        choices: [{ label: "Drink", outcome: { hope: 1 } }],
      },
      {
        id: "mountain",
        text: "Mountain",
        requiredTags: ["stone"],
        biomes: ["mountain"],
        choices: [{ label: "Climb", outcome: { hope: 1 } }],
      },
    ];

    expect(findMatchingEncounters(encounters, new Set(["water"]), "forest")).toHaveLength(1);
    expect(findMatchingEncounters(encounters, new Set(["stone"]), "forest")).toHaveLength(0);
  });
});

describe("resolveChoice", () => {
  it("applies deterministic and chance-based outcomes", () => {
    const deterministic: Choice = { label: "Take", outcome: { supply: 2, hope: -1 } };
    const risky: Choice = {
      label: "Risk it",
      outcome: { supply: 3 },
      chance: 0.7,
      failureOutcome: { health: -1 },
    };

    expect(resolveChoice(deterministic, () => 0.5)).toEqual({
      delta: { supply: 2, hope: -1 },
      succeeded: true,
    });
    expect(resolveChoice(risky, () => 0.5)).toEqual({
      delta: { supply: 3 },
      succeeded: true,
    });
    expect(resolveChoice(risky, () => 0.8)).toEqual({
      delta: { health: -1 },
      succeeded: false,
    });
  });
});

describe("encounterForHope", () => {
  it("uses shadow text when hope is low and shadow text exists", () => {
    const encounter: Encounter = {
      id: "shadows",
      text: "A calm shrine.",
      shadowText: "The shrine stares back at you.",
      requiredTags: [],
      choices: [{ label: "Leave", outcome: {} }],
    };

    expect(encounterForHope(encounter, 2).text).toBe("The shrine stares back at you.");
  });

  it("keeps base text when hope is not low", () => {
    const encounter: Encounter = {
      id: "clear-mind",
      text: "A calm shrine.",
      shadowText: "The shrine stares back at you.",
      requiredTags: [],
      choices: [{ label: "Leave", outcome: {} }],
    };

    expect(encounterForHope(encounter, 3).text).toBe("A calm shrine.");
  });
});
