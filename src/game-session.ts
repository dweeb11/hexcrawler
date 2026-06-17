import type { AnalyticsClient } from "./api/analytics";
import { coordKey } from "./engine/hex";
import type { Action, GameState, RNG } from "./engine/state";
import { resolveTurn } from "./engine/turn";
import type { HintId } from "./ui/hints";

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

export interface GameSessionDeps {
  rng: RNG;
  analytics: AnalyticsClient;
  audio: GameSessionAudio;
  dismissHint: (id: HintId) => void;
  persistState: (state: GameState) => void;
  submitPlaytest: (state: GameState, outcome: "won" | "lost") => void;
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

  const dispatch = (action: Action): GameState => {
    const previousState = state;
    const nextState = resolveTurn(previousState, action, deps.rng);
    const previousRumorIds = new Set(previousState.rumors.active.map((rumor) => rumor.rumorId));
    const previousRelicIds = new Set(previousState.relics.map((relic) => relic.id));

    if (
      action.type === "push" &&
      coordKey(nextState.player.hex) !== coordKey(previousState.player.hex)
    ) {
      deps.dismissHint("first-turn");
      deps.audio.playMove();
    }

    if (action.type === "choose" && previousState.mode.type === "encounter") {
      deps.dismissHint("first-encounter");
      deps.audio.playChoiceSelect();
    }

    if (action.type === "pause" && action.activity === "forage") {
      deps.dismissHint("low-supply");
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
      deps.analytics.track("encounter", {
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
      deps.submitPlaytest(nextState, "won");
      deps.analytics.track("game_end", {
        outcome: "won",
        cause: "won",
        turnCount: nextState.turn,
      });
    }

    if (nextState.status === "lost" && previousState.status !== "lost") {
      deps.audio.playLoss();
      deps.submitPlaytest(nextState, "lost");
      deps.analytics.track("game_end", {
        outcome: "lost",
        cause: nextState.mode.type === "gameover" ? nextState.mode.reason : "unknown",
        turnCount: nextState.turn,
      });
    }

    if (nextState.turn > previousState.turn) {
      deps.analytics.track("turn", {
        turnCount: nextState.turn,
        actionType: action.type,
      });
    }

    for (const rumor of nextState.rumors.active) {
      if (!previousRumorIds.has(rumor.rumorId)) {
        deps.analytics.track("rumor", {
          rumorId: rumor.rumorId,
          turnCount: nextState.turn,
        });
        const progressCount =
          nextState.rumors.active.length + nextState.rumors.completed.length;
        if (progressCount > 1) {
          deps.dismissHint("first-rumor");
        }
      }
    }

    for (const relic of nextState.relics) {
      if (!previousRelicIds.has(relic.id)) {
        deps.analytics.track("relic", {
          relicId: relic.id,
          turnCount: nextState.turn,
        });
      }
    }

    state = nextState;
    deps.persistState(state);
    return state;
  };

  return {
    getState: () => state,
    restart: (newState: GameState) => {
      state = newState;
    },
    dispatch,
  };
}
