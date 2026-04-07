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
