/**
 * Turn invariants:
 * - push/pause: increment turn before phase handler
 * - choose/dismiss: no turn increment
 * - pause defers EOT to dismiss; push/choose/dismiss run EOT when appropriate
 * - applyLossChecks runs before every action while status === "playing"
 */
import { type Action, type GameState, type RNG } from "./state";
import { INVISIBLE_PUSH_MESSAGE, isPushable } from "./visibility";
import { resolveDismiss, resolvePause } from "./turn/camp";
import { applyLossChecks } from "./turn/checks";
import { resolveChoose, resolveRevealEncounter } from "./turn/encounter-resolution";
import { resolveRevealGameOver } from "./turn/game-over-resolution";
import { appendLog } from "./turn/log";
import { resolvePush } from "./turn/movement";

export function resolveTurn(state: GameState, action: Action, rng: RNG): GameState {
  if (action.type === "revealGameOver") {
    return resolveRevealGameOver(state);
  }

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
    case "revealEncounter":
      return resolveRevealEncounter(checkedState);
    case "push": {
      if (!isPushable(checkedState, action)) {
        return appendLog(checkedState, INVISIBLE_PUSH_MESSAGE, "system");
      }
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
