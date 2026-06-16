import { describe, expect, it } from "vitest";

import type { Encounter, GameMode } from "../../src/engine/state";
import { resolveKeydown } from "../../src/ui/input";

const encounter: Encounter = {
  id: "test-encounter",
  text: "Choose.",
  requiredTags: [],
  choices: [
    { label: "One", outcome: {} },
    { label: "Two", outcome: {} },
  ],
};

const encounterMode: GameMode = {
  type: "encounter",
  hex: { q: 0, r: 0, s: 0 },
  encounter,
};

describe("resolveKeydown", () => {
  it("opens the journal with J while playing", () => {
    expect(resolveKeydown("j", { type: "map" }, "playing", false)).toEqual({
      type: "toggle-journal",
    });
  });

  it("closes the journal with J when it is already open", () => {
    expect(resolveKeydown("j", { type: "map" }, "playing", true)).toEqual({
      type: "toggle-journal",
    });
  });

  it("closes the journal with J after the game ends while it remains open", () => {
    expect(
      resolveKeydown(
        "j",
        { type: "gameover", reason: "searing", outcome: "loss_searing" },
        "lost",
        true,
      ),
    ).toEqual({
      type: "toggle-journal",
    });
  });

  it("closes the journal with Escape", () => {
    expect(resolveKeydown("Escape", { type: "map" }, "playing", true)).toEqual({
      type: "toggle-journal",
    });
  });

  it("blocks unrelated keys while the journal is open", () => {
    expect(resolveKeydown("x", { type: "map" }, "playing", true)).toEqual({
      type: "none",
    });
  });

  it("returns game-action for movement key while journal open", () => {
    expect(resolveKeydown("w", { type: "map" }, "playing", true)).toEqual({
      type: "game-action",
      action: { type: "push", direction: 2 },
      closeJournalFirst: true,
    });
  });

  it("returns game-action without closing when journal is closed", () => {
    expect(resolveKeydown("w", { type: "map" }, "playing", false)).toEqual({
      type: "game-action",
      action: { type: "push", direction: 2 },
      closeJournalFirst: false,
    });
  });

  it("returns game-action for encounter choices while the journal is open", () => {
    expect(resolveKeydown("1", encounterMode, "playing", true)).toEqual({
      type: "game-action",
      action: { type: "choose", choiceIndex: 0 },
      closeJournalFirst: true,
    });
  });

  it("does not open the journal with J when the game is over", () => {
    expect(
      resolveKeydown(
        "j",
        { type: "gameover", reason: "searing", outcome: "loss_searing" },
        "lost",
        false,
      ),
    ).toEqual({
      type: "none",
    });
  });
});
