import { type LossResult } from "../resources";
import {
  type GameMode,
  type GameOverOutcome,
  type GameState,
  type LogType,
} from "../state";

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

export function getGameOverDetails(
  mode: GameMode,
): { reason: string; outcome: GameOverOutcome } | null {
  switch (mode.type) {
    case "gameover":
    case "pendingGameOver":
      return { reason: mode.reason, outcome: mode.outcome };
    default:
      return null;
  }
}

export function enterGameOver(state: GameState, outcome: GameOverOutcome, reason: string): GameState {
  const status = isWinOutcome(outcome) ? "won" : "lost";
  if (isWinOutcome(outcome)) {
    return {
      ...state,
      status,
      mode: { type: "gameover", reason, outcome },
    };
  }

  return {
    ...state,
    status,
    mode: { type: "pendingGameOver", reason, outcome },
  };
}
