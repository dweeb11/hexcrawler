import { fetchEncounters } from "./api/encounters";
import { coordKey } from "./engine/hex";
import { clearSave, hasSave, loadGame, saveGame } from "./ui/save";
import { pixelToHex, setupCanvas } from "./renderer/canvas";
import { createCamera } from "./renderer/camera";
import { render } from "./renderer/renderer";
import { createInitialState, MAX_SUPPLY, type Action, type GameState } from "./engine/state";
import { resolveTurn } from "./engine/turn";
import { screenToWorld } from "./renderer/camera";
import { getActiveHint, type HintId } from "./ui/hints";
import { clearLog, updateLog } from "./ui/log";
import { clickedNeighborToAction, keyToAction } from "./ui/input";

const HINTS_KEY = "waning-light-hints";
const VALID_HINT_IDS: HintId[] = ["first-turn", "low-supply", "first-encounter"];

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

function createRng(seed: number): () => number {
  let current = seed % 2147483647;
  if (current <= 0) {
    current += 2147483646;
  }

  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
}

async function main(): Promise<void> {
  const canvas = document.getElementById("game-canvas");
  const logPanel = document.getElementById("log-panel");
  if (!(canvas instanceof HTMLCanvasElement) || !(logPanel instanceof HTMLElement)) {
    throw new Error("Missing required app elements.");
  }

  const ctx = setupCanvas(canvas);
  const encounters = await fetchEncounters();
  let seed = Date.now();
  let rng = createRng(seed);
  let state: GameState;
  let camera = createCamera();
  const dismissedHints = loadDismissedHints();

  const dismissHint = (id: HintId): void => {
    if (!dismissedHints.has(id)) {
      dismissedHints.add(id);
      saveDismissedHints(dismissedHints);
    }
  };

  if (hasSave()) {
    const saved = loadGame();
    if (saved && saved.status === "playing") {
      const shouldContinue = await showContinuePrompt(canvas, ctx);
      if (shouldContinue) {
        state = saved;
      } else {
        clearSave();
        state = createInitialState(encounters, rng);
      }
    } else {
      clearSave();
      state = createInitialState(encounters, rng);
    }
  } else {
    state = createInitialState(encounters, rng);
  }

  const restart = () => {
    seed = Date.now();
    rng = createRng(seed);
    state = createInitialState(encounters, rng);
    clearSave();
    clearLog(logPanel);
  };

  const persistState = (nextState: GameState) => {
    if (nextState.status === "playing") {
      saveGame(nextState);
    } else {
      clearSave();
    }
  };

  const applyAction = (action: Action) => {
    const previousState = state;
    const nextState = resolveTurn(previousState, action, rng);

    if (
      action.type === "push" &&
      coordKey(nextState.player.hex) !== coordKey(previousState.player.hex)
    ) {
      dismissHint("first-turn");
    }

    if (action.type === "choose" && previousState.mode.type === "encounter") {
      dismissHint("first-encounter");
    }

    if (action.type === "pause" && action.activity === "forage") {
      dismissHint("low-supply");
    }

    state = nextState;
    persistState(state);
  };

  const frame = () => {
    const activeHint = getActiveHint(
      { turn: state.turn, supply: state.player.supply, maxSupply: MAX_SUPPLY, mode: state.mode.type },
      dismissedHints,
    );
    camera = render(ctx, state, camera, activeHint);
    updateLog(logPanel, state.log);
    window.requestAnimationFrame(frame);
  };

  document.addEventListener("keydown", (event) => {
    if (state.mode.type === "gameover" && event.key === "Enter") {
      restart();
      return;
    }

    const action = keyToAction(event.key, state.mode);
    if (action) {
      applyAction(action);
    }
  });

  canvas.addEventListener("click", (event) => {
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
      applyAction(action);
    }
  });

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
    ctx.restore();

    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "c" || key === "n") {
        document.removeEventListener("keydown", handler);
        resolve(key === "c");
      }
    };
    document.addEventListener("keydown", handler);
  });
}

void main();
