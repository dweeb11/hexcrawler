import { describe, expect, it, vi } from "vitest";

import { createAnalyticsClient } from "../../src/api/analytics";
import { coordKey, cubeCoord, neighbor } from "../../src/engine/hex";
import {
  createInitialState,
  type Encounter,
  type GameState,
  type Relic,
} from "../../src/engine/state";
import { PILLARS_DISTANCE_THRESHOLD, GEAR_RELIC_THRESHOLD } from "../../src/engine/win";
import {
  createGameSession,
  handleProgressionTransitions,
  type GameSessionAudio,
  type GameSessionHints,
  type GameSessionPersistence,
  type GameSessionPlaytest,
  type TransitionDeps,
} from "../../src/ui/game-session";
import { seededRng } from "../helpers";

function makeMocks() {
  const analytics = createAnalyticsClient("test-session");
  const track = vi.spyOn(analytics, "track");

  const audio: GameSessionAudio = {
    playMove: vi.fn(),
    playEncounterOpen: vi.fn(),
    playChoiceSelect: vi.fn(),
    playSearingAdvance: vi.fn(),
    playForage: vi.fn(),
    playRest: vi.fn(),
    playWin: vi.fn(),
    playLoss: vi.fn(),
  };

  const dismissed = new Set<string>();
  const hints: GameSessionHints = {
    dismiss: vi.fn((id) => {
      dismissed.add(id);
    }),
  };

  const persistence: GameSessionPersistence = {
    save: vi.fn(),
    clear: vi.fn(),
  };

  const playtest: GameSessionPlaytest = {
    submit: vi.fn(),
  };

  return { analytics, track, audio, hints, dismissed, persistence, playtest };
}

function makeSession(state?: GameState, seed = 42) {
  const mocks = makeMocks();
  const rng = seededRng(seed);
  const initialState = state ?? createInitialState([], rng);
  const session = createGameSession(initialState, rng, {
    analytics: mocks.analytics,
    audio: mocks.audio,
    hints: mocks.hints,
    persistence: mocks.persistence,
    playtest: mocks.playtest,
  });
  return { session, ...mocks, rng };
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

describe("game session transitions", () => {
  it("emits turn analytics only when next.turn > prev.turn", () => {
    const { session, track } = makeSession();
    const turnBefore = session.getState().turn;

    session.applyAction({ type: "push", direction: 0 });

    expect(session.getState().turn).toBe(turnBefore + 1);
    expect(track).toHaveBeenCalledWith("turn", {
      turnCount: turnBefore + 1,
      actionType: "push",
    });
    track.mockClear();

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
    const { session: encounterSession, track: encounterTrack } = makeSession(inEncounter);
    const chooseTurnBefore = encounterSession.getState().turn;

    encounterSession.applyAction({ type: "choose", choiceIndex: 0 });

    expect(encounterSession.getState().turn).toBe(chooseTurnBefore);
    expect(encounterTrack).not.toHaveBeenCalledWith(
      "turn",
      expect.objectContaining({ actionType: "choose" }),
    );
  });

  it("does not emit turn analytics for dismiss", () => {
    const { session, track } = makeSession();
    session.applyAction({ type: "pause", activity: "rest" });
    expect(session.getState().mode.type).toBe("camp");
    track.mockClear();

    const turnBefore = session.getState().turn;
    session.applyAction({ type: "dismiss" });

    expect(session.getState().turn).toBe(turnBefore);
    expect(track).not.toHaveBeenCalledWith("turn", expect.anything());
  });

  it("tracks encounter analytics when mode transitions to encounter", () => {
    const encounter: Encounter = {
      id: "forest-test",
      text: "A rustle in the leaves.",
      requiredTags: [],
      choices: [{ label: "Continue", outcome: {} }],
    };
    const base = createInitialState([], seededRng(1));
    const withEncounter = encounterOnNeighbor(base, encounter);
    const { session: encounterSession, track: encounterTrack } = makeSession(withEncounter);

    encounterSession.applyAction({ type: "push", direction: 0 });

    expect(encounterSession.getState().mode.type).toBe("encounter");
    expect(encounterTrack).toHaveBeenCalledWith("encounter", {
      turnCount: encounterSession.getState().turn,
      encounterId: "forest-test",
      biome: "forest",
    });
  });

  it("dismisses first-turn hint on first move", () => {
    const { session, hints } = makeSession();
    session.applyAction({ type: "push", direction: 0 });
    expect(hints.dismiss).toHaveBeenCalledWith("first-turn");
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
    const { session, hints } = makeSession(inEncounter);
    session.applyAction({ type: "choose", choiceIndex: 0 });
    expect(hints.dismiss).toHaveBeenCalledWith("first-encounter");
  });

  it("dismisses low-supply hint when foraging", () => {
    const { session, hints } = makeSession();
    session.applyAction({ type: "pause", activity: "forage" });
    expect(hints.dismiss).toHaveBeenCalledWith("low-supply");
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
    const mocks = makeMocks();
    const deps: TransitionDeps = {
      analytics: mocks.analytics,
      audio: mocks.audio,
      hints: mocks.hints,
      playtest: mocks.playtest,
    };

    handleProgressionTransitions(prev, next, { type: "push", direction: 0 }, deps);

    expect(mocks.hints.dismiss).toHaveBeenCalledWith("first-rumor");
  });

  it("saves while playing", () => {
    const { session, persistence } = makeSession();
    session.applyAction({ type: "push", direction: 0 });
    expect(session.getState().status).toBe("playing");
    expect(persistence.save).toHaveBeenCalled();
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
    const { session, persistence } = makeSession(nearWin, 99);

    session.applyAction({ type: "push", direction: 0 });

    expect(session.getState().status).toBe("won");
    expect(persistence.clear).toHaveBeenCalled();
    expect(persistence.save).not.toHaveBeenCalled();
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
    const { session, persistence } = makeSession(starving);
    session.applyAction({ type: "push", direction: 0 });

    expect(session.getState().status).toBe("lost");
    expect(persistence.clear).toHaveBeenCalled();
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
    const { session, playtest, track } = makeSession(nearWin);

    session.applyAction({ type: "choose", choiceIndex: 0 });

    expect(session.getState().status).toBe("won");
    expect(playtest.submit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "won" }),
      "won",
    );
    expect(track).toHaveBeenCalledWith("game_end", {
      outcome: "won",
      cause: "won",
      turnCount: session.getState().turn,
    });
  });

  it("submits playtest and game_end analytics on loss", () => {
    const dying: GameState = {
      ...createInitialState([], seededRng(1)),
      player: {
        ...createInitialState([], seededRng(1)).player,
        health: 0,
      },
    };
    const { session, playtest, track } = makeSession(dying);

    session.applyAction({ type: "push", direction: 0 });

    expect(session.getState().status).toBe("lost");
    expect(playtest.submit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "lost" }),
      "lost",
    );
    expect(track).toHaveBeenCalledWith(
      "game_end",
      expect.objectContaining({
        outcome: "lost",
        turnCount: session.getState().turn,
      }),
    );
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
    const mocks = makeMocks();
    const deps: TransitionDeps = {
      analytics: mocks.analytics,
      audio: mocks.audio,
      hints: mocks.hints,
      playtest: mocks.playtest,
    };

    handleProgressionTransitions(prev, next, { type: "choose", choiceIndex: 0 }, deps);
    handleProgressionTransitions(prev, next, { type: "dismiss" }, deps);

    expect(mocks.track).not.toHaveBeenCalledWith("turn", expect.anything());
  });
});
