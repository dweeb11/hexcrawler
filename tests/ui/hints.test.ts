import { describe, expect, it } from "vitest";

import { getActiveHint } from "../../src/ui/hints";

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
