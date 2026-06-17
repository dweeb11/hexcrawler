import { describe, expect, it, vi } from "vitest";

import { buildPlaytestPayload, submitPlaytest } from "../../src/api/playtests";
import type { GameState } from "../../src/engine/state";

function minimalGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    turn: 12,
    status: "lost",
    mode: { type: "gameover", reason: "searing", outcome: "loss_searing" },
    map: new Map([
      ["0,0,0", { biome: "forest", tags: [], visited: true, encounterId: null }],
      ["1,0,-1", { biome: "marsh", tags: [], visited: true, encounterId: null }],
      ["0,1,-1", { biome: "forest", tags: [], visited: false, encounterId: null }],
    ]),
    rumors: {
      available: [],
      active: [],
      completed: [{ rumorId: "r1" }, { rumorId: "r2" }],
    },
    ...overrides,
  } as GameState;
}

describe("playtests", () => {
  it("builds the correct payload for a loss", () => {
    const state = minimalGameState();

    expect(buildPlaytestPayload(state, "lost")).toEqual({
      outcome: "lost",
      turnsSurvived: 12,
      deathCause: "searing",
      biomesVisited: ["forest", "marsh"],
      rumorsCompleted: 2,
    });
  });

  it("omits deathCause on a win", () => {
    const state = minimalGameState({
      status: "won",
      mode: { type: "gameover", reason: "won", outcome: "win_pillars" },
    });

    expect(buildPlaytestPayload(state, "won")).toEqual({
      outcome: "won",
      turnsSurvived: 12,
      deathCause: undefined,
      biomesVisited: ["forest", "marsh"],
      rumorsCompleted: 2,
    });
  });

  it("POSTs fire-and-forget with mock fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const state = minimalGameState();

    submitPlaytest(state, "lost", fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/playtests",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "lost",
          turnsSurvived: 12,
          deathCause: "searing",
          biomesVisited: ["forest", "marsh"],
          rumorsCompleted: 2,
        }),
      }),
    );

    await Promise.resolve();
  });

  it("never throws if fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    const state = minimalGameState();

    expect(() => submitPlaytest(state, "won", fetchMock)).not.toThrow();

    await Promise.resolve();
  });
});
