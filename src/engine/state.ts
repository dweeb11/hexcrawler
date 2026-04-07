import { coordKey, cubeCoord, type CubeCoord, type HexDirection } from "./hex";

export type Biome = "forest" | "mountain" | "ruins" | "settlement" | "wastes";
export type HexAxis = "q" | "r" | "s";
export type RNG = () => number;

export interface ResourceDelta {
  readonly supply?: number;
  readonly hope?: number;
  readonly health?: number;
}

export interface Choice {
  readonly label: string;
  readonly outcome: ResourceDelta;
  readonly chance?: number;
  readonly failureOutcome?: ResourceDelta;
}

export interface Encounter {
  readonly id: string;
  readonly text: string;
  readonly requiredTags: string[];
  readonly biomes?: Biome[];
  readonly choices: Choice[];
}

// --- Relic Types ---

export type RelicEffectType =
  | "max_resource"
  | "forage_bonus"
  | "searing_resist"
  | "hope_decay_slow"
  | "move_discount";

export interface RelicEffect {
  type: RelicEffectType;
  resource?: "supply" | "hope" | "health";
  bonus?: number;
  chance?: number;
  extraTurns?: number;
  intervalBonus?: number;
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  effect: RelicEffect;
}

// --- Rumor Types ---

export interface RumorStep {
  stepIndex: number;
  encounterId: string; // references an encounter by ID
  hint: string; // narrative hint toward next step
  hintTags: string[]; // tags the hint implies
  hintBiomes?: Biome[]; // biomes the hint implies
}

export interface Rumor {
  id: string;
  title: string;
  steps: RumorStep[];
  reward: Relic | null;
  hopeBonus: number;
}

export interface ActiveRumor {
  rumorId: string;
  currentStep: number;
}

export interface CompletedRumor {
  rumorId: string;
  completedAtTurn: number;
}

export interface RumorState {
  available: Rumor[];
  active: ActiveRumor[];
  completed: CompletedRumor[];
}

export interface HexTile {
  readonly coord: CubeCoord;
  readonly biome: Biome;
  readonly tags: Set<string>;
  readonly encounter: Encounter | null;
  readonly revealed: boolean;
  readonly consumed: boolean;
  readonly visited: boolean;
}

export type LogType = "narrative" | "resource" | "searing" | "system";

export interface LogEntry {
  readonly turn: number;
  readonly text: string;
  readonly type?: LogType;
}

export interface SearingState {
  readonly axis: HexAxis;
  readonly direction: 1 | -1;
  readonly line: number;
  readonly advanceRate: number;
}

export type GameMode =
  | { readonly type: "map" }
  | { readonly type: "encounter"; readonly encounter: Encounter; readonly hex: CubeCoord }
  | { readonly type: "camp"; readonly result: LogEntry; readonly incident: LogEntry | null }
  | { readonly type: "gameover"; readonly reason: string };

export type Action =
  | { readonly type: "push"; readonly direction: HexDirection }
  | { readonly type: "pause"; readonly activity: "rest" | "forage" }
  | { readonly type: "choose"; readonly choiceIndex: number }
  | { readonly type: "dismiss" };

export interface Player {
  readonly hex: CubeCoord;
  readonly supply: number;
  readonly hope: number;
  readonly health: number;
}

export interface GameState {
  readonly player: Player;
  readonly map: Map<string, HexTile>;
  readonly searing: SearingState;
  readonly turn: number;
  readonly mode: GameMode;
  readonly log: LogEntry[];
  readonly status: "playing" | "won" | "lost";
  readonly encounters: Encounter[];
  // NEW in M2:
  rumors: RumorState;
  relics: Relic[]; // collected relics
}

export const STARTING_SUPPLY = 6;
export const MAX_SUPPLY = 10;
export const STARTING_HOPE = 5;
export const MAX_HOPE = 5;
export const STARTING_HEALTH = 3;
export const MAX_HEALTH = 5;
export const SEARING_ADVANCE_RATE = 4;
export const HOPE_DECAY_INTERVAL = 6;

export interface SerializedHexTile {
  readonly coord: CubeCoord;
  readonly biome: Biome;
  readonly tags: string[];
  readonly encounter: Encounter | null;
  readonly revealed: boolean;
  readonly consumed: boolean;
  readonly visited: boolean;
}

export interface SerializedGameState {
  readonly player: Player;
  readonly map: Record<string, SerializedHexTile>;
  readonly searing: SearingState;
  readonly turn: number;
  readonly mode: GameMode;
  readonly log: LogEntry[];
  readonly status: "playing" | "won" | "lost";
  readonly encounters: Encounter[];
  // NEW in M2
  rumors: RumorState;
  relics: Relic[];
}

export function createInitialState(
  encounters: Encounter[],
  rng: RNG,
  rumors: Rumor[] = []
): GameState {
  const startCoord = cubeCoord(0, 0, 0);
  const startHex: HexTile = {
    coord: startCoord,
    biome: "settlement",
    tags: new Set(["inhabited", "sheltered"]),
    encounter: null,
    revealed: true,
    consumed: false,
    visited: true,
  };
  const axes: HexAxis[] = ["q", "r", "s"];
  const axis = axes[Math.floor(rng() * axes.length)] ?? "q";
  const direction: 1 | -1 = rng() < 0.5 ? 1 : -1;

  return {
    player: {
      hex: startCoord,
      supply: STARTING_SUPPLY,
      hope: STARTING_HOPE,
      health: STARTING_HEALTH,
    },
    map: new Map([[coordKey(startCoord), startHex]]),
    searing: {
      axis,
      direction,
      line: direction === 1 ? -10 : 10,
      advanceRate: SEARING_ADVANCE_RATE,
    },
    turn: 0,
    mode: { type: "map" },
    log: [
      {
        turn: 0,
        text: "You stand in a sheltered settlement. The Searing stains the horizon.",
        type: "narrative",
      },
    ],
    status: "playing",
    encounters,
    rumors: {
      available: rumors,
      active: [],
      completed: [],
    },
    relics: [],
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
    rumors: data.rumors ?? { available: [], active: [], completed: [] },
    relics: data.relics ?? [],
  };
}
