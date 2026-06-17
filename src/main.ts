import { fetchEncounters } from "./api/encounters";
import { fetchRumors } from "./api/rumors";
import { createAnalyticsClient } from "./api/analytics";
import { submitPlaytest } from "./api/playtests";
import { createRng } from "./engine/rng";
import { clearSave, hasSave, loadGame, saveGame } from "./ui/save";
import { pixelToHex, setupCanvas } from "./renderer/canvas";
import { createCamera, screenToWorld, type Camera } from "./renderer/camera";
import { hitTestEncounterChoice } from "./renderer/encounter-layout";
import { render } from "./renderer/renderer";
import { createInitialState, MAX_SUPPLY, type Action, type GameState } from "./engine/state";
import { createGameSession, type GameSession, type GameSessionDeps } from "./game-session";
import { getActiveHint, type HintId } from "./ui/hints";
import { applyHopeStyling, clearLog, updateLog } from "./ui/log";
import {
  playMove,
  playEncounterOpen,
  playChoiceSelect,
  playSearingAdvance,
  playForage,
  playRest,
  playWin,
  playLoss,
} from "./ui/audio";
import { clickedNeighborToAction, resolveKeydown } from "./ui/input";
import {
  toggleJournal,
  updateJournal,
  setJournalTab,
  closeJournal,
  isJournalOpen,
} from "./ui/journal";

const HINTS_KEY = "waning-light-hints";
const VALID_HINT_IDS: HintId[] = ["first-turn", "low-supply", "first-encounter", "first-rumor"];

function loadDismissedHints(): Set<HintId> {
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is HintId => VALID_HINT_IDS.includes(v as HintId)));
  } catch {
    return new Set();
  }
}

function saveDismissedHints(hints: Set<HintId>): void {
  localStorage.setItem(HINTS_KEY, JSON.stringify([...hints]));
}

type CanvasTouchResult = Action | "restart";

function canvasTouchToAction(
  state: GameState,
  x: number,
  y: number,
  camera: Camera,
): CanvasTouchResult | null {
  switch (state.mode.type) {
    case "gameover":
      return "restart";
    case "camp":
      return { type: "dismiss" };
    case "encounter": {
      const choiceIndex = hitTestEncounterChoice(
        y,
        state.mode.encounter.choices.length,
        state.mode.rumorContext != null,
      );
      if (choiceIndex === null) {
        return null;
      }
      return { type: "choose", choiceIndex };
    }
    case "map": {
      const world = screenToWorld(camera, x, y);
      const clicked = pixelToHex(world.x, world.y);
      return clickedNeighborToAction(state.player.hex, clicked);
    }
    default: {
      const _exhaustive: never = state.mode;
      return _exhaustive;
    }
  }
}

async function main(): Promise<void> {
  const canvas = document.getElementById("game-canvas");
  const logPanel = document.getElementById("log-panel");
  const journalPanel = document.getElementById("journal-panel");
  const journalContent = document.getElementById("journal-content");
  const journalTabs = document.querySelectorAll(".journal-tab");

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(logPanel instanceof HTMLElement) ||
    !(journalPanel instanceof HTMLElement) ||
    !(journalContent instanceof HTMLElement)
  ) {
    throw new Error("Missing required app elements.");
  }

  const ctx = setupCanvas(canvas);
  const encounters = await fetchEncounters();
  const rumors = await fetchRumors();
  let seed = Date.now();
  let camera = createCamera();
  const dismissedHints = loadDismissedHints();

  const dismissHint = (id: HintId): void => {
    if (!dismissedHints.has(id)) {
      dismissedHints.add(id);
      saveDismissedHints(dismissedHints);
    }
  };

  const persistState = (nextState: GameState) => {
    if (nextState.status === "playing") {
      saveGame(nextState);
    } else {
      clearSave();
    }
  };

  const deps: GameSessionDeps = {
    rng: createRng(seed),
    analytics: createAnalyticsClient(),
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
    dismissHint,
    persistState,
    submitPlaytest,
  };

  let initialState: GameState;
  if (hasSave()) {
    const saved = loadGame();
    if (saved && saved.status === "playing") {
      const shouldContinue = await showContinuePrompt(canvas, ctx);
      if (shouldContinue) {
        initialState = saved;
      } else {
        clearSave();
        initialState = createInitialState(encounters, deps.rng, rumors);
        deps.analytics.track("game_start", { seed, fromSave: true });
      }
    } else {
      clearSave();
      initialState = createInitialState(encounters, deps.rng, rumors);
      deps.analytics.track("game_start", { seed, fromSave: true });
    }
  } else {
    initialState = createInitialState(encounters, deps.rng, rumors);
    deps.analytics.track("game_start", { seed, fromSave: false });
  }

  let session: GameSession = createGameSession(initialState, deps);

  const restart = () => {
    seed = Date.now();
    deps.rng = createRng(seed);
    deps.analytics = createAnalyticsClient();
    session.restart(createInitialState(encounters, deps.rng, rumors));
    clearSave();
    clearLog(logPanel);
    deps.analytics.track("game_start", { seed, restart: true });
  };

  const frame = () => {
    const state = session.getState();
    const activeHint = getActiveHint(
      {
        turn: state.turn,
        supply: state.player.supply,
        maxSupply: MAX_SUPPLY,
        mode: state.mode.type,
        rumorProgressCount: state.rumors.active.length + state.rumors.completed.length,
      },
      dismissedHints,
    );
    camera = render(ctx, state, camera, activeHint);
    updateLog(logPanel, state.log);
    applyHopeStyling(logPanel, state.player.hope);
    window.requestAnimationFrame(frame);
  };

  document.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    const state = session.getState();
    if (state.mode.type === "gameover" && event.key === "Enter") {
      restart();
      return;
    }

    const journalOpen = isJournalOpen(journalPanel);
    const result = resolveKeydown(event.key, state.mode, state.status, journalOpen);

    switch (result.type) {
      case "toggle-journal": {
        event.preventDefault();
        const opening = !journalOpen;
        if (opening) {
          dismissHint("first-rumor");
        }
        toggleJournal(journalPanel, logPanel);
        if (opening) {
          updateJournal(journalContent, state);
        }
        return;
      }
      case "game-action":
        if (result.closeJournalFirst) {
          closeJournal(journalPanel, logPanel);
        }
        session.dispatch(result.action);
        return;
      case "none":
        return;
      default: {
        const _exhaustive: never = result;
        return _exhaustive;
      }
    }
  });

  journalTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      journalTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const tabName = tab.getAttribute("data-tab");
      if (tabName === "rumors" || tabName === "relics") {
        setJournalTab(tabName);
        updateJournal(journalContent, session.getState());
      }
    });
  });

  canvas.addEventListener("click", (event) => {
    const state = session.getState();
    if (state.mode.type !== "map") {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const world = screenToWorld(camera, screen.x, screen.y);
    const clicked = pixelToHex(world.x, world.y);
    const action = clickedNeighborToAction(state.player.hex, clicked);
    if (action) {
      session.dispatch(action);
    }
  });

  // Touch input for mobile
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener("touchstart", (event) => {
    event.preventDefault();
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: false });

  canvas.addEventListener("touchend", (event) => {
    event.preventDefault();
    const touch = event.changedTouches[0];

    // Ignore swipes — only handle taps (< 10px movement)
    if (Math.abs(touch.clientX - touchStartX) > 10 || Math.abs(touch.clientY - touchStartY) > 10) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const state = session.getState();
    const result = canvasTouchToAction(state, x, y, camera);
    if (result === "restart") {
      restart();
      return;
    }
    if (result) {
      session.dispatch(result);
    }
  }, { passive: false });

  window.requestAnimationFrame(frame);
}

function showContinuePrompt(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Promise<boolean> {
  return new Promise((resolve) => {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;

    ctx.save();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#c0c0c0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "24px monospace";
    ctx.fillText("Saved game found", width / 2, height / 2 - 40);
    ctx.font = "16px monospace";
    ctx.fillText(
      "Press C to Continue  |  Press N for New Game",
      width / 2,
      height / 2 + 20,
    );
    ctx.font = "13px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(
      "Tap right to Continue  |  Tap left for New Game",
      width / 2,
      height / 2 + 52,
    );
    ctx.restore();

    const cleanup = (result: boolean) => {
      document.removeEventListener("keydown", handler);
      canvas.removeEventListener("touchend", touchHandler);
      resolve(result);
    };

    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "c" || key === "n") {
        cleanup(key === "c");
      }
    };

    const touchHandler = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      cleanup(x > rect.width / 2);
    };

    document.addEventListener("keydown", handler);
    canvas.addEventListener("touchend", touchHandler, { passive: false });
  });
}

void main();
