import { type GameState } from "../state";

export function resolveRevealGameOver(state: GameState): GameState {
  if (state.mode.type !== "pendingGameOver") {
    return state;
  }

  const pending = state.mode;
  return {
    ...state,
    mode: { type: "gameover", reason: pending.reason, outcome: pending.outcome },
  };
}
