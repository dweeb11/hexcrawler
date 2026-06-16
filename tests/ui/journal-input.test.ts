import { describe, expect, it } from "vitest";

import type { Encounter, GameMode } from "../../src/engine/state";
import { resolveJournalKeydown } from "../../src/ui/journal-input";

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

describe("resolveJournalKeydown", () => {
  it("opens the journal with J while playing", () => {
    expect(resolveJournalKeydown("j", { type: "map" }, "playing", false)).toEqual({
      type: "toggle-journal",
    });
  });

  it("closes the journal with J when it is already open", () => {
    expect(resolveJournalKeydown("j", { type: "map" }, "playing", true)).toEqual({
      type: "toggle-journal",
    });
  });

  it("closes the journal with J after the game ends while it remains open", () => {
    expect(
      resolveJournalKeydown(
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
    expect(resolveJournalKeydown("Escape", { type: "map" }, "playing", true)).toEqual({
      type: "close-journal",
    });
  });

  it("blocks unrelated keys while the journal is open", () => {
    expect(resolveJournalKeydown("x", { type: "map" }, "playing", true)).toEqual({
      type: "none",
    });
  });

  it("applies map movement after closing the journal", () => {
    expect(resolveJournalKeydown("w", { type: "map" }, "playing", true)).toEqual({
      type: "game-action",
      action: { type: "push", direction: 2 },
    });
  });

  it("applies encounter choices while the journal is open", () => {
    expect(resolveJournalKeydown("1", encounterMode, "playing", true)).toEqual({
      type: "game-action",
      action: { type: "choose", choiceIndex: 0 },
    });
  });

  it("does not open the journal with J when the game is over", () => {
    expect(
      resolveJournalKeydown(
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
