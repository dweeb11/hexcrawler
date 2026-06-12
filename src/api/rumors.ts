import rumorsSeed from "../engine/data/rumors-seed.json";
import { ALL_RELICS } from "../engine/data/relics";
import type { Relic, Rumor, RumorStep } from "../engine/state";

interface ApiRumorStep {
  stepIndex: number;
  stepTitle?: string;
  encounterId: string;
  journalHint?: string;
  hint?: string;
  hintTags: string[];
  hintBiomes?: RumorStep["hintBiomes"];
}

interface ApiRumor {
  id: string;
  title: string;
  premise?: string;
  steps: ApiRumorStep[];
  rewardId?: string | null;
  hopeBonus: number;
}

let cachedRumors: Rumor[] | null = null;

function relicById(id: string | null | undefined): Relic | null {
  if (!id) return null;
  return ALL_RELICS.find((relic) => relic.id === id) ?? null;
}

function normalizeApiStep(step: ApiRumorStep): RumorStep {
  return {
    stepIndex: step.stepIndex,
    stepTitle: step.stepTitle ?? "",
    encounterId: step.encounterId,
    journalHint: step.journalHint ?? step.hint ?? "",
    hintTags: step.hintTags,
    hintBiomes: step.hintBiomes,
  };
}

function normalizeApiRumor(rumor: ApiRumor): Rumor {
  return {
    id: rumor.id,
    title: rumor.title,
    premise: rumor.premise ?? "",
    steps: rumor.steps.map(normalizeApiStep),
    reward: relicById(rumor.rewardId),
    hopeBonus: rumor.hopeBonus,
  };
}

export async function fetchRumors(): Promise<Rumor[]> {
  if (cachedRumors) {
    return cachedRumors;
  }

  try {
    const response = await fetch("/api/rumors");
    if (!response.ok) {
      throw new Error(`Rumor API returned ${response.status}`);
    }

    const apiRumors = (await response.json()) as ApiRumor[];
    cachedRumors = apiRumors.map(normalizeApiRumor);
    return cachedRumors;
  } catch (error) {
    console.warn("Falling back to bundled seed rumors.", error);
    cachedRumors = (rumorsSeed as ApiRumor[]).map(normalizeApiRumor);
    return cachedRumors;
  }
}

export function clearRumorCache(): void {
  cachedRumors = null;
}
