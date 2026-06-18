import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsClient } from "../../src/api/analytics";
import { coordKey, cubeCoord, neighbor } from "../../src/engine/hex";
import {
  createInitialState,
  type Encounter,
  type GameState,
  type Relic,
} from "../../src/engine/state";
import { PILLARS_DISTANCE_THRESHOLD, GEAR_RELIC_THRESHOLD } from "../../src/engine/win";
import {
  createAppSession,
  createGameSession,
  ENCOUNTER_REVEAL_DELAY_MS,
  handleProgressionTransitions,
  type GameSessionDeps,
  type TransitionDeps,
} from "../../src/session/game-session";
import { keyToAction } from "../../src/ui/input";
import { hasSave, saveGame } from "../../src/ui/save";
import { seededRng } from "../helpers";

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

function createMockDeps(rng = seededRng(42)): GameSessionDeps & {
  persistence: { save: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
  track: ReturnType<typeof vi.fn>;
} {
  const persistence = {
    save: vi.fn(),
    clear: vi.fn(),
  };

  const track = vi.fn();
  const analytics: AnalyticsClient = {
    sessionId: "test-session",
    track,
  };

  return {
    getRng: () => rng,
    getAnalytics: () => analytics,
    track,
    audio: {
      playMove: vi.fn(),
      playEncounterOpen: vi.fn(),
      playChoiceSelect: vi.fn(),
      playSearingAdvance: vi.fn(),
      playForage: vi.fn(),
      playRest: vi.fn(),
      playWin: vi.fn(),
      playLoss: vi.fn(),
    },
    hints: { dismissHint: vi.fn() },
    persistence,
    playtest: { submit: vi.fn() },
  };
}

function makeSession(state?: GameState, seed = 42) {
  const deps = createMockDeps(seededRng(seed));
  const initialState = state ?? createInitialState([], deps.getRng());
  const session = createGameSession(initialState, deps);
  return { session, deps };
}

function encounterOnNeighbor(state: GameState, encounter: Encounter): GameState {
  const target = neighbor(state.player.hex, 0);
  return {
    ...state,
    map: new Map(state.map).set(coordKey(target), {
      coord: target,
      biome: "forest",
      tags: new Set(["wood", "water"]),
      encounter,
      revealed: true,
      consumed: false,
      visited: false,
    }),
  };
}

describe("createGameSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatch returns updated state and saves while playing", () => {
    const deps = createMockDeps();
    const initialState = createInitialState([], deps.getRng());
    const session = createGameSession(initialState, deps);

    const next = session.dispatch({ type: "push", direction: 0 });

    expect(next.turn).toBeGreaterThan(initialState.turn);
    expect(next).toBe(session.getState());
    expect(deps.persistence.save).toHaveBeenCalledWith(next);
    expect(deps.persistence.clear).not.toHaveBeenCalled();
  });

  it("dispatch clears save on game over", () => {
    const deps = createMockDeps();
    const initialState = createInitialState([], deps.getRng());
    const session = createGameSession(
      {
        ...initialState,
        player: { ...initialState.player, health: 0 },
      },
      deps,
    );

    const next = session.dispatch({ type: "push", direction: 0 });

    expect(next.status).toBe("lost");
    expect(deps.persistence.clear).toHaveBeenCalled();
    expect(deps.persistence.save).not.toHaveBeenCalled();
  });

  it("restart resets state and clears save", () => {
    const deps = createMockDeps();
    const initialState = createInitialState([], deps.getRng());
    const session = createGameSession(initialState, deps);
    session.dispatch({ type: "push", direction: 0 });

    const freshState = createInitialState([], deps.getRng());
    session.restart(freshState);

    expect(session.getState()).toBe(freshState);
    expect(deps.persistence.clear).toHaveBeenCalled();
  });
});

describe("game session transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits turn analytics only when next.turn > prev.turn", () => {
    const { session, deps } = makeSession();
    const turnBefore = session.getState().turn;

    session.dispatch({ type: "push", direction: 0 });

    expect(session.getState().turn).toBe(turnBefore + 1);
    expect(deps.track).toHaveBeenCalledWith("turn", {
      turnCount: turnBefore + 1,
      actionType: "push",
    });
    deps.track.mockClear();

    const encounter: Encounter = {
      id: "choice-test",
      text: "Test encounter",
      requiredTags: [],
      choices: [{ label: "OK", outcome: { hope: 1 } }],
    };
    const inEncounter = {
      ...session.getState(),
      player: { ...session.getState().player, hope: 3 },
      mode: {
        type: "encounter" as const,
        encounter,
        hex: cubeCoord(1, 0, -1),
      },
    };
    const { session: encounterSession, deps: encounterDeps } = makeSession(inEncounter);
    const chooseTurnBefore = encounterSession.getState().turn;

    encounterSession.dispatch({ type: "choose", choiceIndex: 0 });

    expect(encounterSession.getState().turn).toBe(chooseTurnBefore);
    expect(encounterDeps.track).not.toHaveBeenCalledWith(
      "turn",
      expect.objectContaining({ actionType: "choose" }),
    );
  });

  it("does not emit turn analytics for dismiss", () => {
    const { session, deps } = makeSession();
    session.dispatch({ type: "pause", activity: "rest" });
    expect(session.getState().mode.type).toBe("camp");
    expect(deps.audio.playRest).toHaveBeenCalled();
    deps.track.mockClear();

    const turnBefore = session.getState().turn;
    session.dispatch({ type: "dismiss" });

    expect(session.getState().turn).toBe(turnBefore);
    expect(deps.track).not.toHaveBeenCalledWith("turn", expect.anything());
  });

  it("tracks encounter analytics after the reveal beat", () => {
    vi.useFakeTimers();
    const encounter: Encounter = {
      id: "forest-test",
      text: "A rustle in the leaves.",
      requiredTags: [],
      choices: [{ label: "Continue", outcome: {} }],
    };
    const base = createInitialState([], seededRng(1));
    const withEncounter = encounterOnNeighbor(base, encounter);
    const { session: encounterSession, deps } = makeSession(withEncounter);

    encounterSession.dispatch({ type: "push", direction: 0 });

    expect(encounterSession.getState().mode.type).toBe("pendingEncounter");
    expect(deps.track).not.toHaveBeenCalledWith("encounter", expect.anything());
    expect(deps.audio.playEncounterOpen).not.toHaveBeenCalled();

    vi.advanceTimersByTime(ENCOUNTER_REVEAL_DELAY_MS);

    expect(encounterSession.getState().mode.type).toBe("encounter");
    expect(deps.track).toHaveBeenCalledWith("encounter", {
      turnCount: encounterSession.getState().turn,
      encounterId: "forest-test",
      biome: "forest",
    });
    expect(deps.audio.playEncounterOpen).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("resumes encounter reveal timer when loading pendingEncounter state", () => {
    vi.useFakeTimers();
    const encounter: Encounter = {
      id: "resume-test",
      text: "Waiting.",
      requiredTags: [],
      choices: [{ label: "Continue", outcome: {} }],
    };
    const base = createInitialState([], seededRng(1));
    const withEncounter = encounterOnNeighbor(base, encounter);
    const { session: firstSession } = makeSession(withEncounter);

    firstSession.dispatch({ type: "push", direction: 0 });
    expect(firstSession.getState().mode.type).toBe("pendingEncounter");

    const { session: resumedSession, deps: resumedDeps } = makeSession(
      firstSession.getState(),
    );

    expect(resumedSession.getState().mode.type).toBe("pendingEncounter");
    expect(resumedDeps.audio.playEncounterOpen).not.toHaveBeenCalled();
    expect(resumedDeps.track).not.toHaveBeenCalledWith("encounter", expect.anything());

    vi.advanceTimersByTime(ENCOUNTER_REVEAL_DELAY_MS);

    expect(resumedSession.getState().mode.type).toBe("encounter");
    expect(resumedDeps.audio.playEncounterOpen).toHaveBeenCalledTimes(1);
    expect(resumedDeps.track).toHaveBeenCalledWith("encounter", {
      turnCount: resumedSession.getState().turn,
      encounterId: "resume-test",
      biome: "forest",
    });
    vi.useRealTimers();
  });

  it("ignores input while an encounter reveal is pending", () => {
    const encounter: Encounter = {
      id: "blocked-test",
      text: "Blocked.",
      requiredTags: [],
      choices: [{ label: "Continue", outcome: {} }],
    };
    const base = createInitialState([], seededRng(1));
    const withEncounter = encounterOnNeighbor(base, encounter);
    const { session } = makeSession(withEncounter);

    session.dispatch({ type: "push", direction: 0 });
    expect(session.getState().mode.type).toBe("pendingEncounter");

    const action = keyToAction("1", session.getState().mode, session.getState());
    expect(action).toBeNull();
  });

  it("dismisses first-turn hint on first move", () => {
    const { session, deps } = makeSession();
    session.dispatch({ type: "push", direction: 0 });
    expect(deps.hints.dismissHint).toHaveBeenCalledWith("first-turn");
    expect(deps.audio.playMove).toHaveBeenCalled();
  });

  it("dismisses first-encounter hint when choosing in encounter mode", () => {
    const encounter: Encounter = {
      id: "hint-test",
      text: "Test",
      requiredTags: [],
      choices: [{ label: "OK", outcome: { hope: 1 } }],
    };
    const inEncounter = {
      ...createInitialState([], seededRng(1)),
      player: { ...createInitialState([], seededRng(1)).player, hope: 3 },
      mode: {
        type: "encounter" as const,
        encounter,
        hex: cubeCoord(1, 0, -1),
      },
    };
    const { session, deps } = makeSession(inEncounter);
    session.dispatch({ type: "choose", choiceIndex: 0 });
    expect(deps.hints.dismissHint).toHaveBeenCalledWith("first-encounter");
    expect(deps.audio.playChoiceSelect).toHaveBeenCalled();
  });

  it("dismisses low-supply hint when foraging", () => {
    const { session, deps } = makeSession();
    session.dispatch({ type: "pause", activity: "forage" });
    expect(deps.hints.dismissHint).toHaveBeenCalledWith("low-supply");
    expect(deps.audio.playForage).toHaveBeenCalled();
  });

  it("dismisses first-rumor hint when a second rumor is discovered", () => {
    const prev = createInitialState([], seededRng(1));
    const next: GameState = {
      ...prev,
      turn: 5,
      rumors: {
        ...prev.rumors,
        active: [
          { rumorId: "rumor-a", currentStep: 0 },
          { rumorId: "rumor-b", currentStep: 0 },
        ],
      },
    };
    const deps = createMockDeps();
    const transitionDeps: TransitionDeps = {
      getAnalytics: () => deps.getAnalytics(),
      audio: deps.audio,
      hints: deps.hints,
      playtest: deps.playtest,
    };

    handleProgressionTransitions(prev, next, { type: "push", direction: 0 }, transitionDeps);

    expect(deps.hints.dismissHint).toHaveBeenCalledWith("first-rumor");
  });

  it("tracks relic analytics when a relic is discovered", () => {
    const prev = createInitialState([], seededRng(1));
    const newRelic: Relic = {
      id: "found-relic",
      name: "Found Relic",
      description: "Test relic",
      effect: { type: "forage_bonus", bonus: 1 },
    };
    const next: GameState = {
      ...prev,
      turn: 5,
      relics: [...prev.relics, newRelic],
    };
    const deps = createMockDeps();
    const transitionDeps: TransitionDeps = {
      getAnalytics: () => deps.getAnalytics(),
      audio: deps.audio,
      hints: deps.hints,
      playtest: deps.playtest,
    };

    handleProgressionTransitions(prev, next, { type: "push", direction: 0 }, transitionDeps);

    expect(deps.track).toHaveBeenCalledWith("relic", {
      relicId: "found-relic",
      turnCount: 5,
    });
  });

  it("saves while playing", () => {
    const { session, deps } = makeSession();
    session.dispatch({ type: "push", direction: 0 });
    expect(session.getState().status).toBe("playing");
    expect(deps.persistence.save).toHaveBeenCalled();
  });

  it("clears save on win", () => {
    const thresholdQ = createInitialState([], seededRng(1)).searing.line + PILLARS_DISTANCE_THRESHOLD;
    const startHex = cubeCoord(thresholdQ - 1, -(thresholdQ - 1), 0);
    const base = createInitialState([], seededRng(99));
    const nearWin: GameState = {
      ...base,
      searing: { ...base.searing, axis: "q", direction: 1, advanceRate: 999 },
      player: { ...base.player, hex: startHex },
      map: new Map(base.map).set(coordKey(startHex), {
        coord: startHex,
        biome: "forest",
        tags: new Set(["wood"]),
        encounter: null,
        revealed: true,
        consumed: false,
        visited: true,
      }),
    };
    const { session, deps } = makeSession(nearWin, 99);

    session.dispatch({ type: "push", direction: 0 });

    expect(session.getState().status).toBe("won");
    expect(deps.persistence.clear).toHaveBeenCalled();
    expect(deps.persistence.save).not.toHaveBeenCalled();
  });

  it("clears save on loss", () => {
    const starving: GameState = {
      ...createInitialState([], seededRng(1)),
      player: {
        ...createInitialState([], seededRng(1)).player,
        supply: 0,
        health: 1,
      },
    };
    const { session, deps } = makeSession(starving);
    session.dispatch({ type: "push", direction: 0 });

    expect(session.getState().status).toBe("lost");
    expect(deps.persistence.clear).toHaveBeenCalled();
  });

  it("submits playtest and game_end analytics on win", () => {
    const relics: Relic[] = Array.from({ length: GEAR_RELIC_THRESHOLD }, (_, i) => ({
      id: `gear-${i}`,
      name: `Gear ${i}`,
      description: "Ritual relic",
      effect: { type: "forage_bonus", bonus: 1 },
    }));
    const encounter: Encounter = {
      id: "gear-ritual-prep",
      text: "The ritual is within reach.",
      requiredTags: [],
      choices: [{ label: "Continue", outcome: {} }],
    };
    const nearWin: GameState = {
      ...createInitialState([], seededRng(1)),
      relics,
      mode: { type: "encounter", encounter, hex: cubeCoord(0, 0, 0) },
    };
    const { session, deps } = makeSession(nearWin);

    session.dispatch({ type: "choose", choiceIndex: 0 });

    expect(session.getState().status).toBe("won");
    expect(deps.playtest.submit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "won" }),
      "won",
    );
    expect(deps.track).toHaveBeenCalledWith("game_end", {
      outcome: "won",
      cause: "won",
      turnCount: session.getState().turn,
    });
    expect(deps.audio.playWin).toHaveBeenCalled();
  });

  it("submits playtest and game_end analytics on loss", () => {
    const dying: GameState = {
      ...createInitialState([], seededRng(1)),
      player: {
        ...createInitialState([], seededRng(1)).player,
        health: 0,
      },
    };
    const { session, deps } = makeSession(dying);

    session.dispatch({ type: "push", direction: 0 });

    expect(session.getState().status).toBe("lost");
    expect(deps.playtest.submit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "lost" }),
      "lost",
    );
    expect(deps.track).toHaveBeenCalledWith(
      "game_end",
      expect.objectContaining({
        outcome: "lost",
        turnCount: session.getState().turn,
      }),
    );
    expect(deps.audio.playLoss).toHaveBeenCalled();
  });
});

describe("handleProgressionTransitions turn semantics", () => {
  it("documents that choose and dismiss never emit turn analytics", () => {
    const prev = createInitialState([], seededRng(1));
    const next: GameState = {
      ...prev,
      mode: { type: "map" },
      player: { ...prev.player, hope: prev.player.hope + 1 },
    };
    const deps = createMockDeps();
    const transitionDeps: TransitionDeps = {
      getAnalytics: () => deps.getAnalytics(),
      audio: deps.audio,
      hints: deps.hints,
      playtest: deps.playtest,
    };

    handleProgressionTransitions(prev, next, { type: "choose", choiceIndex: 0 }, transitionDeps);
    handleProgressionTransitions(prev, next, { type: "dismiss" }, transitionDeps);

    expect(deps.track).not.toHaveBeenCalledWith("turn", expect.anything());
  });
});

describe("createAppSession", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        currentTime = 0;
        sampleRate = 44100;
        destination = {};
        resume = vi.fn().mockResolvedValue(undefined);
        createOscillator = vi.fn(() => ({
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          type: "sine",
          frequency: { setValueAtTime: vi.fn() },
        }));
        createGain = vi.fn(() => ({
          connect: vi.fn(),
          gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        }));
        createBuffer = vi.fn((_channels: number, length: number) => ({
          getChannelData: () => new Float32Array(length),
        }));
        createBufferSource = vi.fn(() => ({
          connect: vi.fn(),
          start: vi.fn(),
          buffer: null,
        }));
      },
    );
  });

  it("starts a new game and tracks game_start when no save exists", () => {
    const session = createAppSession({ encounters: [], rumors: [] });
    expect(session.hasContinuableSave()).toBe(false);

    session.start(false);

    expect(session.getState().turn).toBe(0);
    expect(session.getState().status).toBe("playing");
  });

  it("continues saved pendingEncounter and reveals after delay", () => {
    vi.useFakeTimers();
    const encounter: Encounter = {
      id: "saved-pending",
      text: "Saved mid-beat.",
      requiredTags: [],
      choices: [{ label: "Continue", outcome: {} }],
    };
    const base = createInitialState([], seededRng(1));
    const withEncounter = encounterOnNeighbor(base, encounter);
    const { session } = makeSession(withEncounter);

    session.dispatch({ type: "push", direction: 0 });
    expect(session.getState().mode.type).toBe("pendingEncounter");
    saveGame(session.getState());

    const appSession = createAppSession({ encounters: [], rumors: [] });
    expect(appSession.hasContinuableSave()).toBe(true);
    appSession.start(true);

    expect(appSession.getState().mode.type).toBe("pendingEncounter");
    vi.advanceTimersByTime(ENCOUNTER_REVEAL_DELAY_MS);
    expect(appSession.getState().mode.type).toBe("encounter");
    vi.useRealTimers();
  });

  it("continues a saved game without emitting game_start", () => {
    const saved = createInitialState([], seededRng(7));
    saved.log.push({ turn: 1, text: "progress" });
    saveGame({ ...saved, turn: 3 });

    const session = createAppSession({ encounters: [], rumors: [] });
    expect(session.hasContinuableSave()).toBe(true);

    session.start(true);

    expect(session.getState().turn).toBe(3);
    expect(session.getState().log).toContainEqual({ turn: 1, text: "progress" });
  });

  it("continues from cached snapshot when save is cleared before start", () => {
    const saved = createInitialState([], seededRng(7));
    saveGame({ ...saved, turn: 4 });

    const session = createAppSession({ encounters: [], rumors: [] });
    expect(session.hasContinuableSave()).toBe(true);
    storage.clear();

    session.start(true);

    expect(session.getState().turn).toBe(4);
    expect(session.getState().status).toBe("playing");
  });

  it("starts fresh when user declines continue", () => {
    const saved = createInitialState([], seededRng(7));
    saveGame({ ...saved, turn: 5 });

    const session = createAppSession({ encounters: [], rumors: [] });
    session.start(false);

    expect(session.getState().turn).toBe(0);
    expect(hasSave()).toBe(false);
  });

  it("restart resets to a new game", () => {
    const session = createAppSession({ encounters: [], rumors: [] });
    session.start(false);

    session.restart();

    expect(session.getState().turn).toBe(0);
    expect(session.getState().status).toBe("playing");
  });

  it("dismisses first-rumor hint when journal opens", () => {
    const session = createAppSession({ encounters: [], rumors: [] });
    session.start(false);

    session.onJournalOpen();

    expect(session.getDismissedHints().has("first-rumor")).toBe(true);
  });
});
