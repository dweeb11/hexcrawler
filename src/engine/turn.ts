import { coordKey, neighbor } from "./hex";
import { resolveChoice } from "./encounters";
import { encounterForHope } from "./encounters";
import { generateHex } from "./map";
import { applyDelta, checkLoss, forageResult, type LossResult } from "./resources";
import { advanceSearing, isConsumed, searingDistance, shouldAdvance } from "./searing";
import { rollNightIncident } from "./data/incidents";
import {
  getHopeDecayInterval,
  getMoveDiscount,
  getForageBonus,
} from "./relics";
import {
  buildRumorContext,
  findNextRumorStep,
  applyRumorWeights,
  resolveRumorAfterEncounter,
  resolveRumorDiscovery,
  shouldBoostRumorDiscovery,
  type RumorEffects,
} from "./rumors";
import { checkPillarsOfFrost, checkRestartTheGear, frostProximityBand } from "./win";
import {
  type Action,
  type GameOverOutcome,
  type GameState,
  type LogEntry,
  type LogType,
  type RNG,
} from "./state";

const FROST_PROXIMITY_MESSAGES: Record<1 | 2 | 3, string> = {
  1: "A faint chill drifts from the north. The air is colder here.",
  2: "Ice crystals trace the stones at your feet. The cold deepens.",
  3: "The temperature plummets. Frost coats everything. The Pillars must be close.",
};

function appendLog(state: GameState, text: string, type: LogType = "narrative"): GameState {
  return {
    ...state,
    log: [...state.log, { turn: state.turn, text, type }],
  };
}

function applyRumorEffects(state: GameState, effects: RumorEffects): GameState {
  let nextState: GameState = {
    ...state,
    rumors: effects.rumors,
    stats: {
      ...state.stats,
      ...(effects.statsDelta.rumorsDiscovered
        ? { rumorsDiscovered: state.stats.rumorsDiscovered + effects.statsDelta.rumorsDiscovered }
        : {}),
      ...(effects.statsDelta.rumorsCompleted
        ? { rumorsCompleted: state.stats.rumorsCompleted + effects.statsDelta.rumorsCompleted }
        : {}),
      ...(effects.statsDelta.relicsCollected
        ? { relicsCollected: state.stats.relicsCollected + effects.statsDelta.relicsCollected }
        : {}),
    },
    ...(effects.relicsToAdd.length > 0
      ? { relics: [...state.relics, ...effects.relicsToAdd] }
      : {}),
    ...(effects.hopeDelta
      ? { player: applyDelta(state.player, { hope: effects.hopeDelta }, state.relics) }
      : {}),
  };

  for (const entry of effects.logs) {
    nextState = appendLog(nextState, entry.text, entry.type);
  }

  return nextState;
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

const SEARING_LOSS: LossResult = {
  outcome: "loss_searing",
  reason: "The Searing catches you. In the end, you could not outrun the sun.",
};

function enterGameOver(state: GameState, outcome: GameOverOutcome, reason: string): GameState {
  return {
    ...state,
    status: outcome.startsWith("win_") ? "won" : "lost",
    mode: { type: "gameover", reason, outcome },
  };
}

function applyLossChecks(state: GameState): GameState {
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

function applyEndOfTurnEffects(state: GameState): GameState {
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

function handlePush(state: GameState, action: Extract<Action, { type: "push" }>, rng: RNG): GameState {
  const moveDiscount = getMoveDiscount(state.relics);
  const isFreeMove = rng() < moveDiscount;

  if (!isFreeMove && state.player.supply <= 0) {
    return appendLog(
      state,
      "You have no Supply left. Pause and forage, or pause and rest.",
      "system",
    );
  }

  const destination = neighbor(state.player.hex, action.direction);
  let nextState: GameState = {
    ...state,
    player: applyDelta(state.player, { supply: isFreeMove ? 0 : -1 }, state.relics),
  };

  const map = new Map(nextState.map);
  const key = coordKey(destination);

  if (!map.has(key)) {
    const rumorWeights = applyRumorWeights(state.rumors);
    const boostDiscovery = shouldBoostRumorDiscovery(state.rumors);
    map.set(
      key,
      generateHex(
        destination,
        map,
        nextState.encounters,
        rng,
        nextState.searing,
        rumorWeights,
        boostDiscovery,
      ),
    );
  }

  const destinationTile = map.get(key);
  if (!destinationTile) {
    return appendLog(nextState, "The path ahead refuses to resolve.", "system");
  }

  const isNewHex = !destinationTile.visited;
  const enteredTile = { ...destinationTile, visited: true };
  map.set(key, enteredTile);

  nextState = {
    ...nextState,
    map,
    player: { ...nextState.player, hex: destination },
    ...(isNewHex
      ? { stats: { ...nextState.stats, hexesExplored: nextState.stats.hexesExplored + 1 } }
      : {}),
  };
  nextState = appendLog(
    nextState,
    isFreeMove
      ? `You push onward into ${enteredTile.biome}. The way is free.`
      : `You push onward into ${enteredTile.biome}. (-1 Supply)`,
    "resource",
  );

  // Frost proximity: emit a signal when crossing into a new band (closer to the Pillars).
  const oldBand = frostProximityBand(searingDistance(state.player.hex, state.searing));
  const newBand = frostProximityBand(searingDistance(destination, state.searing));
  if (newBand > oldBand) {
    nextState = appendLog(nextState, FROST_PROXIMITY_MESSAGES[newBand as 1 | 2 | 3], "narrative");
  }

  // Entering an already-consumed hex is an immediate loss, even if an encounter exists there.
  if (enteredTile.consumed || isConsumed(enteredTile.coord, nextState.searing)) {
    return enterGameOver(nextState, SEARING_LOSS.outcome, SEARING_LOSS.reason);
  }

  const rumorMatch = findNextRumorStep(
    state.rumors,
    enteredTile.tags,
    enteredTile.biome,
  );
  if (rumorMatch) {
    const rumorEncounter = state.encounters.find(
      (e) => e.id === rumorMatch.step.encounterId,
    );
    if (rumorEncounter) {
      const resolvedEncounter = encounterForHope(rumorEncounter, nextState.player.hope);
      return {
        ...nextState,
        mode: {
          type: "encounter",
          encounter: resolvedEncounter,
          hex: enteredTile.coord,
          rumorContext: buildRumorContext(rumorMatch.rumor, rumorMatch.active.currentStep),
        },
      };
    }
  }

  if (enteredTile.encounter) {
    const resolvedEncounter = encounterForHope(enteredTile.encounter, nextState.player.hope);
    const clearedTile = { ...enteredTile, encounter: null };
    map.set(key, clearedTile);
    return {
      ...nextState,
      map: new Map(map),
      mode: {
        type: "encounter",
        encounter: resolvedEncounter,
        hex: destination,
      },
      log: [
        ...nextState.log,
        { turn: nextState.turn, text: resolvedEncounter.text, type: "narrative" },
      ],
    };
  }

  return applyEndOfTurnEffects(nextState);
}

function handlePause(state: GameState, action: Extract<Action, { type: "pause" }>, rng: RNG): GameState {
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

function handleChoose(state: GameState, action: Extract<Action, { type: "choose" }>, rng: RNG): GameState {
  if (state.mode.type !== "encounter") {
    return state;
  }

  const encounterMode = state.mode;
  const choice = encounterMode.encounter.choices[action.choiceIndex];
  if (!choice) {
    return appendLog(state, "You hesitate. No such choice presents itself.", "system");
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
function handleDismiss(state: GameState): GameState {
  if (state.mode.type !== "camp") {
    return state;
  }

  return applyEndOfTurnEffects({
    ...state,
    mode: { type: "map" },
  });
}

export function resolveTurn(state: GameState, action: Action, rng: RNG): GameState {
  if (state.status !== "playing") {
    return state;
  }

  const checkedState = applyLossChecks(state);
  if (checkedState.status !== "playing") {
    return checkedState;
  }

  if (action.type === "choose") {
    return handleChoose(checkedState, action, rng);
  }

  if (action.type === "dismiss") {
    return handleDismiss(checkedState);
  }

  const advancedState = { ...checkedState, turn: checkedState.turn + 1 };

  if (action.type === "push") {
    return handlePush(advancedState, action, rng);
  }

  if (action.type === "pause") {
    return handlePause(advancedState, action, rng);
  }

  return advancedState;
}
