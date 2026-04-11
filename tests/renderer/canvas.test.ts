import { describe, expect, it } from "vitest";
import { hexToPixel, pixelToHex } from "../../src/renderer/canvas";
import { coordKey, cubeCoord, neighbor, type CubeCoord } from "../../src/engine/hex";

function roundtrip(coord: CubeCoord): CubeCoord {
  const { x, y } = hexToPixel(coord);
  return pixelToHex(x, y);
}

describe("canvas hex layout (flat-top)", () => {
  it("roundtrips hex center through hexToPixel → pixelToHex", () => {
    const samples: CubeCoord[] = [
      cubeCoord(0, 0, 0),
      cubeCoord(1, 0, -1),
      cubeCoord(0, -1, 1),
      cubeCoord(-2, 3, -1),
      cubeCoord(4, -5, 1),
    ];
    for (const c of samples) {
      const back = roundtrip(c);
      expect(coordKey(back)).toBe(coordKey(c));
    }
  });

  it("direction 2 (W / screen north) moves only in y in pixel space", () => {
    const center = cubeCoord(2, -1, -1);
    const north = neighbor(center, 2);
    const a = hexToPixel(center);
    const b = hexToPixel(north);
    expect(b.x).toBeCloseTo(a.x, 10);
    expect(b.y).toBeLessThan(a.y);
  });
});
