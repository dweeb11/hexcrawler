import { type LossResult } from "../resources";
import { type GameOverOutcome, type GameState, type LogType } from "../state";

export function appendLog(state: GameState, text: string, type: LogType = "narrative"): GameState {
  return {
    ...state,
    log: [...state.log, { turn: state.turn, text, type }],
  };
}

export const SEARING_LOSS: LossResult = {
  outcome: "loss_searing",
  reason: "The Searing catches you. In the end, you could not outrun the sun.",
};

export function isWinOutcome(outcome: GameOverOutcome): outcome is Extract<GameOverOutcome, `win_${string}`> {
  switch (outcome) {
    case "win_pillars":
    case "win_gear":
      return true;
    case "loss_health":
    case "loss_hope":
    case "loss_searing":
      return false;
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

export function enterGameOver(state: GameState, outcome: GameOverOutcome, reason: string): GameState {
  return {
    ...state,
    status: isWinOutcome(outcome) ? "won" : "lost",
    mode: { type: "gameover", reason, outcome },
  };
}
