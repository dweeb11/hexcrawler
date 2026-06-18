import { coordKey, HEX_DIRECTIONS, neighbor, neighbors, type CubeCoord, type HexDirection } from "./hex";
import type { Action, GameState, SearingState } from "./state";

export const INVISIBLE_PUSH_MESSAGE = "You cannot see a way through there.";

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

export function isPushableDirection(
  hex: CubeCoord,
  direction: HexDirection,
  hope: number,
  searing: SearingState,
): boolean {
  const target = neighbor(hex, direction);
  const visible = getVisibleNeighbors(hex, hope, searing.axis, searing.direction);
  return visible.some((coord) => coordKey(coord) === coordKey(target));
}

export function isPushable(state: GameState, action: Extract<Action, { type: "push" }>): boolean {
  return isPushableDirection(
    state.player.hex,
    action.direction,
    state.player.hope,
    state.searing,
  );
}

export function getPushableDirections(state: GameState): HexDirection[] {
  return HEX_DIRECTIONS.map((_, direction) => direction as HexDirection).filter((direction) =>
    isPushableDirection(state.player.hex, direction, state.player.hope, state.searing),
  );
}
