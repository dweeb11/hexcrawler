import type { AnalyticsClient } from "../api/analytics";
import { coordKey } from "../engine/hex";
import type { Action, GameState, RNG } from "../engine/state";
import { resolveTurn } from "../engine/turn";
import type { HintId } from "../ui/hints";

export interface GameSessionAudio {
  playMove(): void;
  playEncounterOpen(): void;
  playChoiceSelect(): void;
  playSearingAdvance(): void;
  playForage(): void;
  playRest(): void;
  playWin(): void;
  playLoss(): void;
}

export interface GameSessionHints {
  dismissHint(id: HintId): void;
}

export interface GameSessionPersistence {
  save(state: GameState): void;
  clear(): void;
}

export interface GameSessionPlaytest {
  submit(gameState: GameState, outcome: "won" | "lost"): void;
}

export interface GameSessionDeps {
  getRng(): RNG;
  getAnalytics(): AnalyticsClient;
  audio: GameSessionAudio;
  hints: GameSessionHints;
  persistence: GameSessionPersistence;
  playtest: GameSessionPlaytest;
}

export interface GameSession {
  getState(): GameState;
  restart(initialState: GameState): void;
  dispatch(action: Action): GameState;
}

export function createGameSession(
  initialState: GameState,
  deps: GameSessionDeps,
): GameSession {
  let state = initialState;

  const persistState = (nextState: GameState) => {
    if (nextState.status === "playing") {
      deps.persistence.save(nextState);
    } else {
      deps.persistence.clear();
    }
  };

  const dispatch = (action: Action): GameState => {
    const previousState = state;
    const nextState = resolveTurn(previousState, action, deps.getRng());
    const previousRumorIds = new Set(previousState.rumors.active.map((rumor) => rumor.rumorId));
    const previousRelicIds = new Set(previousState.relics.map((relic) => relic.id));

    if (
      action.type === "push" &&
      coordKey(nextState.player.hex) !== coordKey(previousState.player.hex)
    ) {
      deps.hints.dismissHint("first-turn");
      deps.audio.playMove();
    }

    if (action.type === "choose" && previousState.mode.type === "encounter") {
      deps.hints.dismissHint("first-encounter");
      deps.audio.playChoiceSelect();
    }

    if (action.type === "pause" && action.activity === "forage") {
      deps.hints.dismissHint("low-supply");
      deps.audio.playForage();
    }

    if (action.type === "pause" && action.activity === "rest") {
      deps.audio.playRest();
    }

    if (
      nextState.mode.type === "encounter" &&
      previousState.mode.type !== "encounter"
    ) {
      deps.audio.playEncounterOpen();
      const encounterHex = nextState.map.get(coordKey(nextState.mode.hex));
      deps.getAnalytics().track("encounter", {
        turnCount: nextState.turn,
        encounterId: nextState.mode.encounter.id,
        biome: encounterHex?.biome ?? null,
      });
    }

    if (nextState.searing.line !== previousState.searing.line) {
      deps.audio.playSearingAdvance();
    }

    if (nextState.status === "won" && previousState.status !== "won") {
      deps.audio.playWin();
      deps.playtest.submit(nextState, "won");
      deps.getAnalytics().track("game_end", {
        outcome: "won",
        cause: "won",
        turnCount: nextState.turn,
      });
    }

    if (nextState.status === "lost" && previousState.status !== "lost") {
      deps.audio.playLoss();
      deps.playtest.submit(nextState, "lost");
      deps.getAnalytics().track("game_end", {
        outcome: "lost",
        cause: nextState.mode.type === "gameover" ? nextState.mode.reason : "unknown",
        turnCount: nextState.turn,
      });
    }

    if (nextState.turn > previousState.turn) {
      deps.getAnalytics().track("turn", {
        turnCount: nextState.turn,
        actionType: action.type,
      });
    }

    for (const rumor of nextState.rumors.active) {
      if (!previousRumorIds.has(rumor.rumorId)) {
        deps.getAnalytics().track("rumor", {
          rumorId: rumor.rumorId,
          turnCount: nextState.turn,
        });
        const progressCount =
          nextState.rumors.active.length + nextState.rumors.completed.length;
        if (progressCount > 1) {
          deps.hints.dismissHint("first-rumor");
        }
      }
    }

    for (const relic of nextState.relics) {
      if (!previousRelicIds.has(relic.id)) {
        deps.getAnalytics().track("relic", {
          relicId: relic.id,
          turnCount: nextState.turn,
        });
      }
    }

    state = nextState;
    persistState(state);
    return state;
  };

  return {
    getState: () => state,
    restart: (newState: GameState) => {
      state = newState;
      deps.persistence.clear();
    },
    dispatch,
  };
}
