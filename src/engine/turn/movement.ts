import { encounterForHope } from "../encounters";
import { coordKey, neighbor, type CubeCoord } from "../hex";
import { generateHex } from "../map";
import { getMoveDiscount } from "../relics";
import { applyDelta } from "../resources";
import {
  applyRumorWeights,
  buildRumorContext,
  findNextRumorStep,
  shouldBoostRumorDiscovery,
} from "../rumors";
import { isConsumed } from "../searing";
import {
  type Encounter,
  type GameState,
  type HexTile,
  type RNG,
  type RumorContext,
  type Action,
} from "../state";
import {
  checkRestartTheGear,
  distanceToPillars,
  frostProximityBand,
  isInSafeCorridor,
  isPillarsCoord,
} from "../win";
import {
  GEAR_RITUAL_ENCOUNTER,
  PILLARS_WIN_ENCOUNTER,
} from "../win-encounters";
import { applyLossChecks } from "./checks";
import { applyEndOfTurnEffects } from "./end-of-turn";
import { appendLog, enterGameOver, SEARING_LOSS } from "./log";

const FROST_PROXIMITY_MESSAGES: Record<1 | 2 | 3, string> = {
  1: "A faint chill drifts from the north. The air is colder here.",
  2: "Ice crystals trace the stones at your feet. The cold deepens.",
  3: "The temperature plummets. Frost coats everything. The Pillars must be close.",
};

function enterEncounter(
  state: GameState,
  encounter: Encounter,
  hex: CubeCoord,
  options?: {
    rumorContext?: RumorContext;
    map?: Map<string, HexTile>;
    logEncounterText?: boolean;
  },
): GameState {
  const afterLossCheck = applyLossChecks(state);
  if (afterLossCheck.status !== "playing") {
    return afterLossCheck;
  }

  let nextState: GameState = {
    ...afterLossCheck,
    ...(options?.map ? { map: options.map } : {}),
    mode: {
      type: "pendingEncounter",
      encounter,
      hex,
      ...(options?.rumorContext ? { rumorContext: options.rumorContext } : {}),
    },
  };

  if (options?.logEncounterText) {
    nextState = appendLog(nextState, encounter.text, "narrative");
  }

  return nextState;
}

export function resolvePush(
  state: GameState,
  action: Extract<Action, { type: "push" }>,
  rng: RNG,
): GameState {
  const moveDiscount = getMoveDiscount(state.relics);
  const isFreeMove = rng() < moveDiscount;
  const starvingMove = !isFreeMove && state.player.supply <= 0;

  const destination = neighbor(state.player.hex, action.direction);
  let nextState: GameState = {
    ...state,
    player: applyDelta(
      state.player,
      isFreeMove ? {} : starvingMove ? { health: -1 } : { supply: -1 },
      state.relics,
    ),
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
        nextState.pillarsCoord,
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
      : starvingMove
        ? `You push onward into ${enteredTile.biome}. Your body pays the toll. (-1 Health)`
        : `You push onward into ${enteredTile.biome}. (-1 Supply)`,
    "resource",
  );

  const oldBand = frostProximityBand(distanceToPillars(state.player.hex, state.pillarsCoord));
  const newBand = frostProximityBand(distanceToPillars(destination, state.pillarsCoord));
  if (
    newBand > oldBand &&
    isInSafeCorridor(destination, state.pillarsCoord, state.searing)
  ) {
    nextState = appendLog(nextState, FROST_PROXIMITY_MESSAGES[newBand as 1 | 2 | 3], "narrative");
  }

  if (enteredTile.consumed || isConsumed(enteredTile.coord, nextState.searing)) {
    return enterGameOver(nextState, SEARING_LOSS.outcome, SEARING_LOSS.reason);
  }

  if (isPillarsCoord(destination, state.pillarsCoord)) {
    const resolvedEncounter = encounterForHope(PILLARS_WIN_ENCOUNTER, nextState.player.hope);
    return enterEncounter(nextState, resolvedEncounter, destination, { map });
  }

  if (checkRestartTheGear(state.relics)) {
    const resolvedEncounter = encounterForHope(GEAR_RITUAL_ENCOUNTER, nextState.player.hope);
    return enterEncounter(nextState, resolvedEncounter, destination, { map });
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
      return enterEncounter(nextState, resolvedEncounter, enteredTile.coord, {
        rumorContext: buildRumorContext(rumorMatch.rumor, rumorMatch.active.currentStep),
      });
    }
  }

  if (enteredTile.encounter) {
    const resolvedEncounter = encounterForHope(enteredTile.encounter, nextState.player.hope);
    const clearedTile = { ...enteredTile, encounter: null };
    map.set(key, clearedTile);
    return enterEncounter(nextState, resolvedEncounter, destination, {
      map: new Map(map),
      logEncounterText: true,
    });
  }

  return applyEndOfTurnEffects(nextState);
}
