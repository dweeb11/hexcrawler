import seedEncounters from "../engine/data/seed-encounters.json";
import type { Encounter } from "../engine/state";

let cachedEncounters: Encounter[] | null = null;

export async function fetchEncounters(): Promise<Encounter[]> {
  if (cachedEncounters) {
    return cachedEncounters;
  }

  try {
    const response = await fetch("/api/encounters");
    if (!response.ok) {
      throw new Error(`Encounter API returned ${response.status}`);
    }

    cachedEncounters = (await response.json()) as Encounter[];
    return cachedEncounters;
  } catch (error) {
    console.warn("Falling back to bundled seed encounters.", error);
    cachedEncounters = seedEncounters as Encounter[];
    return cachedEncounters;
  }
}

export function clearEncounterCache(): void {
  cachedEncounters = null;
}
