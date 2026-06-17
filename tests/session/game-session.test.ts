import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsClient } from "../../src/api/analytics";
import { createInitialState } from "../../src/engine/state";
import { createGameSession, type GameSessionDeps } from "../../src/session/game-session";
import { seededRng } from "../helpers";

function createMockDeps(rng = seededRng(42)): GameSessionDeps & {
  persistence: { save: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
} {
  const persistence = {
    save: vi.fn(),
    clear: vi.fn(),
  };

  const analytics: AnalyticsClient = {
    sessionId: "test-session",
    track: vi.fn(),
  };

  return {
    getRng: () => rng,
    getAnalytics: () => analytics,
    audio: {
      playMove: vi.fn(),
      playEncounterOpen: vi.fn(),
      playChoiceSelect: vi.fn(),
      playSearingAdvance: vi.fn(),
      playForage: vi.fn(),
      playRest: vi.fn(),
      playWin: vi.fn(),
      playLoss: vi.fn(),
    },
    hints: { dismissHint: vi.fn() },
    persistence,
    playtest: { submit: vi.fn() },
  };
}

describe("createGameSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatch returns updated state and saves while playing", () => {
    const deps = createMockDeps();
    const initialState = createInitialState([], deps.getRng());
    const session = createGameSession(initialState, deps);

    const next = session.dispatch({ type: "push", direction: 0 });

    expect(next.turn).toBeGreaterThan(initialState.turn);
    expect(next).toBe(session.getState());
    expect(deps.persistence.save).toHaveBeenCalledWith(next);
    expect(deps.persistence.clear).not.toHaveBeenCalled();
  });

  it("dispatch clears save on game over", () => {
    const deps = createMockDeps();
    const initialState = createInitialState([], deps.getRng());
    const session = createGameSession(
      {
        ...initialState,
        player: { ...initialState.player, health: 0 },
      },
      deps,
    );

    const next = session.dispatch({ type: "push", direction: 0 });

    expect(next.status).toBe("lost");
    expect(deps.persistence.clear).toHaveBeenCalled();
    expect(deps.persistence.save).not.toHaveBeenCalled();
  });

  it("restart resets state and clears save", () => {
    const deps = createMockDeps();
    const initialState = createInitialState([], deps.getRng());
    const session = createGameSession(initialState, deps);
    session.dispatch({ type: "push", direction: 0 });

    const freshState = createInitialState([], deps.getRng());
    session.restart(freshState);

    expect(session.getState()).toBe(freshState);
    expect(deps.persistence.clear).toHaveBeenCalled();
  });
});
