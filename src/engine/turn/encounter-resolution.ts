import { resolveChoice } from "../encounters";
import { applyDelta } from "../resources";
import {
  applyRumorEffects,
  resolveRumorAfterEncounter,
  resolveRumorDiscovery,
} from "../rumors";
import { resolveSpecialWinChoice } from "../win-encounters";
import { type Action, type GameState, type RNG } from "../state";
import { appendLog, enterGameOver } from "./log";
import { applyEndOfTurnEffects } from "./end-of-turn";

export function resolveRevealEncounter(state: GameState): GameState {
  if (state.mode.type !== "pendingEncounter") {
    return state;
  }

  const pending = state.mode;
  return {
    ...state,
    mode: {
      type: "encounter",
      encounter: pending.encounter,
      hex: pending.hex,
      ...(pending.rumorContext ? { rumorContext: pending.rumorContext } : {}),
    },
  };
}

export function resolveChoose(
  state: GameState,
  action: Extract<Action, { type: "choose" }>,
  rng: RNG,
): GameState {
  if (state.mode.type !== "encounter") {
    return state;
  }

  const encounterMode = state.mode;
  const choice = encounterMode.encounter.choices[action.choiceIndex];
  if (!choice) {
    return appendLog(state, "You hesitate. No such choice presents itself.", "system");
  }

  const winResolution = resolveSpecialWinChoice(encounterMode.encounter.id, action.choiceIndex);
  if (winResolution?.type === "win") {
    return enterGameOver(
      {
        ...state,
        stats: { ...state.stats, encountersResolved: state.stats.encountersResolved + 1 },
      },
      winResolution.outcome,
      winResolution.reason,
    );
  }
  if (winResolution?.type === "decline") {
    return { ...state, mode: { type: "map" } };
  }

  const outcome = resolveChoice(choice, rng);
  let nextState: GameState = {
    ...state,
    player: applyDelta(state.player, outcome.delta, state.relics),
    mode: { type: "map" },
    stats: { ...state.stats, encountersResolved: state.stats.encountersResolved + 1 },
  };

  if (choice.discoversRumor) {
    const discovery = resolveRumorDiscovery(nextState.rumors, choice.discoversRumor);
    if (discovery) {
      nextState = applyRumorEffects(nextState, discovery);
    }
  }

  const rumorAdvance = resolveRumorAfterEncounter(
    state.rumors,
    encounterMode.encounter.id,
    state.turn,
  );
  if (rumorAdvance) {
    nextState = applyRumorEffects(nextState, rumorAdvance);
  }

  const text = outcome.succeeded
    ? `You choose "${choice.label}" and it pays off.`
    : `You choose "${choice.label}" and pay for the risk.`;
  nextState = appendLog(nextState, text, "narrative");

  return applyEndOfTurnEffects(nextState);
}
