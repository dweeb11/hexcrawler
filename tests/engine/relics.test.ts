// tests/engine/relics.test.ts
import { describe, expect, it } from "vitest";
import {
  getEffectiveCaps,
  getMaxResource,
  getForageBonus,
  getHopeDecayInterval,
  getMoveDiscount,
} from "../../src/engine/relics";
import { ALL_RELICS } from "../../src/engine/data/relics";
import type { Relic, RelicEffectType } from "../../src/engine/state";
import {
  MAX_SUPPLY,
  MAX_HOPE,
  MAX_HEALTH,
  HOPE_DECAY_INTERVAL,
} from "../../src/engine/state";

const IMPLEMENTED_EFFECT_TYPES = [
  "max_resource",
  "forage_bonus",
  "hope_decay_slow",
  "move_discount",
] as const satisfies readonly RelicEffectType[];

const foragRelic: Relic = {
  id: "gatherers-pouch",
  name: "Gatherer's Pouch",
  description: "Foraging is easier",
  effect: { type: "forage_bonus", chance: 0.15 },
};

const supplyRelic: Relic = {
  id: "deep-pack",
  name: "Deep Pack",
  description: "Carry more supplies",
  effect: { type: "max_resource", resource: "supply", bonus: 2 },
};

const hopeRelic: Relic = {
  id: "star-shard",
  name: "Star Shard",
  description: "Hope fades slower",
  effect: { type: "hope_decay_slow", intervalBonus: 2 },
};

const moveRelic: Relic = {
  id: "wind-boots",
  name: "Wind Boots",
  description: "Sometimes move for free",
  effect: { type: "move_discount", chance: 0.2 },
};

const healthRelic: Relic = {
  id: "iron-heart",
  name: "Iron Heart",
  description: "Carry more health",
  effect: { type: "max_resource", resource: "health", bonus: 1 },
};

const hopeMaxRelic: Relic = {
  id: "lantern-soul",
  name: "Lantern Soul",
  description: "Carry more hope",
  effect: { type: "max_resource", resource: "hope", bonus: 1 },
};

describe("getEffectiveCaps", () => {
  it("returns base caps when no relics", () => {
    expect(getEffectiveCaps([])).toEqual({
      supply: MAX_SUPPLY,
      hope: MAX_HOPE,
      health: MAX_HEALTH,
    });
  });

  it("adds bonuses from matching max_resource relics", () => {
    expect(getEffectiveCaps([supplyRelic])).toEqual({
      supply: MAX_SUPPLY + 2,
      hope: MAX_HOPE,
      health: MAX_HEALTH,
    });
  });

  it("stacks max_resource bonuses for the same resource", () => {
    const extraSupply: Relic = {
      id: "travelers-satchel",
      name: "Traveler's Satchel",
      description: "Even more supply",
      effect: { type: "max_resource", resource: "supply", bonus: 1 },
    };
    expect(getEffectiveCaps([supplyRelic, extraSupply])).toEqual({
      supply: MAX_SUPPLY + 3,
      hope: MAX_HOPE,
      health: MAX_HEALTH,
    });
  });

  it("aggregates bonuses across all three resources", () => {
    expect(getEffectiveCaps([supplyRelic, hopeMaxRelic, healthRelic])).toEqual({
      supply: MAX_SUPPLY + 2,
      hope: MAX_HOPE + 1,
      health: MAX_HEALTH + 1,
    });
  });
});

describe("getMaxResource", () => {
  it("returns base max when no relics", () => {
    expect(getMaxResource("supply", [])).toBe(MAX_SUPPLY);
    expect(getMaxResource("hope", [])).toBe(MAX_HOPE);
    expect(getMaxResource("health", [])).toBe(MAX_HEALTH);
  });

  it("adds bonus from matching relics", () => {
    expect(getMaxResource("supply", [supplyRelic])).toBe(MAX_SUPPLY + 2);
  });

  it("ignores non-matching relics", () => {
    expect(getMaxResource("hope", [supplyRelic])).toBe(MAX_HOPE);
  });
});

describe("getForageBonus", () => {
  it("returns 0 with no relics", () => {
    expect(getForageBonus([])).toBe(0);
  });

  it("sums forage bonus from relics", () => {
    expect(getForageBonus([foragRelic])).toBeCloseTo(0.15);
  });
});

describe("getHopeDecayInterval", () => {
  it("returns base interval with no relics", () => {
    expect(getHopeDecayInterval([])).toBe(HOPE_DECAY_INTERVAL);
  });

  it("adds interval bonus from relics", () => {
    expect(getHopeDecayInterval([hopeRelic])).toBe(HOPE_DECAY_INTERVAL + 2);
  });
});

describe("getMoveDiscount", () => {
  it("returns 0 with no relics", () => {
    expect(getMoveDiscount([])).toBe(0);
  });

  it("returns discount chance from relics", () => {
    expect(getMoveDiscount([moveRelic])).toBeCloseTo(0.2);
  });
});

describe("relic catalog (ADR-0001)", () => {
  it("uses only implemented relic effect types", () => {
    for (const relic of ALL_RELICS) {
      expect(IMPLEMENTED_EFFECT_TYPES).toContain(relic.effect.type);
    }
  });
});
