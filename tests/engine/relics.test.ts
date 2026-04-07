// tests/engine/relics.test.ts
import { describe, expect, it } from "vitest";
import {
  getMaxResource,
  getForageBonus,
  getHopeDecayInterval,
  getMoveDiscount,
} from "../../src/engine/relics";
import type { Relic } from "../../src/engine/state";
import {
  MAX_SUPPLY,
  MAX_HOPE,
  MAX_HEALTH,
  HOPE_DECAY_INTERVAL,
} from "../../src/engine/state";

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
