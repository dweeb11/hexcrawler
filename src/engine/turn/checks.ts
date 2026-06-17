import { checkLoss } from "../resources";
import { isConsumed } from "../searing";
import { type GameState } from "../state";
import { enterGameOver, SEARING_LOSS } from "./log";

export function applyLossChecks(state: GameState): GameState {
  if (isConsumed(state.player.hex, state.searing)) {
    return enterGameOver(state, SEARING_LOSS.outcome, SEARING_LOSS.reason);
  }

  const resourceLoss = checkLoss(state.player);
  if (resourceLoss) {
    return enterGameOver(state, resourceLoss.outcome, resourceLoss.reason);
  }

  return state;
}
