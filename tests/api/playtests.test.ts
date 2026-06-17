import { describe, expect, it, vi } from "vitest";

import {
  buildPlaytestPayload,
  submitPlaytest,
} from "../../src/api/playtests";
import { coordKey, cubeCoord } from "../../src/engine/hex";
import {
  createInitialState,
  type GameState,
  type HexTile,
} from "../../src/engine/state";
import { seededRng } from "../helpers";

function tile(
  q: number,
  r: number,
  biome: HexTile["biome"],
  visited: boolean,
): HexTile {
  const coord = cubeCoord(q, r, -q - r);
  return {
    coord,
    biome,
    tags: new Set(),
    encounter: null,
    revealed: visited,
    consumed: false,
    visited,
  };
}

function gameStateWith(overrides: Partial<GameState>): GameState {
  const base = createInitialState([], seededRng(1));
  return { ...base, ...overrides };
}

describe("buildPlaytestPayload", () => {
  it("builds a win payload with visited biomes and rumor count", () => {
    const forest = tile(1, 0, "forest", true);
    const mountain = tile(0, 1, "mountain", true);
    const hidden = tile(-1, 1, "wastes", false);
    const state = gameStateWith({
      turn: 17,
      status: "won",
      map: new Map([
        [coordKey(forest.coord), forest],
        [coordKey(mountain.coord), mountain],
        [coordKey(hidden.coord), hidden],
      ]),
      rumors: {
        available: [],
        active: [],
        completed: [
          { rumorId: "r1", completedAtTurn: 5 },
          { rumorId: "r2", completedAtTurn: 12 },
        ],
      },
    });

    expect(buildPlaytestPayload(state, "won")).toEqual({
      outcome: "won",
      turnsSurvived: 17,
      deathCause: undefined,
      biomesVisited: ["forest", "mountain"],
      rumorsCompleted: 2,
    });
  });

  it("includes death cause for a lost game in gameover mode", () => {
    const state = gameStateWith({
      turn: 9,
      status: "lost",
      mode: {
        type: "gameover",
        reason: "The Searing caught you.",
        outcome: "loss_searing",
      },
    });

    expect(buildPlaytestPayload(state, "lost")).toEqual({
      outcome: "lost",
      turnsSurvived: 9,
      deathCause: "The Searing caught you.",
      biomesVisited: ["settlement"],
      rumorsCompleted: 0,
    });
  });

  it("deduplicates visited biomes", () => {
    const forestA = tile(1, 0, "forest", true);
    const forestB = tile(0, 1, "forest", true);
    const state = gameStateWith({
      map: new Map([
        [coordKey(forestA.coord), forestA],
        [coordKey(forestB.coord), forestB],
      ]),
    });

    expect(buildPlaytestPayload(state, "won").biomesVisited).toEqual(["forest"]);
  });
});

describe("submitPlaytest", () => {
  it("POSTs the payload fire-and-forget", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const state = gameStateWith({ turn: 4, status: "won" });

    submitPlaytest(state, "won", fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/playtests",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "won",
          turnsSurvived: 4,
          deathCause: undefined,
          biomesVisited: ["settlement"],
          rumorsCompleted: 0,
        }),
      },
    );
  });

  it("does not throw when fetch rejects", () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    const state = gameStateWith({ status: "lost" });

    expect(() => submitPlaytest(state, "lost", fetchMock)).not.toThrow();
  });
});
