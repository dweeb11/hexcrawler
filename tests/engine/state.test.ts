import { describe, expect, it } from "vitest";

import {
  createInitialState,
  deserializeState,
  serializeState,
  type Encounter,
  type GameState,
  type Relic,
  type Rumor,
} from "../../src/engine/state";
import { seededRng } from "../helpers";

describe("serializeState / deserializeState", () => {
  it("round-trips initial state without data loss", () => {
    const rng = seededRng(42);
    const state = createInitialState([], rng);

    const serialized = serializeState(state);
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);
    const restored = deserializeState(parsed);

    expect(restored.player).toEqual(state.player);
    expect(restored.turn).toBe(state.turn);
    expect(restored.status).toBe(state.status);
    expect(restored.searing).toEqual(state.searing);
    expect(restored.mode).toEqual(state.mode);
    expect(restored.log).toEqual(state.log);

    expect(restored.map.size).toBe(state.map.size);
    for (const [key, tile] of state.map) {
      const restoredTile = restored.map.get(key);
      expect(restoredTile).toBeDefined();
      expect(restoredTile?.biome).toBe(tile.biome);
      expect([...restoredTile!.tags]).toEqual([...tile.tags]);
      expect(restoredTile?.revealed).toBe(tile.revealed);
      expect(restoredTile?.consumed).toBe(tile.consumed);
      expect(restoredTile?.visited).toBe(tile.visited);
    }
  });

  it("round-trips state with encounters on tiles", () => {
    const rng = seededRng(42);
    const encounter: Encounter = {
      id: "test-enc",
      text: "A test",
      requiredTags: ["water"],
      choices: [{ label: "Drink", outcome: { hope: 1 } }],
    };
    const state = createInitialState([encounter], rng);

    const serialized = serializeState(state);
    const restored = deserializeState(JSON.parse(JSON.stringify(serialized)));

    for (const [key, tile] of state.map) {
      const restoredTile = restored.map.get(key);
      if (tile.encounter) {
        expect(restoredTile?.encounter).toEqual(tile.encounter);
      }
    }
  });

  it("round-trips encounter mode", () => {
    const rng = seededRng(42);
    const encounter: Encounter = {
      id: "test",
      text: "Test",
      requiredTags: [],
      choices: [{ label: "OK", outcome: {} }],
    };
    const state = createInitialState([], rng);
    const encounterState: GameState = {
      ...state,
      mode: { type: "encounter", encounter, hex: { q: 1, r: 0, s: -1 } },
    };

    const restored = deserializeState(
      JSON.parse(JSON.stringify(serializeState(encounterState))),
    );
    expect(restored.mode.type).toBe("encounter");
    if (restored.mode.type === "encounter") {
      expect(restored.mode.encounter.id).toBe("test");
      expect(restored.mode.hex).toEqual({ q: 1, r: 0, s: -1 });
    }
  });

  it("caps log entries to 50 on serialization", () => {
    const rng = seededRng(42);
    const state = createInitialState([], rng);
    const bigLogState: GameState = {
      ...state,
      log: Array.from({ length: 100 }, (_, i) => ({ turn: i, text: `Entry ${i}` })),
    };

    const serialized = serializeState(bigLogState);
    expect(serialized.log.length).toBeLessThanOrEqual(50);

    const restored = deserializeState(JSON.parse(JSON.stringify(serialized)));
    expect(restored.log.length).toBeLessThanOrEqual(50);
    expect(restored.log[restored.log.length - 1]?.text).toBe("Entry 99");
  });

  it("round-trips state with rumors and relics", () => {
    const rng = seededRng(42);
    const relic: Relic = {
      id: "ember-compass",
      name: "The Ember Compass",
      description: "Points toward warmth",
      effect: { type: "forage_bonus", chance: 0.15 },
    };
    const rumor: Rumor = {
      id: "whispering-well",
      title: "The Whispering Well",
      steps: [
        {
          stepIndex: 0,
          encounterId: "ww-step-1",
          hint: "Look for ancient water sources",
          hintTags: ["water", "ancient"],
        },
      ],
      reward: relic,
      hopeBonus: 3,
    };

    const state = createInitialState([], rng, [rumor]);
    const withProgress: GameState = {
      ...state,
      rumors: {
        ...state.rumors,
        active: [{ rumorId: "whispering-well", currentStep: 0 }],
      },
      relics: [relic],
    };

    const restored = deserializeState(
      JSON.parse(JSON.stringify(serializeState(withProgress)))
    );
    expect(restored.rumors.available).toHaveLength(1);
    expect(restored.rumors.active).toHaveLength(1);
    expect(restored.relics).toHaveLength(1);
    expect(restored.relics[0].id).toBe("ember-compass");
  });

  it("deserializes M1 saves without rumors/relics gracefully", () => {
    const rng = seededRng(42);
    const state = createInitialState([], rng);
    const serialized = serializeState(state);

    // Simulate M1 save that lacks rumor/relic fields
    const m1Save = { ...serialized } as Record<string, unknown>;
    delete m1Save.rumors;
    delete m1Save.relics;

    const restored = deserializeState(m1Save);
    expect(restored.rumors.available).toEqual([]);
    expect(restored.rumors.active).toEqual([]);
    expect(restored.relics).toEqual([]);
  });
});
