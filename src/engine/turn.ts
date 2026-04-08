import { coordKey, neighbor } from "./hex";
import { resolveChoice } from "./encounters";
import { encounterForHope } from "./encounters";
import { generateHex } from "./map";
import { applyDelta, forageResult } from "./resources";
import { advanceSearing, isConsumed, shouldAdvance } from "./searing";
import { rollNightIncident } from "./data/incidents";
import {
  getHopeDecayInterval,
  getMoveDiscount,
  getForageBonus,
} from "./relics";
import {
  findNextRumorStep,
  advanceRumor,
  completeRumor,
  discoverRumor,
  applyRumorWeights,
} from "./rumors";
import { checkPillarsOfFrost, checkRestartTheGear, frostProximityBand, frostProximityDistance } from "./win";
import {
  type Action,
  type GameState,
  type GameStats,
  type LogEntry,
  type LogType,
  type RNG,
  type RumorState,
  type Relic,
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
        reason: "The Searing catches you. In the end, you could not outrun the sun.",
        outcome: "loss_searing",
      },
    };
  }

  if (state.player.health <= 0) {
    return {
      ...state,
      status: "lost",
      mode: {
        type: "gameover",
        reason: "Your body gives out. The Twilight Strip claims another.",
        outcome: "loss_health",
      },
    };
  }

  if (state.player.hope <= 0) {
    return {
      ...state,
      status: "lost",
      mode: {
        type: "gameover",
        reason: "The light inside you fades. You sit down, and do not rise.",
        outcome: "loss_hope",
      },
    };
  }

  return state;
}

function applyWinChecks(state: GameState): GameState {
  if (state.status !== "playing") {
    return state;
  }

  if (checkPillarsOfFrost(state.player.hex, state.searing)) {
    return {
      ...state,
      status: "won",
      mode: {
        type: "gameover",
        reason:
          "You stand before the Pillars of Frost, monuments to a world that was. The Searing is far behind. You are safe — for now.",
        outcome: "win_pillars",
      },
    };
  }

  if (checkRestartTheGear(state.relics)) {
    return {
      ...state,
      status: "won",
      mode: {
        type: "gameover",
        reason:
          "The Gear turns. The mechanism groans to life. The sun shudders — and moves. You have restarted the world.",
        outcome: "win_gear",
      },
    };
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
    map.set(
      key,
      generateHex(destination, map, nextState.encounters, rng, nextState.searing, rumorWeights),
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
  const oldBand = frostProximityBand(frostProximityDistance(state.player.hex, state.searing));
  const newBand = frostProximityBand(frostProximityDistance(destination, state.searing));
  if (newBand > oldBand) {
    nextState = appendLog(nextState, FROST_PROXIMITY_MESSAGES[newBand as 1 | 2 | 3], "narrative");
  }

  // Entering an already-consumed hex is an immediate loss, even if an encounter exists there.
  if (enteredTile.consumed || isConsumed(enteredTile.coord, nextState.searing)) {
    return {
      ...nextState,
      status: "lost",
      mode: {
        type: "gameover",
        reason: "The Searing catches you. In the end, you could not outrun the sun.",
        outcome: "loss_searing",
      },
    };
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

function checkRumorAdvancement(
  state: GameState,
  encounterId: string,
): { rumors: RumorState; reward: Relic | null; hopeBonus: number } | null {
  const activeRumor = state.rumors.active.find((active) => {
    const rumor = state.rumors.available.find((r) => r.id === active.rumorId);
    return rumor?.steps[active.currentStep]?.encounterId === encounterId;
  });

  if (!activeRumor) return null;

  const rumor = state.rumors.available.find((r) => r.id === activeRumor.rumorId);
  if (!rumor) return null;

  const nextStep = activeRumor.currentStep + 1;
  if (nextStep >= rumor.steps.length) {
    // completed
    return {
      rumors: completeRumor(state.rumors, rumor.id, state.turn),
      reward: rumor.reward,
      hopeBonus: rumor.hopeBonus,
    };
  }
  // advanced
  const newActive = { ...activeRumor, currentStep: nextStep };
  return {
    rumors: {
      ...state.rumors,
      active: state.rumors.active.map((a) =>
        a.rumorId === newActive.rumorId ? newActive : a,
      ),
    },
    reward: null,
    hopeBonus: 0,
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
    stats: { ...state.stats, encountersResolved: state.stats.encountersResolved + 1 },
  };

  if (choice.discoversRumor) {
    nextState = {
      ...nextState,
      rumors: discoverRumor(nextState.rumors, choice.discoversRumor),
      stats: { ...nextState.stats, rumorsDiscovered: nextState.stats.rumorsDiscovered + 1 },
    };
    const rumor = nextState.rumors.available.find(
      (r) => r.id === choice.discoversRumor,
    );
    if (rumor) {
      nextState = appendLog(
        nextState,
        `A new lead: "${rumor.title}"`,
        "narrative",
      );
    }
  }

  const rumorAdvance = checkRumorAdvancement(state, state.mode.encounter.id);
  if (rumorAdvance) {
    const rumorCompleted = rumorAdvance.rumors.completed.length > state.rumors.completed.length;
    const statsUpdate: Partial<GameStats> = {};
    if (rumorCompleted) statsUpdate.rumorsCompleted = nextState.stats.rumorsCompleted + 1;
    if (rumorAdvance.reward) statsUpdate.relicsCollected = nextState.stats.relicsCollected + 1;
    nextState = {
      ...nextState,
      rumors: rumorAdvance.rumors,
      ...(rumorAdvance.reward
        ? { relics: [...nextState.relics, rumorAdvance.reward] }
        : {}),
      player: rumorAdvance.hopeBonus
        ? applyDelta(nextState.player, { hope: rumorAdvance.hopeBonus })
        : nextState.player,
      stats: { ...nextState.stats, ...statsUpdate },
    };
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
