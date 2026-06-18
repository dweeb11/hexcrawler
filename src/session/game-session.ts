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

export interface TransitionDeps {
  getAnalytics(): AnalyticsClient;
  audio: GameSessionAudio;
  hints: GameSessionHints;
  playtest: GameSessionPlaytest;
}

export type TransitionHandler = (
  prev: GameState,
  next: GameState,
  action: Action,
  deps: TransitionDeps,
) => void;

/** Movement: successful push plays audio and dismisses the first-turn hint. */
export function handleMovementTransitions(
  prev: GameState,
  next: GameState,
  action: Action,
  deps: TransitionDeps,
): void {
  if (
    action.type === "push" &&
    coordKey(next.player.hex) !== coordKey(prev.player.hex)
  ) {
    deps.hints.dismissHint("first-turn");
    deps.audio.playMove();
  }
}

/** Encounter: choice audio/hint dismiss; encounter-open analytics on mode entry. */
export function handleEncounterTransitions(
  prev: GameState,
  next: GameState,
  action: Action,
  deps: TransitionDeps,
): void {
  if (action.type === "choose" && prev.mode.type === "encounter") {
    deps.hints.dismissHint("first-encounter");
    deps.audio.playChoiceSelect();
  }

  if (next.mode.type === "encounter" && prev.mode.type !== "encounter") {
    deps.audio.playEncounterOpen();
    const encounterHex = next.map.get(coordKey(next.mode.hex));
    deps.getAnalytics().track("encounter", {
      turnCount: next.turn,
      encounterId: next.mode.encounter.id,
      biome: encounterHex?.biome ?? null,
    });
  }
}

/** Camp: forage/rest audio and hint dismiss. dismiss exits camp with no transition side effects. */
export function handleCampTransitions(
  _prev: GameState,
  _next: GameState,
  action: Action,
  deps: TransitionDeps,
): void {
  if (action.type === "pause" && action.activity === "forage") {
    deps.hints.dismissHint("low-supply");
    deps.audio.playForage();
  }

  if (action.type === "pause" && action.activity === "rest") {
    deps.audio.playRest();
  }
}

/** Searing: line advance audio when the frontier moves. */
export function handleSearingTransitions(
  prev: GameState,
  next: GameState,
  _action: Action,
  deps: TransitionDeps,
): void {
  if (next.searing.line !== prev.searing.line) {
    deps.audio.playSearingAdvance();
  }
}

/** Game end: win/loss audio, playtest submit, and game_end analytics. */
export function handleGameEndTransitions(
  prev: GameState,
  next: GameState,
  _action: Action,
  deps: TransitionDeps,
): void {
  if (next.status === "won" && prev.status !== "won") {
    deps.audio.playWin();
    deps.playtest.submit(next, "won");
    deps.getAnalytics().track("game_end", {
      outcome: "won",
      cause: "won",
      turnCount: next.turn,
    });
  }

  if (next.status === "lost" && prev.status !== "lost") {
    deps.audio.playLoss();
    deps.playtest.submit(next, "lost");
    deps.getAnalytics().track("game_end", {
      outcome: "lost",
      cause: next.mode.type === "gameover" ? next.mode.reason : "unknown",
      turnCount: next.turn,
    });
  }
}

/**
 * Progression: turn analytics and rumor/relic discovery analytics.
 *
 * Turn analytics fire only when `next.turn > prev.turn`. The engine does not
 * increment turn for `choose` or `dismiss` (see engine/turn.ts), so those
 * actions never emit turn analytics — by design, not omission.
 */
export function handleProgressionTransitions(
  prev: GameState,
  next: GameState,
  action: Action,
  deps: TransitionDeps,
): void {
  if (next.turn > prev.turn) {
    deps.getAnalytics().track("turn", {
      turnCount: next.turn,
      actionType: action.type,
    });
  }

  const previousRumorIds = new Set(prev.rumors.active.map((rumor) => rumor.rumorId));
  for (const rumor of next.rumors.active) {
    if (!previousRumorIds.has(rumor.rumorId)) {
      deps.getAnalytics().track("rumor", {
        rumorId: rumor.rumorId,
        turnCount: next.turn,
      });
      const progressCount =
        next.rumors.active.length + next.rumors.completed.length;
      if (progressCount > 1) {
        deps.hints.dismissHint("first-rumor");
      }
    }
  }

  const previousRelicIds = new Set(prev.relics.map((relic) => relic.id));
  for (const relic of next.relics) {
    if (!previousRelicIds.has(relic.id)) {
      deps.getAnalytics().track("relic", {
        relicId: relic.id,
        turnCount: next.turn,
      });
    }
  }
}

/**
 * Ordered transition handlers — order preserves current player-visible behavior.
 * Encounter runs before camp because no single action triggers both; grouping
 * choose + encounter-open keeps related side effects together.
 */
export const TRANSITION_HANDLERS: TransitionHandler[] = [
  handleMovementTransitions,
  handleEncounterTransitions,
  handleCampTransitions,
  handleSearingTransitions,
  handleGameEndTransitions,
  handleProgressionTransitions,
];

export function runTransitionHandlers(
  prev: GameState,
  next: GameState,
  action: Action,
  deps: TransitionDeps,
): void {
  for (const handler of TRANSITION_HANDLERS) {
    handler(prev, next, action, deps);
  }
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

  const transitionDeps = (): TransitionDeps => ({
    getAnalytics: () => deps.getAnalytics(),
    audio: deps.audio,
    hints: deps.hints,
    playtest: deps.playtest,
  });

  const persistState = (nextState: GameState) => {
    if (nextState.status === "playing") {
      deps.persistence.save(nextState);
    } else {
      deps.persistence.clear();
    }
  };

  const dispatch = (action: Action): GameState => {
    const prev = state;
    const next = resolveTurn(prev, action, deps.getRng());
    runTransitionHandlers(prev, next, action, transitionDeps());
    state = next;
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
