import { describe, expect, it } from "vitest";

import { applyDelta, checkLoss, forageResult } from "../../src/engine/resources";
import {
  MAX_HEALTH,
  MAX_HOPE,
  MAX_SUPPLY,
  STARTING_HEALTH,
  STARTING_HOPE,
  STARTING_SUPPLY,
  type Player,
} from "../../src/engine/state";

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  hex: { q: 0, r: 0, s: 0 },
  supply: STARTING_SUPPLY,
  hope: STARTING_HOPE,
  health: STARTING_HEALTH,
  ...overrides,
});

describe("applyDelta", () => {
  it("adds and clamps resources", () => {
    const updated = applyDelta(makePlayer(), { supply: 99, hope: 1, health: 99 });
    expect(updated.supply).toBe(MAX_SUPPLY);
    expect(updated.hope).toBe(MAX_HOPE);
    expect(updated.health).toBe(MAX_HEALTH);
  });

  it("does not let resources drop below zero", () => {
    const updated = applyDelta(makePlayer({ supply: 1 }), { supply: -10 });
    expect(updated.supply).toBe(0);
  });
});

describe("checkLoss", () => {
  it("returns null for a healthy player", () => {
    expect(checkLoss(makePlayer())).toBeNull();
  });

  it("returns the health outcome and reason when health is depleted", () => {
    const result = checkLoss(makePlayer({ health: 0 }));
    expect(result?.outcome).toBe("loss_health");
    expect(result?.reason).toContain("body gives out");
  });

  it("returns the hope outcome and reason when hope is depleted", () => {
    const result = checkLoss(makePlayer({ hope: 0 }));
    expect(result?.outcome).toBe("loss_hope");
    expect(result?.reason).toContain("light inside you fades");
  });
});

describe("forageResult", () => {
  it("returns supply on success", () => {
    const result = forageResult("forest", new Set(["wood"]), () => 0.1);
    expect(result.success).toBe(true);
    expect(result.delta.supply).toBe(2);
  });

  it("returns an empty delta on failure", () => {
    const result = forageResult("forest", new Set(["wood"]), () => 0.95);
    expect(result.success).toBe(false);
    expect(result.delta.supply).toBeUndefined();
  });

  it("applies tag modifiers", () => {
    expect(forageResult("forest", new Set(["water"]), () => 0.75).success).toBe(true);
    expect(forageResult("ruins", new Set(["abandoned"]), () => 0.1).delta.supply).toBe(3);
  });
});
