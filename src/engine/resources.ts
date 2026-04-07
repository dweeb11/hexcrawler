import type { Biome, Player, RNG, ResourceDelta, Relic } from "./state";
import { MAX_HEALTH, MAX_HOPE, MAX_SUPPLY } from "./state";
import { getMaxResource } from "./relics";

const FORAGE_TABLE: Record<Biome, { chance: number; yield: number }> = {
  forest: { chance: 0.7, yield: 2 },
  mountain: { chance: 0.35, yield: 1 },
  ruins: { chance: 0.55, yield: 2 },
  settlement: { chance: 0.8, yield: 3 },
  wastes: { chance: 0.3, yield: 1 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampResources(player: Player, relics: Relic[] = []): Player {
  return {
    ...player,
    supply: clamp(player.supply, 0, getMaxResource("supply", relics)),
    hope: clamp(player.hope, 0, getMaxResource("hope", relics)),
    health: clamp(player.health, 0, getMaxResource("health", relics)),
  };
}

export function applyDelta(
  player: Player,
  delta: ResourceDelta,
  relics: Relic[] = []
): Player {
  return clampResources(
    {
      ...player,
      supply: player.supply + (delta.supply ?? 0),
      hope: player.hope + (delta.hope ?? 0),
      health: player.health + (delta.health ?? 0),
    },
    relics
  );
}

export function checkLoss(player: Player): string | null {
  if (player.health <= 0) {
    return "Your body gives out. The Twilight Strip claims another.";
  }

  if (player.hope <= 0) {
    return "The light inside you fades. You surrender to the heat.";
  }

  return null;
}

export interface ForageResult {
  readonly success: boolean;
  readonly delta: ResourceDelta;
  readonly text: string;
}

export function forageResult(
  biome: Biome,
  tags: Set<string>,
  rng: RNG,
  forageBonus = 0
): ForageResult {
  const table = FORAGE_TABLE[biome];
  let chance = table.chance + forageBonus;
  let yieldAmount = table.yield;

  if (tags.has("water")) {
    chance += 0.1;
  }

  if (tags.has("overgrown")) {
    chance += 0.1;
  }

  if (tags.has("abandoned")) {
    yieldAmount += 1;
  }

  if (rng() < Math.min(chance, 1)) {
    return {
      success: true,
      delta: { supply: yieldAmount },
      text: `You forage successfully and recover ${yieldAmount} Supply.`,
    };
  }

  return {
    success: false,
    delta: {},
    text: "You search the hex and come up empty-handed.",
  };
}
