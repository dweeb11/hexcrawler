// src/engine/relics.ts
import {
  MAX_SUPPLY,
  MAX_HOPE,
  MAX_HEALTH,
  HOPE_DECAY_INTERVAL,
  type Relic,
} from "./state";

export interface EffectiveCaps {
  supply: number;
  hope: number;
  health: number;
}

function maxResourceBonus(
  resource: "supply" | "hope" | "health",
  relics: Relic[],
): number {
  return relics
    .filter((r) => r.effect.type === "max_resource" && r.effect.resource === resource)
    .reduce((sum, r) => sum + (r.effect.bonus ?? 0), 0);
}

export function getEffectiveCaps(relics: Relic[]): EffectiveCaps {
  return {
    supply: MAX_SUPPLY + maxResourceBonus("supply", relics),
    hope: MAX_HOPE + maxResourceBonus("hope", relics),
    health: MAX_HEALTH + maxResourceBonus("health", relics),
  };
}

export function getMaxResource(
  resource: "supply" | "hope" | "health",
  relics: Relic[],
): number {
  return getEffectiveCaps(relics)[resource];
}

export function getForageBonus(relics: Relic[]): number {
  return relics
    .filter((r) => r.effect.type === "forage_bonus")
    .reduce((sum, r) => sum + (r.effect.chance ?? 0), 0);
}

export function getHopeDecayInterval(relics: Relic[]): number {
  const bonus = relics
    .filter((r) => r.effect.type === "hope_decay_slow")
    .reduce((sum, r) => sum + (r.effect.intervalBonus ?? 0), 0);
  return HOPE_DECAY_INTERVAL + bonus;
}

export function getMoveDiscount(relics: Relic[]): number {
  return relics
    .filter((r) => r.effect.type === "move_discount")
    .reduce((sum, r) => sum + (r.effect.chance ?? 0), 0);
}
