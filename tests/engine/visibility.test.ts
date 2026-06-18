import { describe, expect, it } from "vitest";

import { cubeCoord } from "../../src/engine/hex";
import * as mapModule from "../../src/engine/map";
import { getVisibleNeighbors } from "../../src/engine/visibility";

describe("visibility module seam", () => {
  it("keeps player vision helpers out of map generation exports", () => {
    expect(mapModule).not.toHaveProperty("getVisibleNeighbors");
    expect(mapModule).not.toHaveProperty("isPushableDirection");
    expect(mapModule).not.toHaveProperty("isPushable");
    expect(mapModule).not.toHaveProperty("getPushableDirections");
  });
});

describe("getVisibleNeighbors", () => {
  it("returns all neighbors at normal hope and three safer neighbors at low hope", () => {
    expect(getVisibleNeighbors(cubeCoord(0, 0, 0), 3, "q", 1)).toHaveLength(6);
    expect(getVisibleNeighbors(cubeCoord(0, 0, 0), 1, "q", 1)).toHaveLength(3);
  });
});
