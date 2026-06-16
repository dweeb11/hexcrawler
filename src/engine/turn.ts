/**
 * Turn invariants:
 * - push/pause: increment turn before phase handler
 * - choose/dismiss: no turn increment
 * - pause defers EOT to dismiss; push/choose/dismiss run EOT when appropriate
 * - applyLossChecks runs before every action while status === "playing"
 */
import { type Action, type GameState, type RNG } from "./state";
import { resolveDismiss, resolvePause } from "./turn/camp";
import { applyLossChecks } from "./turn/end-of-turn";
import { resolveChoose } from "./turn/encounter-resolution";
import { resolvePush } from "./turn/movement";

export function resolveTurn(state: GameState, action: Action, rng: RNG): GameState {
  if (state.status !== "playing") {
    return state;
  }

  const checkedState = applyLossChecks(state);
  if (checkedState.status !== "playing") {
    return checkedState;
  }

  if (action.type === "choose") {
    return resolveChoose(checkedState, action, rng);
  }

  if (action.type === "dismiss") {
    return resolveDismiss(checkedState);
  }

  const advancedState = { ...checkedState, turn: checkedState.turn + 1 };

  if (action.type === "push") {
    return resolvePush(advancedState, action, rng);
  }

  if (action.type === "pause") {
    return resolvePause(advancedState, action, rng);
  }

  return advancedState;
}
