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

  it("applies priority order when multiple hints match", () => {
    const hint = getActiveHint(
      {
        turn: 0,
        supply: 1,
        maxSupply: 5,
        mode: "encounter",
      },
      new Set(),
    );

    expect(hint).toEqual({
      id: "first-turn",
      text: "QWEASD to move  |  R to rest  |  F to forage",
    });
  });
});
