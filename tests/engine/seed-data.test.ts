import { describe, expect, it } from "vitest";

import seedEncounters from "../../src/engine/data/seed-encounters.json";

describe("seed encounter data", () => {
  it("ships the full 18-encounter table", () => {
    expect(seedEncounters).toHaveLength(18);
  });

  it("contains the required fields for each encounter and choice", () => {
    for (const encounter of seedEncounters) {
      expect(encounter.id).toBeTruthy();
      expect(encounter.text).toBeTruthy();
      expect(Array.isArray(encounter.requiredTags)).toBe(true);
      expect(encounter.choices.length).toBeGreaterThan(0);

      for (const choice of encounter.choices) {
        expect(choice.label).toBeTruthy();
        expect(choice.outcome).toBeDefined();
      }
    }
  });
});
