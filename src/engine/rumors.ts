// src/engine/rumors.ts
import { applyDelta } from "./resources";
import type {
  ActiveRumor,
  Biome,
  Encounter,
  GameState,
  GameStats,
  Relic,
  Rumor,
  RumorContext,
  RumorState,
  RumorStep,
  RumorWeights,
} from "./state";

export interface RumorStepMatch {
  rumor: Rumor;
  step: RumorStep;
  active: ActiveRumor;
}

export type RumorLogEntry = { text: string; type: "rumor" };

export interface RumorEffects {
  rumors: RumorState;
  logs: RumorLogEntry[];
  statsDelta: Partial<Pick<GameStats, "rumorsDiscovered" | "rumorsCompleted" | "relicsCollected">>;
  relicsToAdd: Relic[];
  hopeDelta: number;
}

export interface RumorJournalEntryActive {
  status: "active";
  rumor: Rumor;
  stepIndex: number;
  stepCount: number;
  journalHint: string;
}

export interface RumorJournalEntryCompleted {
  status: "completed";
  rumor: Rumor;
  completedAtTurn: number;
}

export type RumorJournalEntry = RumorJournalEntryActive | RumorJournalEntryCompleted;

const RUMOR_TAG_WEIGHT_BONUS = 0.3;
const RUMOR_BIOME_WEIGHT_BONUS = 0.25;
const DISCOVERY_WEIGHT_BOOST = 3;

function rumorLogTitle(title: string): string {
  return title.startsWith("The ") ? title.slice(4) : title;
}

export function getRumor(rumorState: RumorState, rumorId: string): Rumor | undefined {
  return rumorState.available.find((r) => r.id === rumorId);
}

export function findActiveRumorForEncounter(
  rumorState: RumorState,
  encounterId: string,
): { rumor: Rumor; active: ActiveRumor } | null {
  for (const active of rumorState.active) {
    const rumor = getRumor(rumorState, active.rumorId);
    if (rumor?.steps[active.currentStep]?.encounterId === encounterId) {
      return { rumor, active };
    }
  }
  return null;
}

export function buildRumorContext(rumor: Rumor, stepIndex: number): RumorContext {
  return {
    rumorId: rumor.id,
    rumorTitle: rumor.title,
    stepIndex,
    stepCount: rumor.steps.length,
    isFinalStep: stepIndex === rumor.steps.length - 1,
  };
}

export function getRumorJournalEntries(rumorState: RumorState): RumorJournalEntry[] {
  const entries: RumorJournalEntry[] = [];

  for (const active of rumorState.active) {
    const rumor = getRumor(rumorState, active.rumorId);
    if (!rumor) continue;

    const step = rumor.steps[active.currentStep];
    entries.push({
      rumor,
      status: "active",
      stepIndex: active.currentStep,
      stepCount: rumor.steps.length,
      journalHint: step?.journalHint ?? "Follow the trail...",
    });
  }

  for (const completed of rumorState.completed) {
    const rumor = getRumor(rumorState, completed.rumorId);
    if (!rumor) continue;

    entries.push({
      rumor,
      status: "completed",
      completedAtTurn: completed.completedAtTurn,
    });
  }

  return entries;
}

export function shouldBoostRumorDiscovery(rumorState: RumorState): boolean {
  return rumorState.active.length === 0 && rumorState.completed.length === 0;
}

export function encounterHasDiscoveryChoice(encounter: Encounter): boolean {
  return encounter.choices.some((choice) => Boolean(choice.discoversRumor));
}

export function discoveryEncounterWeight(encounter: Encounter, boostDiscovery: boolean): number {
  if (!boostDiscovery || !encounterHasDiscoveryChoice(encounter)) {
    return 1;
  }
  return DISCOVERY_WEIGHT_BOOST;
}

export function findNextRumorStep(
  rumorState: RumorState,
  hexTags: Set<string>,
  hexBiome: Biome,
): RumorStepMatch | null {
  const matches: RumorStepMatch[] = [];

  for (const active of rumorState.active) {
    const rumor = getRumor(rumorState, active.rumorId);
    if (!rumor) continue;

    const step = rumor.steps[active.currentStep];
    if (!step) continue;

    const tagsMatch = step.hintTags.every((t) => hexTags.has(t));
    const biomeMatch =
      !step.hintBiomes || step.hintBiomes.length === 0 || step.hintBiomes.includes(hexBiome);

    if (tagsMatch && biomeMatch) {
      matches.push({ rumor, step, active });
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aRemaining = a.rumor.steps.length - a.active.currentStep;
    const bRemaining = b.rumor.steps.length - b.active.currentStep;
    return aRemaining - bRemaining;
  });

  return matches[0];
}

export function applyRumorWeights(rumorState: RumorState): RumorWeights {
  const tagWeights: Record<string, number> = {};
  const biomeWeights: Partial<Record<Biome, number>> = {};

  for (const active of rumorState.active) {
    const rumor = getRumor(rumorState, active.rumorId);
    if (!rumor) continue;

    const step = rumor.steps[active.currentStep];
    if (!step) continue;

    for (const tag of step.hintTags) {
      tagWeights[tag] = (tagWeights[tag] ?? 0) + RUMOR_TAG_WEIGHT_BONUS;
    }

    if (step.hintBiomes) {
      for (const biome of step.hintBiomes) {
        biomeWeights[biome] = (biomeWeights[biome] ?? 0) + RUMOR_BIOME_WEIGHT_BONUS;
      }
    }
  }

  return { tagWeights, biomeWeights };
}

export function advanceRumor(active: ActiveRumor): ActiveRumor {
  return { ...active, currentStep: active.currentStep + 1 };
}

export function discoverRumor(rumorState: RumorState, rumorId: string): RumorState {
  if (rumorState.active.some((a) => a.rumorId === rumorId)) {
    return rumorState;
  }
  return {
    ...rumorState,
    active: [...rumorState.active, { rumorId, currentStep: 0 }],
  };
}

export function completeRumor(
  rumorState: RumorState,
  rumorId: string,
  turn: number,
): RumorState {
  return {
    ...rumorState,
    active: rumorState.active.filter((a) => a.rumorId !== rumorId),
    completed: [...rumorState.completed, { rumorId, completedAtTurn: turn }],
  };
}

export function resolveRumorDiscovery(
  rumorState: RumorState,
  rumorId: string,
): RumorEffects | null {
  const rumor = getRumor(rumorState, rumorId);
  if (!rumor) return null;

  const alreadyKnown =
    rumorState.active.some((a) => a.rumorId === rumorId) ||
    rumorState.completed.some((c) => c.rumorId === rumorId);
  if (alreadyKnown) return null;

  return {
    rumors: discoverRumor(rumorState, rumorId),
    logs: [
      {
        text: `▸ Lead recorded: "${rumor.title}" — press J to read your journal`,
        type: "rumor",
      },
    ],
    statsDelta: { rumorsDiscovered: 1 },
    relicsToAdd: [],
    hopeDelta: 0,
  };
}

export function resolveRumorAfterEncounter(
  rumorState: RumorState,
  encounterId: string,
  turn: number,
): RumorEffects | null {
  const match = findActiveRumorForEncounter(rumorState, encounterId);
  if (!match) return null;

  const { rumor, active } = match;
  const nextStep = active.currentStep + 1;

  if (nextStep >= rumor.steps.length) {
    const reward = rumor.reward;
    return {
      rumors: completeRumor(rumorState, rumor.id, turn),
      logs: [
        {
          text: `▸ ${rumorLogTitle(rumor.title)} resolved. You claim the ${reward?.name ?? "your reward"}.`,
          type: "rumor",
        },
      ],
      statsDelta: {
        rumorsCompleted: 1,
        ...(reward ? { relicsCollected: 1 } : {}),
      },
      relicsToAdd: reward ? [reward] : [],
      hopeDelta: rumor.hopeBonus,
    };
  }

  const newActive = advanceRumor(active);
  return {
    rumors: {
      ...rumorState,
      active: rumorState.active.map((a) =>
        a.rumorId === newActive.rumorId ? newActive : a,
      ),
    },
    logs: [
      {
        text: `▸ ${rumorLogTitle(rumor.title)} — the trail deepens. Check your journal.`,
        type: "rumor",
      },
    ],
    statsDelta: {},
    relicsToAdd: [],
    hopeDelta: 0,
  };
}

export function applyRumorEffects(state: GameState, effects: RumorEffects): GameState {
  const stats = { ...state.stats };
  if (effects.statsDelta.rumorsDiscovered !== undefined) {
    stats.rumorsDiscovered += effects.statsDelta.rumorsDiscovered;
  }
  if (effects.statsDelta.rumorsCompleted !== undefined) {
    stats.rumorsCompleted += effects.statsDelta.rumorsCompleted;
  }
  if (effects.statsDelta.relicsCollected !== undefined) {
    stats.relicsCollected += effects.statsDelta.relicsCollected;
  }

  const relics =
    effects.relicsToAdd.length > 0 ? [...state.relics, ...effects.relicsToAdd] : state.relics;
  const player =
    effects.hopeDelta !== 0
      ? applyDelta(state.player, { hope: effects.hopeDelta }, state.relics)
      : state.player;

  return {
    ...state,
    rumors: effects.rumors,
    stats,
    relics,
    player,
    log: [
      ...state.log,
      ...effects.logs.map((entry) => ({ turn: state.turn, text: entry.text, type: entry.type })),
    ],
  };
}
