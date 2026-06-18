import { createAnalyticsClient } from "../api/analytics";
import { submitPlaytest } from "../api/playtests";
import { createRng } from "../engine/rng";
import type { RNG } from "../engine/state";
import {
  playMove,
  playEncounterOpen,
  playChoiceSelect,
  playSearingAdvance,
  playForage,
  playRest,
  playWin,
  playLoss,
} from "../ui/audio";
import { clearSave, saveGame } from "../ui/save";
import type { GameSessionDeps } from "./game-session";
import { createHintDismissals } from "./hint-dismissals";

export interface SessionRuntime {
  getRng(): RNG;
  getAnalytics(): ReturnType<typeof createAnalyticsClient>;
  getSeed(): number;
  reset(): number;
}

export interface AssembledSessionDeps extends GameSessionDeps {
  runtime: SessionRuntime;
  getDismissedHints(): ReadonlySet<import("../ui/hints").HintId>;
}

export function assembleSessionDeps(): AssembledSessionDeps {
  const hintDismissals = createHintDismissals();
  let seed = Date.now();
  let rng = createRng(seed);
  let analytics = createAnalyticsClient();

  const runtime: SessionRuntime = {
    getRng: () => rng,
    getAnalytics: () => analytics,
    getSeed: () => seed,
    reset: () => {
      seed = Date.now();
      rng = createRng(seed);
      analytics = createAnalyticsClient();
      return seed;
    },
  };

  return {
    runtime,
    getRng: () => runtime.getRng(),
    getAnalytics: () => runtime.getAnalytics(),
    getDismissedHints: () => hintDismissals.dismissed,
    audio: {
      playMove,
      playEncounterOpen,
      playChoiceSelect,
      playSearingAdvance,
      playForage,
      playRest,
      playWin,
      playLoss,
    },
    hints: { dismissHint: (id) => hintDismissals.dismiss(id) },
    persistence: { save: saveGame, clear: clearSave },
    playtest: { submit: submitPlaytest },
  };
}
