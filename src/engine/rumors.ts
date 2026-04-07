// src/engine/rumors.ts
import type { Biome, Rumor, RumorState, RumorStep, ActiveRumor } from "./state";

export interface RumorStepMatch {
  rumor: Rumor;
  step: RumorStep;
  active: ActiveRumor;
}

export interface RumorWeights {
  tagWeights: Record<string, number>;
  biomeWeights: Record<string, number>;
}

const RUMOR_TAG_WEIGHT_BONUS = 0.25;  // +25% weight per hint tag
const RUMOR_BIOME_WEIGHT_BONUS = 0.20; // +20% weight per hint biome

export function findNextRumorStep(
  rumorState: RumorState,
  hexTags: Set<string>,
  hexBiome: Biome
): RumorStepMatch | null {
  const matches: RumorStepMatch[] = [];

  for (const active of rumorState.active) {
    const rumor = rumorState.available.find((r) => r.id === active.rumorId);
    if (!rumor) continue;

    const step = rumor.steps[active.currentStep];
    if (!step) continue;

    // Check if hex satisfies the step's hint tags
    const tagsMatch = step.hintTags.every((t) => hexTags.has(t));
    const biomeMatch = !step.hintBiomes || step.hintBiomes.length === 0 || step.hintBiomes.includes(hexBiome);

    if (tagsMatch && biomeMatch) {
      matches.push({ rumor, step, active });
    }
  }

  if (matches.length === 0) return null;

  // Prefer rumor closest to completion (fewest remaining steps)
  matches.sort((a, b) => {
    const aRemaining = a.rumor.steps.length - a.active.currentStep;
    const bRemaining = b.rumor.steps.length - b.active.currentStep;
    return aRemaining - bRemaining;
  });

  return matches[0];
}

export function applyRumorWeights(rumorState: RumorState): RumorWeights {
  const tagWeights: Record<string, number> = {};
  const biomeWeights: Record<string, number> = {};

  for (const active of rumorState.active) {
    const rumor = rumorState.available.find((r) => r.id === active.rumorId);
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
  turn: number
): RumorState {
  return {
    ...rumorState,
    active: rumorState.active.filter((a) => a.rumorId !== rumorId),
    completed: [...rumorState.completed, { rumorId, completedAtTurn: turn }],
  };
}
