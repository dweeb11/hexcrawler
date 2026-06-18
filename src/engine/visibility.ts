import { neighbors } from "./hex";
import type { CubeCoord } from "./hex";

export function getVisibleNeighbors(
  coord: CubeCoord,
  hope: number,
  searingAxis: keyof CubeCoord,
  searingDirection: 1 | -1,
): CubeCoord[] {
  if (hope <= 0) {
    return [];
  }

  const around = neighbors(coord);
  if (hope >= 3) {
    return around;
  }

  return around
    .filter((neighborCoord) => {
      const axisDelta = neighborCoord[searingAxis] - coord[searingAxis];
      return axisDelta * searingDirection <= 0;
    })
    .slice(0, 3);
}
