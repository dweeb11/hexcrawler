import { rollNightIncident } from "../data/incidents";
import { coordKey } from "../hex";
import { getForageBonus } from "../relics";
import { applyDelta, forageResult } from "../resources";
import { type Action, type GameState, type LogEntry, type RNG } from "../state";
import { appendLog, applyEndOfTurnEffects } from "./end-of-turn";

export function resolvePause(
  state: GameState,
  action: Extract<Action, { type: "pause" }>,
  rng: RNG,
): GameState {
  const currentHex = state.map.get(coordKey(state.player.hex));
  if (!currentHex) {
    return appendLog(state, "There is nowhere to make camp here.", "system");
  }

  let nextState = state;
  let resultText = "";

  if (action.activity === "rest") {
    nextState = {
      ...nextState,
      player: applyDelta(nextState.player, { health: 1 }, nextState.relics),
    };
    resultText = "You rest beneath scant shelter and recover 1 Health.";
  } else {
    const forage = forageResult(
      currentHex.biome,
      currentHex.tags,
      rng,
      getForageBonus(state.relics),
    );
    nextState = {
      ...nextState,
      player: applyDelta(nextState.player, forage.delta, nextState.relics),
    };
    resultText = forage.text;
  }

  const incident = rollNightIncident(rng);
  let incidentLog: LogEntry | null = null;
  if (incident) {
    nextState = {
      ...nextState,
      player: applyDelta(nextState.player, incident.delta, nextState.relics),
    };
    incidentLog = { turn: nextState.turn, text: incident.text, type: "narrative" };
  }

  nextState = appendLog(nextState, resultText, "resource");
  if (incidentLog) {
    nextState = appendLog(nextState, incidentLog.text, incidentLog.type ?? "narrative");
  }

  return {
    ...nextState,
    mode: {
      type: "camp",
      result: { turn: nextState.turn, text: resultText, type: "resource" },
      incident: incidentLog,
    },
  };
}

export function resolveDismiss(state: GameState): GameState {
  if (state.mode.type !== "camp") {
    return state;
  }

  return applyEndOfTurnEffects({
    ...state,
    mode: { type: "map" },
  });
}
