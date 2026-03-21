export interface CubeCoord {
  readonly q: number;
  readonly r: number;
  readonly s: number;
}

export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

export function cubeCoord(q: number, r: number, s: number): CubeCoord {
  if (q + r + s !== 0) {
    throw new Error(`Invalid cube coord: ${q},${r},${s}`);
  }

  return { q, r, s };
}

export function coordKey(coord: CubeCoord): string {
  return `${coord.q},${coord.r},${coord.s}`;
}

export function coordFromKey(key: string): CubeCoord {
  const [q, r, s] = key.split(",").map((part) => Number(part));

  if ([q, r, s].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid coord key: ${key}`);
  }

  return cubeCoord(q, r, s);
}

export const HEX_DIRECTIONS: readonly CubeCoord[] = [
  cubeCoord(1, 0, -1),
  cubeCoord(1, -1, 0),
  cubeCoord(0, -1, 1),
  cubeCoord(-1, 0, 1),
  cubeCoord(-1, 1, 0),
  cubeCoord(0, 1, -1),
] as const;

export function addCoords(a: CubeCoord, b: CubeCoord): CubeCoord {
  return cubeCoord(a.q + b.q, a.r + b.r, a.s + b.s);
}

export function scaleCoord(coord: CubeCoord, scalar: number): CubeCoord {
  return cubeCoord(coord.q * scalar, coord.r * scalar, coord.s * scalar);
}

export function neighbor(coord: CubeCoord, direction: HexDirection): CubeCoord {
  return addCoords(coord, HEX_DIRECTIONS[direction]);
}

export function neighbors(coord: CubeCoord): CubeCoord[] {
  return HEX_DIRECTIONS.map((direction) => addCoords(coord, direction));
}

export function hexDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

export function ring(center: CubeCoord, radius: number): CubeCoord[] {
  if (radius < 0) {
    throw new Error(`Radius must be non-negative: ${radius}`);
  }

  if (radius === 0) {
    return [center];
  }

  const results: CubeCoord[] = [];
  let current = addCoords(center, scaleCoord(HEX_DIRECTIONS[4], radius));

  for (let direction = 0; direction < 6; direction += 1) {
    for (let step = 0; step < radius; step += 1) {
      results.push(current);
      current = neighbor(current, direction as HexDirection);
    }
  }

  return results;
}
