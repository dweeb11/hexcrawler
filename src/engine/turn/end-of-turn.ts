import { applyDelta, checkLoss, type LossResult } from "../resources";
import { getHopeDecayInterval } from "../relics";
import { advanceSearing, isConsumed, shouldAdvance } from "../searing";
import { checkPillarsOfFrost, checkRestartTheGear } from "../win";
import { type GameOverOutcome, type GameState, type LogType } from "../state";

export function appendLog(state: GameState, text: string, type: LogType = "narrative"): GameState {
  return {
    ...state,
    log: [...state.log, { turn: state.turn, text, type }],
  };
}

function markConsumedTiles(state: GameState): GameState {
  const nextMap = new Map<string, (typeof state.map extends Map<string, infer T> ? T : never)>();
  for (const [key, tile] of state.map.entries()) {
    nextMap.set(
      key,
      tile.consumed || !isConsumed(tile.coord, state.searing)
        ? tile
        : { ...tile, consumed: true },
    );
  }

  return { ...state, map: nextMap };
}

export const SEARING_LOSS: LossResult = {
  outcome: "loss_searing",
  reason: "The Searing catches you. In the end, you could not outrun the sun.",
};

export function enterGameOver(state: GameState, outcome: GameOverOutcome, reason: string): GameState {
  return {
    ...state,
    status: outcome.startsWith("win_") ? "won" : "lost",
    mode: { type: "gameover", reason, outcome },
  };
}

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

function applyWinChecks(state: GameState): GameState {
  if (state.status !== "playing") {
    return state;
  }

  if (checkPillarsOfFrost(state.player.hex, state.searing)) {
    return enterGameOver(
      state,
      "win_pillars",
      "You stand before the Pillars of Frost, monuments to a world that was. The Searing is far behind. You are safe — for now.",
    );
  }

  if (checkRestartTheGear(state.relics)) {
    return enterGameOver(
      state,
      "win_gear",
      "The Gear turns. The mechanism groans to life. The sun shudders — and moves. You have restarted the world.",
    );
  }

  return state;
}

export function applyEndOfTurnEffects(state: GameState): GameState {
  let nextState = state;
  const hopeDecayInterval = getHopeDecayInterval(state.relics);

  if (nextState.turn > 0 && nextState.turn % hopeDecayInterval === 0) {
    nextState = {
      ...nextState,
      player: applyDelta(nextState.player, { hope: -1 }, nextState.relics),
    };
    nextState = appendLog(nextState, "The road wears at your resolve. (-1 Hope)", "resource");
  }

  if (shouldAdvance(nextState.turn, nextState.searing.advanceRate)) {
    nextState = {
      ...nextState,
      searing: advanceSearing(nextState.searing),
    };
    nextState = appendLog(nextState, "The Searing advances.", "searing");
    nextState = markConsumedTiles(nextState);
  }

  return applyWinChecks(applyLossChecks(nextState));
}
