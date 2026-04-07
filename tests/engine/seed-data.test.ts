import { describe, expect, it } from "vitest";

import { ALL_BIOMES } from "../../src/engine/data/biomes";
import seedEncounters from "../../src/engine/data/seed-encounters.json";

describe("seed encounter data", () => {
  it("ships a substantial encounter table for M2", () => {
    expect(seedEncounters.length).toBeGreaterThanOrEqual(45);
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

  it("includes at least one generic zero-tag fallback encounter", () => {
    const genericCount = seedEncounters.filter((encounter) => encounter.requiredTags.length === 0).length;
    expect(genericCount).toBeGreaterThan(0);
  });

  it("includes at least eight 1-tag common encounters per biome", () => {
    for (const biome of ALL_BIOMES) {
      const commonCount = seedEncounters.filter(
        (encounter) =>
          encounter.requiredTags.length === 1 &&
          Array.isArray(encounter.biomes) &&
          encounter.biomes.includes(biome),
      ).length;
      expect(commonCount).toBeGreaterThanOrEqual(8);
    }
  });
});
