import { describe, expect, it } from "vitest";

import { cubeCoord } from "../../src/engine/hex";
import { getVisibleNeighbors } from "../../src/engine/visibility";

describe("getVisibleNeighbors", () => {
  it("returns all neighbors at normal hope and three safer neighbors at low hope", () => {
    expect(getVisibleNeighbors(cubeCoord(0, 0, 0), 3, "q", 1)).toHaveLength(6);
    expect(getVisibleNeighbors(cubeCoord(0, 0, 0), 1, "q", 1)).toHaveLength(3);
  });
});
