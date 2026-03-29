import { describe, expect, it } from "vitest";

import { coordKey, cubeCoord } from "../../src/engine/hex";
import { generateHex, getVisibleNeighbors, rollBiome, rollTags } from "../../src/engine/map";
import type { Encounter, HexTile } from "../../src/engine/state";
import { seededRng } from "../helpers";

describe("rollBiome", () => {
  it("returns a valid biome", () => {
    expect(["forest", "mountain", "ruins", "settlement", "wastes"]).toContain(
      rollBiome([], seededRng(42)),
    );
  });

  it("leans toward neighbor biomes", () => {
    const counts: Record<string, number> = {};
    for (let index = 1; index <= 1000; index += 1) {
      const biome = rollBiome(["forest", "forest", "forest"], seededRng(index));
      counts[biome] = (counts[biome] ?? 0) + 1;
    }

    expect(counts.forest).toBeGreaterThan(400);
  });
});

describe("rollTags", () => {
  it("returns 2-3 tags", () => {
    const tags = rollTags("forest", [], seededRng(42));
    expect(tags.size).toBeGreaterThanOrEqual(2);
    expect(tags.size).toBeLessThanOrEqual(3);
  });

  it("inherits neighbor tags often enough to matter", () => {
    let waterCount = 0;
    const neighborTags = [new Set(["water", "ancient"]), new Set(["water", "sacred"])];
    for (let index = 1; index <= 100; index += 1) {
      const tags = rollTags("forest", neighborTags, seededRng(index));
      if (tags.has("water")) {
        waterCount += 1;
      }
    }

    expect(waterCount).toBeGreaterThan(30);
  });
});

describe("generateHex", () => {
  it("creates a hex with biome, tags, and visibility flags", () => {
    const tile = generateHex(cubeCoord(1, 0, -1), new Map(), [], seededRng(42));
    expect(tile.biome).toBeTruthy();
    expect(tile.tags.size).toBeGreaterThanOrEqual(2);
    expect(tile.revealed).toBe(true);
    expect(tile.consumed).toBe(false);
    expect(tile.visited).toBe(false);
  });

  it("assigns matching encounters", () => {
    const encounter: Encounter = {
      id: "test",
      text: "Test encounter",
      requiredTags: [],
      choices: [{ label: "OK", outcome: {} }],
    };
    const tile = generateHex(cubeCoord(1, 0, -1), new Map(), [encounter], () => 0.1);
    expect(tile.encounter?.id).toBe("test");
  });

  it("uses revealed neighbors for influence", () => {
    const coord = cubeCoord(1, 0, -1);
    const neighborCoord = cubeCoord(0, 1, -1);
    const existing: HexTile = {
      coord: neighborCoord,
      biome: "forest",
      tags: new Set(["water", "overgrown"]),
      encounter: null,
      revealed: true,
      consumed: false,
      visited: true,
    };
    const map = new Map([[coordKey(neighborCoord), existing]]);
    const tile = generateHex(coord, map, [], seededRng(42));
    expect(tile.tags.size).toBeGreaterThanOrEqual(2);
  });
});

describe("getVisibleNeighbors", () => {
  it("returns all neighbors at normal hope and three safer neighbors at low hope", () => {
    expect(getVisibleNeighbors(cubeCoord(0, 0, 0), 3, "q", 1)).toHaveLength(6);
    expect(getVisibleNeighbors(cubeCoord(0, 0, 0), 1, "q", 1)).toHaveLength(3);
  });
});
