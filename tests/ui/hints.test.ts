import { describe, expect, it } from "vitest";

import { getActiveHint } from "../../src/ui/hints";

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
