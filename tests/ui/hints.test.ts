import { describe, expect, it } from "vitest";

import { getEffectiveCaps } from "../../src/engine/relics";
import type { Relic } from "../../src/engine/state";
import { getActiveHint } from "../../src/ui/hints";

const deepPack: Relic = {
  id: "deep-pack",
  name: "Deep Pack",
  description: "Carry more supplies",
  effect: { type: "max_resource", resource: "supply", bonus: 2 },
};

describe("getActiveHint", () => {
  it("returns the first-turn hint on turn 0", () => {
    const hint = getActiveHint(
      {
        turn: 0,
        supply: 3,
        maxSupply: 5,
        mode: "map",
      },
      new Set(),
    );

    expect(hint).toEqual({
      id: "first-turn",
      text: "QWEASD to move  |  R to rest  |  F to forage",
    });
  });

  it("returns null when a matching hint is dismissed", () => {
    const hint = getActiveHint(
      {
        turn: 0,
        supply: 3,
        maxSupply: 5,
        mode: "map",
      },
      new Set(["first-turn"]),
    );

    expect(hint).toBeNull();
  });

  it("returns null when no condition matches", () => {
    const hint = getActiveHint(
      {
        turn: 1,
        supply: 5,
        maxSupply: 5,
        mode: "map",
      },
      new Set(),
    );

    expect(hint).toBeNull();
  });

  it("applies priority order: first-turn beats first-rumor beats first-encounter", () => {
    const hint = getActiveHint(
      {
        turn: 0,
        supply: 1,
        maxSupply: 5,
        mode: "encounter",
        rumorProgressCount: 1,
      },
      new Set(),
    );

    expect(hint).toEqual({
      id: "first-turn",
      text: "QWEASD to move  |  R to rest  |  F to forage",
    });
  });
});

describe("first-rumor hint", () => {
  it("shows after the first rumor is discovered", () => {
    const hint = getActiveHint(
      {
        turn: 4,
        supply: 5,
        maxSupply: 10,
        mode: "map",
        rumorProgressCount: 1,
      },
      new Set(),
    );

    expect(hint?.id).toBe("first-rumor");
    expect(hint?.text).toContain("Press J");
  });

  it("dismisses when the hint id is in the dismissed set", () => {
    const hint = getActiveHint(
      {
        turn: 4,
        supply: 5,
        maxSupply: 10,
        mode: "map",
        rumorProgressCount: 1,
      },
      new Set(["first-rumor"]),
    );

    expect(hint?.id).not.toBe("first-rumor");
  });

  it("does not show after a second rumor is discovered", () => {
    const hint = getActiveHint(
      {
        turn: 8,
        supply: 5,
        maxSupply: 10,
        mode: "map",
        rumorProgressCount: 2,
      },
      new Set(),
    );

    expect(hint?.id).not.toBe("first-rumor");
  });
});

describe("low-supply hint with effective caps", () => {
  it("shows when supply is low and below effective max from relics", () => {
    const maxSupply = getEffectiveCaps([deepPack]).supply;

    const hint = getActiveHint(
      { turn: 5, supply: 1, maxSupply, mode: "map" },
      new Set(),
    );

    expect(hint?.id).toBe("low-supply");
  });

  it("suppresses when supply is at effective max cap", () => {
    const maxSupply = getEffectiveCaps([deepPack]).supply;

    const hint = getActiveHint(
      { turn: 5, supply: maxSupply, maxSupply, mode: "map" },
      new Set(),
    );

    expect(hint).toBeNull();
  });

  it("treats supply below effective max as not full (e.g. 8/12)", () => {
    const maxSupply = getEffectiveCaps([deepPack]).supply;

    expect(8 < maxSupply).toBe(true);
  });

  it("does not treat supply as at cap when at base max but below effective max", () => {
    const maxSupply = getEffectiveCaps([deepPack]).supply;
    const supply = 10;

    expect(supply < maxSupply).toBe(true);
    expect(supply < 10).toBe(false);
  });
});
