import { describe, expect, it } from "vitest";

import { getActiveHint } from "../../src/ui/hints";

const baseContext = {
  turn: 1,
  supply: 3,
  maxSupply: 5,
  mode: "map",
};

describe("getActiveHint", () => {
  it("returns first-turn hint on turn zero", () => {
    const hint = getActiveHint({ ...baseContext, turn: 0 }, new Set());
    expect(hint?.id).toBe("first-turn");
  });

  it("returns null when first-turn hint is dismissed", () => {
    const hint = getActiveHint({ ...baseContext, turn: 0 }, new Set(["first-turn"]));
    expect(hint).toBeNull();
  });

  it("returns null when no hint condition matches", () => {
    const hint = getActiveHint(baseContext, new Set());
    expect(hint).toBeNull();
  });

  it("applies priority ordering when multiple hints match", () => {
    const hint = getActiveHint(
      { ...baseContext, turn: 0, supply: 1, mode: "encounter" },
      new Set(),
    );
    expect(hint?.id).toBe("first-turn");
  });
});
