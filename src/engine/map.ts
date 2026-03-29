import { coordKey, neighbors } from "./hex";
import { findMatchingEncounters } from "./encounters";
import {
  ALL_BIOMES,
  BIOME_CONFIGS,
  NEIGHBOR_BIOME_BONUS,
  PRIMARY_TAG_WEIGHT,
} from "./data/biomes";
import { isConsumed } from "./searing";
import type { CubeCoord } from "./hex";
import type { Biome, Encounter, HexTile, RNG, SearingState } from "./state";

function addRandomUniqueTag(tags: Set<string>, pool: string[], rng: RNG): void {
  const uniquePool = [...new Set(pool)];
  if (uniquePool.length === 0) {
    return;
  }

  const startIndex = Math.floor(rng() * uniquePool.length);
  for (let offset = 0; offset < uniquePool.length; offset += 1) {
    const tag = uniquePool[(startIndex + offset) % uniquePool.length];
    if (tag && !tags.has(tag)) {
      tags.add(tag);
      return;
    }
  }
}

function pickWeightedValue<T extends string>(
  entries: readonly T[],
  weightFor: (entry: T) => number,
  rng: RNG,
): T {
  const totalWeight = entries.reduce((sum, entry) => sum + weightFor(entry), 0);
  let roll = rng() * totalWeight;

  for (const entry of entries) {
    roll -= weightFor(entry);
    if (roll <= 0) {
      return entry;
    }
  }

  return entries[entries.length - 1] as T;
}

export function rollBiome(neighborBiomes: Biome[], rng: RNG): Biome {
  const weights = new Map<Biome, number>(
    ALL_BIOMES.map((biome) => [biome, BIOME_CONFIGS[biome].weight]),
  );

  for (const biome of neighborBiomes) {
    weights.set(biome, (weights.get(biome) ?? 0) + NEIGHBOR_BIOME_BONUS);
  }

  return pickWeightedValue(
    ALL_BIOMES,
    (biome) => weights.get(biome) ?? 0,
    rng,
  );
}

export function rollTags(biome: Biome, neighborTagSets: Set<string>[], rng: RNG): Set<string> {
  const config = BIOME_CONFIGS[biome];
  const tags = new Set<string>();

  if (neighborTagSets.length > 0) {
    const pooledTags = neighborTagSets.flatMap((tagSet) => [...tagSet]);
    const inheritCount = Math.floor(rng() * 3);

    for (let index = 0; index < inheritCount && pooledTags.length > 0; index += 1) {
      const tagIndex = Math.floor(rng() * pooledTags.length);
      const [tag] = pooledTags.splice(tagIndex, 1);
      if (tag) {
        tags.add(tag);
      }
    }
  }

  const freshCount = 1 + (rng() < 0.5 ? 1 : 0);
  for (let index = 0; index < freshCount; index += 1) {
    const pool = rng() < PRIMARY_TAG_WEIGHT ? config.primaryTags : config.secondaryTags;
    addRandomUniqueTag(tags, pool, rng);
  }

  while (tags.size < 2) {
    addRandomUniqueTag(tags, [...config.primaryTags, ...config.secondaryTags], rng);
  }

  if (tags.size > 3) {
    return new Set([...tags].slice(0, 3));
  }

  return tags;
}

export function pickEncounter(
  encounters: Encounter[],
  tags: Set<string>,
  biome: Biome,
  rng: RNG,
): Encounter | null {
  const matching = findMatchingEncounters(encounters, tags, biome);

  if (matching.length === 0 || rng() > 0.5) {
    return null;
  }

  return matching[Math.floor(rng() * matching.length)] ?? null;
}

export function generateHex(
  coord: CubeCoord,
  existingMap: Map<string, HexTile>,
  encounters: Encounter[],
  rng: RNG,
  searing?: SearingState,
): HexTile {
  const neighborTiles = neighbors(coord)
    .map((neighborCoord) => existingMap.get(coordKey(neighborCoord)))
    .filter((tile): tile is HexTile => Boolean(tile));

  const biome = rollBiome(
    neighborTiles.filter((tile) => tile.revealed).map((tile) => tile.biome),
    rng,
  );
  const tags = rollTags(
    biome,
    neighborTiles.filter((tile) => tile.revealed).map((tile) => tile.tags),
    rng,
  );

  return {
    coord,
    biome,
    tags,
    encounter: pickEncounter(encounters, tags, biome, rng),
    revealed: true,
    consumed: searing ? isConsumed(coord, searing) : false,
    visited: false,
  };
}

export function getVisibleNeighbors(
  coord: CubeCoord,
  hope: number,
  searingAxis: keyof CubeCoord,
  searingDirection: 1 | -1,
): CubeCoord[] {
  if (hope <= 0) {
    return [];
  }

  const around = neighbors(coord);
  if (hope >= 3) {
    return around;
  }

  return around
    .filter((neighborCoord) => {
      const axisDelta = neighborCoord[searingAxis] - coord[searingAxis];
      return axisDelta * searingDirection <= 0;
    })
    .slice(0, 3);
}
