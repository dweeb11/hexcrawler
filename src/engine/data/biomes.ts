import type { Biome } from "../state";

export interface BiomeConfig {
  readonly weight: number;
  readonly primaryTags: string[];
  readonly secondaryTags: string[];
}

export const ALL_BIOMES: Biome[] = ["forest", "mountain", "ruins", "settlement", "wastes"];

export const BIOME_CONFIGS: Record<Biome, BiomeConfig> = {
  forest: {
    weight: 35,
    primaryTags: ["wood", "water", "overgrown"],
    secondaryTags: ["sheltered", "sacred", "ancient"],
  },
  mountain: {
    weight: 20,
    primaryTags: ["stone", "elevated", "ice"],
    secondaryTags: ["hollow", "ancient", "scarred"],
  },
  ruins: {
    weight: 15,
    primaryTags: ["stone", "ancient", "abandoned"],
    secondaryTags: ["sacred", "scarred", "hollow"],
  },
  settlement: {
    weight: 10,
    primaryTags: ["wood", "inhabited", "sheltered"],
    secondaryTags: ["water", "stone", "sacred"],
  },
  wastes: {
    weight: 20,
    primaryTags: ["sand", "scarred", "flooded"],
    secondaryTags: ["ice", "abandoned", "hollow"],
  },
};

export const NEIGHBOR_BIOME_BONUS = 15;
export const PRIMARY_TAG_WEIGHT = 0.7;
