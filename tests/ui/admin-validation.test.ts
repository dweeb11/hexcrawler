import { describe, expect, it } from "vitest";
import type { Encounter } from "../../src/engine/state";
import {
  filterEncounters,
  validateContentCrossReferences,
  validateEncounterPayload,
  validateRumorPayload,
  type AdminRumor,
} from "../../src/ui/admin/validation";

const encounters: Encounter[] = [
  {
    id: "ww-discovery",
    text: "A well whispers.",
    requiredTags: ["water"],
    choices: [{ label: "Listen", outcome: { hope: 1 }, discoversRumor: "whispering-well" }],
  },
  {
    id: "ww-step-0",
    text: "Forest marker.",
    requiredTags: ["water", "ancient"],
    choices: [{ label: "Continue", outcome: {} }],
  },
];

const rumors: AdminRumor[] = [
  {
    id: "whispering-well",
    title: "The Whispering Well",
    premise: "A well remembers names.",
    hopeBonus: 3,
    rewardId: "well-sigil",
    steps: [
      {
        stepIndex: 0,
        stepTitle: "Forest Marker",
        encounterId: "ww-step-0",
        journalHint: "Seek water in the forest.",
        hintTags: ["water"],
      },
    ],
  },
];

describe("admin validation", () => {
  it("flags broken discoversRumor references", () => {
    const badEncounter: Encounter = {
      id: "bad",
      text: "Broken link.",
      requiredTags: [],
      choices: [{ label: "Oops", outcome: {}, discoversRumor: "missing-rumor" }],
    };

    const issues = validateEncounterPayload(badEncounter, new Set(["whispering-well"]));
    expect(issues.some((issue) => issue.field.includes("discoversRumor"))).toBe(true);
  });

  it("flags orphan rumor step encounter ids", () => {
    const badRumor: AdminRumor = {
      id: "broken-chain",
      title: "Broken",
      premise: "",
      hopeBonus: 0,
      rewardId: null,
      steps: [
        {
          stepIndex: 0,
          stepTitle: "Missing",
          encounterId: "does-not-exist",
          journalHint: "Go somewhere.",
          hintTags: [],
        },
      ],
    };

    const issues = validateRumorPayload(badRumor, new Set(encounters.map((encounter) => encounter.id)));
    expect(issues.some((issue) => issue.field.includes("encounterId"))).toBe(true);
  });

  it("validates cross references across encounters and rumors", () => {
    const issues = validateContentCrossReferences(encounters, rumors);
    expect(issues).toEqual([]);
  });

  it("filters encounters by id, tags, and text", () => {
    expect(filterEncounters(encounters, "ww-step")).toHaveLength(1);
    expect(filterEncounters(encounters, "water")).toHaveLength(2);
    expect(filterEncounters(encounters, "Forest marker")).toHaveLength(1);
  });
});
