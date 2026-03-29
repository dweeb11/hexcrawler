import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearSave, hasSave, loadGame, saveGame, SAVE_KEY } from "../../src/engine/save";
import { createInitialState } from "../../src/engine/state";

function seededRng(seed: number) {
  let value = seed;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};

vi.stubGlobal("localStorage", localStorageMock);

describe("save/load", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("reports no save when storage is empty", () => {
    expect(hasSave()).toBe(false);
  });

  it("saves and loads a game state", () => {
    const state = createInitialState([], seededRng(42));
    saveGame(state);
    expect(hasSave()).toBe(true);

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded?.player).toEqual(state.player);
    expect(loaded?.turn).toBe(state.turn);
    expect(loaded?.searing).toEqual(state.searing);
  });

  it("clears saved game", () => {
    const state = createInitialState([], seededRng(42));
    saveGame(state);
    expect(hasSave()).toBe(true);

    clearSave();
    expect(hasSave()).toBe(false);
    expect(loadGame()).toBeNull();
  });

  it("returns null for corrupted save data", () => {
    storage.set(SAVE_KEY, "not valid json{{{");
    expect(loadGame()).toBeNull();
  });
});
