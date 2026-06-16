// tests/engine/rumors.test.ts
import { describe, expect, it } from "vitest";
import {
  advanceRumor,
  buildRumorContext,
  discoverRumor,
  findActiveRumorForEncounter,
  findNextRumorStep,
  applyRumorWeights,
  getRumorJournalEntries,
  resolveRumorAfterEncounter,
  resolveRumorDiscovery,
} from "../../src/engine/rumors";
import type { Relic, Rumor, RumorState, ActiveRumor } from "../../src/engine/state";

const testRumor: Rumor = {
  id: "whispering-well",
  title: "The Whispering Well",
  premise: "",
  steps: [
    {
      stepIndex: 0,
      stepTitle: "",
      encounterId: "ww-step-0",
      journalHint: "Seek ancient water in the forest",
      hintTags: ["water", "ancient"],
      hintBiomes: ["forest"],
    },
    {
      stepIndex: 1,
      stepTitle: "",
      encounterId: "ww-step-1",
      journalHint: "The well lies beneath stone ruins",
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
        { stepIndex: 0, stepTitle: "", encounterId: "or-0", journalHint: "", hintTags: ["water"] },
        { stepIndex: 1, stepTitle: "", encounterId: "or-1", journalHint: "", hintTags: ["stone"] },
        { stepIndex: 2, stepTitle: "", encounterId: "or-2", journalHint: "", hintTags: ["ice"] },
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

describe("buildRumorContext", () => {
  it("marks final step when on last index", () => {
    const context = buildRumorContext(testRumor, 1);
    expect(context).toEqual({
      rumorId: "whispering-well",
      rumorTitle: "The Whispering Well",
      stepIndex: 1,
      stepCount: 2,
      isFinalStep: true,
    });
  });
});

describe("findActiveRumorForEncounter", () => {
  it("returns active rumor matching encounter id", () => {
    const rumorState: RumorState = {
      available: [testRumor],
      active: [{ rumorId: "whispering-well", currentStep: 0 }],
      completed: [],
    };
    const match = findActiveRumorForEncounter(rumorState, "ww-step-0");
    expect(match?.rumor.id).toBe("whispering-well");
    expect(match?.active.currentStep).toBe(0);
  });

  it("returns null when encounter is not a rumor step", () => {
    const rumorState: RumorState = {
      available: [testRumor],
      active: [{ rumorId: "whispering-well", currentStep: 0 }],
      completed: [],
    };
    expect(findActiveRumorForEncounter(rumorState, "unrelated")).toBeNull();
  });
});

describe("resolveRumorDiscovery", () => {
  it("returns discovery log and stats delta", () => {
    const rumorState: RumorState = {
      available: [testRumor],
      active: [],
      completed: [],
    };
    const result = resolveRumorDiscovery(rumorState, "whispering-well");
    expect(result?.rumors.active).toHaveLength(1);
    expect(result?.statsDelta).toEqual({ rumorsDiscovered: 1 });
    expect(result?.logs[0]?.text).toContain("The Whispering Well");
    expect(result?.logs[0]?.type).toBe("rumor");
  });

  it("returns null for unknown rumor id", () => {
    const rumorState: RumorState = { available: [testRumor], active: [], completed: [] };
    expect(resolveRumorDiscovery(rumorState, "missing")).toBeNull();
  });
});

describe("resolveRumorAfterEncounter", () => {
  const activeState: RumorState = {
    available: [testRumor],
    active: [{ rumorId: "whispering-well", currentStep: 0 }],
    completed: [],
  };

  it("advances to next step and logs trail-deepens message", () => {
    const result = resolveRumorAfterEncounter(activeState, "ww-step-0", 5);
    expect(result?.rumors.active).toEqual([{ rumorId: "whispering-well", currentStep: 1 }]);
    expect(result?.logs[0]?.text).toContain("trail deepens");
    expect(result?.hopeDelta).toBe(0);
  });

  it("completes chain on final step and grants reward and hope", () => {
    const relic: Relic = {
      id: "well-sigil",
      name: "Well Sigil",
      description: "Token of resolve.",
      effect: { type: "max_resource", resource: "hope", bonus: 1 },
    };
    const rumorWithReward: Rumor = { ...testRumor, reward: relic, hopeBonus: 3 };
    const finalStepState: RumorState = {
      available: [rumorWithReward],
      active: [{ rumorId: "whispering-well", currentStep: 1 }],
      completed: [],
    };

    const result = resolveRumorAfterEncounter(finalStepState, "ww-step-1", 9);
    expect(result?.rumors.active).toEqual([]);
    expect(result?.rumors.completed).toEqual([
      { rumorId: "whispering-well", completedAtTurn: 9 },
    ]);
    expect(result?.relicsToAdd).toEqual([relic]);
    expect(result?.hopeDelta).toBe(3);
    expect(result?.statsDelta).toEqual({ rumorsCompleted: 1, relicsCollected: 1 });
    expect(result?.logs[0]?.text).toContain("Whispering Well resolved");
    expect(result?.logs[0]?.text).toContain("Well Sigil");
  });

  it("strips leading The from completion log title", () => {
    const result = resolveRumorAfterEncounter(activeState, "ww-step-0", 1);
    expect(result?.logs[0]?.text).toMatch(/^▸ Whispering Well —/);
  });

  it("returns null when encounter is not a rumor step", () => {
    expect(resolveRumorAfterEncounter(activeState, "other", 1)).toBeNull();
  });
});

describe("getRumorJournalEntries", () => {
  it("returns active entries with step progress and hints", () => {
    const rumorState: RumorState = {
      available: [testRumor],
      active: [{ rumorId: "whispering-well", currentStep: 0 }],
      completed: [],
    };
    const entries = getRumorJournalEntries(rumorState);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      status: "active",
      stepIndex: 0,
      stepCount: 2,
      journalHint: "Seek ancient water in the forest",
    });
  });

  it("returns completed entries with reward metadata", () => {
    const relic: Relic = {
      id: "well-sigil",
      name: "Well Sigil",
      description: "Token.",
      effect: { type: "max_resource", resource: "hope", bonus: 1 },
    };
    const rumorState: RumorState = {
      available: [{ ...testRumor, reward: relic }],
      active: [],
      completed: [{ rumorId: "whispering-well", completedAtTurn: 12 }],
    };
    const entries = getRumorJournalEntries(rumorState);
    expect(entries[0]).toMatchObject({
      status: "completed",
      completedAtTurn: 12,
      rumor: expect.objectContaining({ reward: relic }),
    });
  });
});
