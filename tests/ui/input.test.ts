import { describe, expect, it } from "vitest";

import type { Encounter, GameMode } from "../../src/engine/state";
import { createInitialState } from "../../src/engine/state";
import {
  clickedNeighborToAction,
  keyToAction,
  resolveKeydown,
} from "../../src/ui/input";
import { seededRng } from "../helpers";

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

const mapState = createInitialState([], seededRng(1));

describe("resolveKeydown", () => {
  it("opens the journal with J while playing", () => {
    expect(resolveKeydown("j", { type: "map" }, "playing", false, mapState)).toEqual({
      type: "toggle-journal",
    });
  });

  it("closes the journal with J when it is already open", () => {
    expect(resolveKeydown("j", { type: "map" }, "playing", true, mapState)).toEqual({
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
        mapState,
      ),
    ).toEqual({
      type: "toggle-journal",
    });
  });

  it("closes the journal with Escape", () => {
    expect(resolveKeydown("Escape", { type: "map" }, "playing", true, mapState)).toEqual({
      type: "toggle-journal",
    });
  });

  it("blocks unrelated keys while the journal is open", () => {
    expect(resolveKeydown("x", { type: "map" }, "playing", true, mapState)).toEqual({
      type: "none",
    });
  });

  it("returns game-action for movement key while journal open", () => {
    expect(resolveKeydown("w", { type: "map" }, "playing", true, mapState)).toEqual({
      type: "game-action",
      action: { type: "push", direction: 2 },
      closeJournalFirst: true,
    });
  });

  it("returns game-action without closing when journal is closed", () => {
    expect(resolveKeydown("w", { type: "map" }, "playing", false, mapState)).toEqual({
      type: "game-action",
      action: { type: "push", direction: 2 },
      closeJournalFirst: false,
    });
  });

  it("returns game-action for encounter choices while the journal is open", () => {
    expect(resolveKeydown("1", encounterMode, "playing", true, mapState)).toEqual({
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
        mapState,
      ),
    ).toEqual({
      type: "none",
    });
  });
});

describe("push input visibility filtering", () => {
  const lowHopeState = {
    ...mapState,
    player: { ...mapState.player, hope: 1 },
    searing: { ...mapState.searing, axis: "q" as const, direction: 1 as const },
  };

  it("filters keyboard push into non-visible neighbors", () => {
    expect(keyToAction("d", { type: "map" }, lowHopeState)).toBeNull();
    expect(resolveKeydown("d", { type: "map" }, "playing", false, lowHopeState)).toEqual({
      type: "none",
    });
  });

  it("filters click-to-move on non-visible neighbor hexes", () => {
    expect(clickedNeighborToAction(lowHopeState, { q: 1, r: 0, s: -1 })).toBeNull();
  });

  it("allows click-to-move on visible neighbor hexes", () => {
    expect(clickedNeighborToAction(lowHopeState, { q: 0, r: -1, s: 1 })).toEqual({
      type: "push",
      direction: 2,
    });
  });
});
