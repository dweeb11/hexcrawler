import type { Biome, Choice, Encounter, RNG, ResourceDelta } from "./state";

export interface ChoiceResult {
  readonly delta: ResourceDelta;
  readonly succeeded: boolean;
}

export const SHADOW_HOPE_THRESHOLD = 2;

export function findMatchingEncounters(
  encounters: Encounter[],
  tags: Set<string>,
  biome: Biome,
): Encounter[] {
  return encounters.filter((encounter) => {
    if (encounter.biomes && encounter.biomes.length > 0 && !encounter.biomes.includes(biome)) {
      return false;
    }

    return encounter.requiredTags.every((tag) => tags.has(tag));
  });
}

export function resolveChoice(choice: Choice, rng: RNG): ChoiceResult {
  const chance = choice.chance ?? 1;

  if (rng() < chance) {
    return { delta: choice.outcome, succeeded: true };
  }

  return { delta: choice.failureOutcome ?? {}, succeeded: false };
}

export function encounterForHope(encounter: Encounter, hope: number): Encounter {
  if (hope > SHADOW_HOPE_THRESHOLD) {
    return encounter;
  }

  if (!encounter.shadowText) {
    return encounter;
  }

  return {
    ...encounter,
    text: encounter.shadowText,
  };
}
