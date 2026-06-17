import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGameSession, type GameSessionDeps } from "../src/game-session";
import { createInitialState, type GameState } from "../src/engine/state";
import { seededRng } from "./helpers";

function createMockDeps(rng = seededRng(42)) {
  const persistState = vi.fn<(state: GameState) => void>();
  const deps: GameSessionDeps = {
    rng,
    analytics: { sessionId: "test", track: vi.fn() },
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
    dismissHint: vi.fn(),
    persistState,
    submitPlaytest: vi.fn(),
  };
  return { deps, persistState };
}

describe("createGameSession", () => {
  let deps: GameSessionDeps;
  let persistState: ReturnType<typeof vi.fn<(state: GameState) => void>>;
  let initialState: GameState;

  beforeEach(() => {
    const mocks = createMockDeps();
    deps = mocks.deps;
    persistState = mocks.persistState;
    initialState = createInitialState([], deps.rng);
  });

  it("dispatch returns updated state and persists while playing", () => {
    const session = createGameSession(initialState, deps);
    const next = session.dispatch({ type: "push", direction: 0 });

    expect(next.turn).toBe(initialState.turn + 1);
    expect(session.getState()).toBe(next);
    expect(persistState).toHaveBeenCalledOnce();
    expect(persistState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "playing" }),
    );
  });

  it("dispatch persists cleared state on game over", () => {
    const starvingState: GameState = {
      ...initialState,
      player: { ...initialState.player, supply: 0, health: 1 },
    };
    const session = createGameSession(starvingState, deps);
    const next = session.dispatch({ type: "push", direction: 0 });

    expect(next.status).toBe("lost");
    expect(persistState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "lost" }),
    );
  });

  it("restart replaces internal state", () => {
    const session = createGameSession(initialState, deps);
    session.dispatch({ type: "push", direction: 0 });

    const freshState = createInitialState([], deps.rng);
    session.restart(freshState);

    expect(session.getState()).toBe(freshState);
    expect(session.getState().turn).toBe(0);
  });
});
