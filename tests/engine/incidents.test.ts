import { describe, expect, it } from "vitest";

import { rollNightIncident } from "../../src/engine/data/incidents";

describe("rollNightIncident", () => {
  it("returns null on a quiet night", () => {
    expect(rollNightIncident(() => 0.3)).toBeNull();
  });

  it("returns a weighted incident when triggered", () => {
    let callCount = 0;
    const rng = () => {
      callCount += 1;
      return callCount === 1 ? 0.7 : 0.1;
    };
    const result = rollNightIncident(rng);
    expect(result).not.toBeNull();
    expect(result?.text).toBeTruthy();
  });
});
