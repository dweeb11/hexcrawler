import { coordKey, neighbor } from "./hex";
import { resolveChoice } from "./encounters";
import { generateHex } from "./map";
import { applyDelta, checkLoss, forageResult } from "./resources";
import { advanceSearing, isConsumed, shouldAdvance } from "./searing";
import { rollNightIncident } from "./data/incidents";
import {
  getHopeDecayInterval,
  getMoveDiscount,
  getForageBonus,
} from "./relics";
import {
  type Action,
  type GameState,
  type LogEntry,
  type LogType,
  type RNG,
} from "./state";

function appendLog(state: GameState, text: string, type: LogType = "narrative"): GameState {
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

function applyLossChecks(state: GameState): GameState {
  if (isConsumed(state.player.hex, state.searing)) {
    return {
      ...state,
      status: "lost",
      mode: {
        type: "gameover",
        reason: "The Searing catches you. There is no shelter from the light.",
      },
    };
  }

  const lossReason = checkLoss(state.player);
  if (!lossReason) {
    return state;
  }

  return {
    ...state,
    status: "lost",
    mode: { type: "gameover", reason: lossReason },
  };
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

  return applyLossChecks(nextState);
}

function handlePush(state: GameState, action: Extract<Action, { type: "push" }>, rng: RNG): GameState {
  const moveDiscount = getMoveDiscount(state.relics);
  if (rng() < moveDiscount) {
    return appendLog(
      state,
      "Your footing is light and your pack feels weightless. The way is free.",
      "narrative",
    );
  }

  if (state.player.supply <= 0) {
    return appendLog(
      state,
      "You have no Supply left. Pause and forage, or pause and rest.",
      "system",
    );
  }

  const destination = neighbor(state.player.hex, action.direction);
  let nextState: GameState = {
    ...state,
    player: applyDelta(state.player, { supply: -1 }, state.relics),
  };

  const map = new Map(nextState.map);
  const key = coordKey(destination);

  if (!map.has(key)) {
    map.set(key, generateHex(destination, map, nextState.encounters, rng, nextState.searing));
  }

  const destinationTile = map.get(key);
  if (!destinationTile) {
    return appendLog(nextState, "The path ahead refuses to resolve.", "system");
  }

  const enteredTile = { ...destinationTile, visited: true };
  map.set(key, enteredTile);

  nextState = {
    ...nextState,
    map,
    player: { ...nextState.player, hex: destination },
  };
  nextState = appendLog(
    nextState,
    `You push onward into ${enteredTile.biome}. (-1 Supply)`,
    "resource",
  );

  if (enteredTile.encounter) {
    const clearedTile = { ...enteredTile, encounter: null };
    map.set(key, clearedTile);
    return {
      ...nextState,
      map: new Map(map),
      mode: {
        type: "encounter",
        encounter: enteredTile.encounter,
        hex: destination,
      },
      log: [
        ...nextState.log,
        { turn: nextState.turn, text: enteredTile.encounter.text, type: "narrative" },
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
      getForageBonus(state.relics)
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

  const choice = state.mode.encounter.choices[action.choiceIndex];
  if (!choice) {
    return appendLog(state, "You hesitate. No such choice presents itself.", "system");
  }

  const outcome = resolveChoice(choice, rng);
  let nextState: GameState = {
    ...state,
    player: applyDelta(state.player, outcome.delta, state.relics),
    mode: { type: "map" },
  };

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

  if (action.type === "choose") {
    return handleChoose(state, action, rng);
  }

  if (action.type === "dismiss") {
    return handleDismiss(state);
  }

  const advancedState = { ...state, turn: state.turn + 1 };

  if (action.type === "push") {
    return handlePush(advancedState, action, rng);
  }

  if (action.type === "pause") {
    return handlePause(advancedState, action, rng);
  }

  return advancedState;
}
