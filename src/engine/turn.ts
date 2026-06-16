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

  switch (action.type) {
    case "choose":
      return resolveChoose(checkedState, action, rng);
    case "dismiss":
      return resolveDismiss(checkedState);
    case "push": {
      const advancedState = { ...checkedState, turn: checkedState.turn + 1 };
      return resolvePush(advancedState, action, rng);
    }
    case "pause": {
      const advancedState = { ...checkedState, turn: checkedState.turn + 1 };
      return resolvePause(advancedState, action, rng);
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
