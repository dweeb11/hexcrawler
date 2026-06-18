import { describe, expect, it } from "vitest";

import { coordKey, cubeCoord, HEX_DIRECTIONS, neighbor, type HexDirection } from "../../src/engine/hex";
import { createInitialState } from "../../src/engine/state";
import { resolveTurn } from "../../src/engine/turn";
import {
  getPushableDirections,
  getVisibleNeighbors,
  INVISIBLE_PUSH_MESSAGE,
  isPushableDirection,
} from "../../src/engine/visibility";
import { seededRng } from "../helpers";

function stateAtOrigin(hope: number, searingAxis: "q" | "r" | "s" = "q", searingDirection: 1 | -1 = 1) {
  const state = createInitialState([], seededRng(1));
  return {
    ...state,
    player: { ...state.player, hope },
    searing: {
      ...state.searing,
      axis: searingAxis,
      direction: searingDirection,
    },
  };
}

function directionTowardSearing(
  hex = cubeCoord(0, 0, 0),
  hope = 1,
  searingAxis: "q" | "r" | "s" = "q",
  searingDirection: 1 | -1 = 1,
): HexDirection {
  for (let direction = 0; direction < 6; direction += 1) {
    const hexDirection = direction as HexDirection;
    if (
      !isPushableDirection(hex, hexDirection, hope, {
        axis: searingAxis,
        direction: searingDirection,
        line: 0,
        advanceRate: 5,
      })
    ) {
      return hexDirection;
    }
  }

  throw new Error("Expected at least one non-pushable direction at low hope");
}

describe("push visibility gating", () => {
  it("rejects push into a non-visible neighbor without spending supply", () => {
    const state = stateAtOrigin(2);
    const blockedDirection = directionTowardSearing();
    const rng = seededRng(99);

    const next = resolveTurn(state, { type: "push", direction: blockedDirection }, rng);

    expect(next.player.supply).toBe(state.player.supply);
    expect(coordKey(next.player.hex)).toBe(coordKey(state.player.hex));
    expect(next.turn).toBe(state.turn);
    expect(next.log.at(-1)?.text).toBe(INVISIBLE_PUSH_MESSAGE);
    expect(next.log.at(-1)?.type).toBe("system");
  });

  it("allows push into visible neighbors at low hope", () => {
    const state = stateAtOrigin(1);
    const visibleDirection = getPushableDirections(state)[0];
    const rng = seededRng(99);

    const next = resolveTurn(state, { type: "push", direction: visibleDirection }, rng);

    expect(next.player.supply).toBe(state.player.supply - 1);
    expect(coordKey(next.player.hex)).not.toBe(coordKey(state.player.hex));
    expect(next.turn).toBe(state.turn + 1);
  });

  it("allows push in all six directions at normal hope", () => {
    const state = stateAtOrigin(3);
    const rng = seededRng(99);

    for (let direction = 0; direction < 6; direction += 1) {
      const hexDirection = direction as HexDirection;
      const next = resolveTurn(
        state,
        { type: "push", direction: hexDirection },
        seededRng(100 + direction),
      );

      expect(coordKey(next.player.hex)).toBe(
        coordKey(neighbor(state.player.hex, hexDirection)),
      );
      expect(next.player.supply).toBe(state.player.supply - 1);
    }
  });

  it("matches pushable directions to fog-outline neighbors", () => {
    const state = stateAtOrigin(2);
    const visibleCoords = getVisibleNeighbors(
      state.player.hex,
      state.player.hope,
      state.searing.axis,
      state.searing.direction,
    ).map(coordKey);

    const pushableCoords = getPushableDirections(state).map((direction) =>
      coordKey(neighbor(state.player.hex, direction)),
    );

    expect(pushableCoords.sort()).toEqual(visibleCoords.sort());
    expect(getPushableDirections(state)).toHaveLength(3);
    expect(HEX_DIRECTIONS).toHaveLength(6);
  });
});
