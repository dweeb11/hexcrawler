import { cubeCoord, type CubeCoord } from "./hex";
import { placePillarsCoord } from "./win";
import type {
  ActiveRumor,
  CompletedRumor,
  GameState,
  HexTile,
  Rumor,
  RumorState,
  RumorStep,
} from "./state";

export interface SerializedHexTile {
  readonly coord: HexTile["coord"];
  readonly biome: HexTile["biome"];
  readonly tags: string[];
  readonly encounter: HexTile["encounter"];
  readonly revealed: boolean;
  readonly consumed: boolean;
  readonly visited: boolean;
}

export interface SerializedGameState {
  readonly player: GameState["player"];
  readonly map: Record<string, SerializedHexTile>;
  readonly searing: GameState["searing"];
  readonly turn: number;
  readonly mode: GameState["mode"];
  readonly log: GameState["log"];
  readonly status: GameState["status"];
  readonly encounters: GameState["encounters"];
  readonly rumors: RumorState;
  readonly relics: GameState["relics"];
  readonly stats: GameState["stats"];
  readonly pillarsCoord?: CubeCoord;
}

interface LegacyRumorStep extends RumorStep {
  hint?: string;
}

interface LegacyRumor extends Omit<Rumor, "steps" | "premise"> {
  premise?: string;
  steps: LegacyRumorStep[];
}

function normalizeRumorStep(step: LegacyRumorStep): RumorStep {
  return {
    stepIndex: step.stepIndex,
    stepTitle: step.stepTitle ?? "",
    encounterId: step.encounterId,
    journalHint: step.journalHint ?? step.hint ?? "",
    hintTags: step.hintTags,
    hintBiomes: step.hintBiomes,
  };
}

function normalizeRumorState(rumors: {
  available: LegacyRumor[];
  active: ActiveRumor[];
  completed: CompletedRumor[];
}): RumorState {
  return {
    available: rumors.available.map((rumor) => ({
      id: rumor.id,
      title: rumor.title,
      premise: rumor.premise ?? "",
      steps: rumor.steps.map(normalizeRumorStep),
      reward: rumor.reward,
      hopeBonus: rumor.hopeBonus,
    })),
    active: rumors.active,
    completed: rumors.completed,
  };
}

export function serializeState(state: GameState): SerializedGameState {
  const serializedMap: Record<string, SerializedHexTile> = {};

  for (const [key, tile] of state.map.entries()) {
    serializedMap[key] = {
      coord: tile.coord,
      biome: tile.biome,
      tags: [...tile.tags],
      encounter: tile.encounter,
      revealed: tile.revealed,
      consumed: tile.consumed,
      visited: tile.visited,
    };
  }

  return {
    player: state.player,
    map: serializedMap,
    searing: state.searing,
    turn: state.turn,
    mode: state.mode,
    log: state.log.slice(-50),
    status: state.status,
    encounters: state.encounters,
    rumors: state.rumors,
    relics: state.relics,
    stats: state.stats,
    pillarsCoord: state.pillarsCoord,
  };
}

export function deserializeState(data: any): GameState {
  const map = new Map<string, HexTile>();

  for (const [key, tile] of Object.entries(
    data.map as Record<string, SerializedHexTile>
  )) {
    map.set(key, {
      coord: tile.coord,
      biome: tile.biome,
      tags: new Set(tile.tags),
      encounter: tile.encounter,
      revealed: tile.revealed,
      consumed: tile.consumed,
      visited: tile.visited ?? false,
    });
  }

  return {
    player: data.player,
    map,
    searing: data.searing,
    turn: data.turn,
    mode: data.mode,
    log: data.log,
    status: data.status,
    encounters: data.encounters,
    rumors: data.rumors
      ? normalizeRumorState(data.rumors)
      : { available: [], active: [], completed: [] },
    relics: data.relics ?? [],
    pillarsCoord:
      data.pillarsCoord ??
      placePillarsCoord(cubeCoord(0, 0, 0), data.searing, () => 0.5),
    stats: data.stats ?? {
      hexesExplored: 0,
      encountersResolved: 0,
      rumorsDiscovered: 0,
      rumorsCompleted: 0,
      relicsCollected: 0,
    },
  };
}
