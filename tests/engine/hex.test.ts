import { describe, expect, it } from "vitest";

import {
  HEX_DIRECTIONS,
  coordFromKey,
  coordKey,
  cubeCoord,
  hexDistance,
  neighbor,
  neighbors,
  ring,
} from "../../src/engine/hex";

describe("cubeCoord", () => {
  it("enforces q + r + s = 0", () => {
    const coord = cubeCoord(1, -1, 0);
    expect(coord.q + coord.r + coord.s).toBe(0);
  });

  it("throws on invalid coordinates", () => {
    expect(() => cubeCoord(1, 1, 1)).toThrow();
  });
});

describe("coordKey / coordFromKey", () => {
  it("round-trips coordinates", () => {
    const coord = cubeCoord(3, -1, -2);
    expect(coordFromKey(coordKey(coord))).toEqual(coord);
  });
});

describe("HEX_DIRECTIONS", () => {
  it("contains 6 valid directions", () => {
    expect(HEX_DIRECTIONS).toHaveLength(6);
    for (const direction of HEX_DIRECTIONS) {
      expect(direction.q + direction.r + direction.s).toBe(0);
    }
  });
});

describe("neighbor", () => {
  it("returns the adjacent hex in a direction", () => {
    expect(neighbor(cubeCoord(0, 0, 0), 0)).toEqual(cubeCoord(1, 0, -1));
  });
});

describe("neighbors", () => {
  it("returns six neighboring hexes", () => {
    expect(neighbors(cubeCoord(0, 0, 0))).toHaveLength(6);
  });
});

describe("hexDistance", () => {
  it("calculates distances across the grid", () => {
    expect(hexDistance(cubeCoord(0, 0, 0), cubeCoord(0, 0, 0))).toBe(0);
    expect(hexDistance(cubeCoord(0, 0, 0), cubeCoord(1, -1, 0))).toBe(1);
    expect(hexDistance(cubeCoord(0, 0, 0), cubeCoord(3, -2, -1))).toBe(3);
  });
});

describe("ring", () => {
  it("returns the correct ring sizes", () => {
    expect(ring(cubeCoord(0, 0, 0), 1)).toHaveLength(6);
    expect(ring(cubeCoord(0, 0, 0), 2)).toHaveLength(12);
  });
});
