import { coordKey, cubeCoord, type CubeCoord, type HexDirection } from "./hex";
import { initSearing } from "./searing";

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
  readonly discoversRumor?: string; // rumor ID to discover on choice
}

export interface RumorWeights {
  biomeWeights: Partial<Record<Biome, number>>;
  tagWeights: Record<string, number>;
}

export interface Encounter {
  readonly id: string;
  readonly text: string;
  readonly shadowText?: string;
  readonly requiredTags: string[];
  readonly biomes?: Biome[];
  readonly choices: Choice[];
}

// --- Relic Types ---

export type RelicEffectType =
  | "max_resource"
  | "forage_bonus"
  | "hope_decay_slow"
  | "move_discount";

export interface RelicEffect {
  type: RelicEffectType;
  resource?: "supply" | "hope" | "health";
  bonus?: number;
  chance?: number;
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
  stepTitle: string;
  encounterId: string;
  journalHint: string;
  hintTags: string[];
  hintBiomes?: Biome[];
}

export interface Rumor {
  id: string;
  title: string;
  premise: string;
  steps: RumorStep[];
  reward: Relic | null;
  hopeBonus: number;
}

export interface RumorContext {
  rumorId: string;
  rumorTitle: string;
  stepIndex: number;
  stepCount: number;
  isFinalStep: boolean;
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

export type LogType = "narrative" | "resource" | "searing" | "system" | "rumor";

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

export type GameOverOutcome =
  | "win_pillars"
  | "win_gear"
  | "loss_health"
  | "loss_hope"
  | "loss_searing";

export type GameMode =
  | { readonly type: "map" }
  | {
      readonly type: "encounter";
      readonly encounter: Encounter;
      readonly hex: CubeCoord;
      readonly rumorContext?: RumorContext;
    }
  | { readonly type: "camp"; readonly result: LogEntry; readonly incident: LogEntry | null }
  | { readonly type: "gameover"; readonly reason: string; readonly outcome: GameOverOutcome };

export interface GameStats {
  hexesExplored: number;
  encountersResolved: number;
  rumorsDiscovered: number;
  rumorsCompleted: number;
  relicsCollected: number;
}

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
  // NEW in M3:
  stats: GameStats;
}

export const STARTING_SUPPLY = 7;
export const MAX_SUPPLY = 10;
export const STARTING_HOPE = 5;
export const MAX_HOPE = 5;
export const STARTING_HEALTH = 3;
export const MAX_HEALTH = 5;
export const HOPE_DECAY_INTERVAL = 7;

export type {
  SerializedGameState,
  SerializedHexTile,
} from "./persistence";
export { deserializeState, serializeState } from "./persistence";

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
  return {
    player: {
      hex: startCoord,
      supply: STARTING_SUPPLY,
      hope: STARTING_HOPE,
      health: STARTING_HEALTH,
    },
    map: new Map([[coordKey(startCoord), startHex]]),
    searing: initSearing(rng),
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
    stats: {
      hexesExplored: 0,
      encountersResolved: 0,
      rumorsDiscovered: 0,
      rumorsCompleted: 0,
      relicsCollected: 0,
    },
  };
}
