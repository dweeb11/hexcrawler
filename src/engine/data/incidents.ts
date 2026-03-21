import type { RNG, ResourceDelta } from "../state";

interface NightIncident {
  readonly id: string;
  readonly text: string;
  readonly delta: ResourceDelta;
  readonly weight: number;
}

const INCIDENTS: NightIncident[] = [
  {
    id: "night-theft",
    text: "Something creeps close to camp. You wake to lighter packs.",
    delta: { supply: -1 },
    weight: 25,
  },
  {
    id: "night-noise",
    text: "The dark whispers and never settles. Sleep barely comes.",
    delta: { hope: -1 },
    weight: 25,
  },
  {
    id: "night-stars",
    text: "The sky clears. For a moment, the old constellations return.",
    delta: { hope: 1 },
    weight: 20,
  },
  {
    id: "night-find",
    text: "While preparing camp, you notice something useful half-buried nearby.",
    delta: { supply: 1 },
    weight: 15,
  },
  {
    id: "night-wound",
    text: "You wake with a fresh cut and no memory of taking it.",
    delta: { health: -1 },
    weight: 10,
  },
  {
    id: "night-dream",
    text: "A vivid dream of the old world leaves a stubborn ember of resolve.",
    delta: { hope: 2 },
    weight: 5,
  },
] as const;

const QUIET_NIGHT_CHANCE = 0.6;

export interface IncidentResult {
  readonly id: string;
  readonly text: string;
  readonly delta: ResourceDelta;
}

export function rollNightIncident(rng: RNG): IncidentResult | null {
  if (rng() < QUIET_NIGHT_CHANCE) {
    return null;
  }

  const totalWeight = INCIDENTS.reduce((sum, incident) => sum + incident.weight, 0);
  let roll = rng() * totalWeight;

  for (const incident of INCIDENTS) {
    roll -= incident.weight;
    if (roll <= 0) {
      return {
        id: incident.id,
        text: incident.text,
        delta: incident.delta,
      };
    }
  }

  const fallback = INCIDENTS[INCIDENTS.length - 1];
  return fallback
    ? { id: fallback.id, text: fallback.text, delta: fallback.delta }
    : null;
}
