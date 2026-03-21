import { fetchEncounters } from "./api/encounters";
import { pixelToHex, setupCanvas } from "./renderer/canvas";
import { createCamera } from "./renderer/camera";
import { render } from "./renderer/renderer";
import { createInitialState, type GameState } from "./engine/state";
import { resolveTurn } from "./engine/turn";
import { screenToWorld } from "./renderer/camera";
import { clearLog, updateLog } from "./ui/log";
import { clickedNeighborToAction, keyToAction } from "./ui/input";

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
  let state: GameState = createInitialState(encounters, rng);
  let camera = createCamera();

  const restart = () => {
    seed = Date.now();
    rng = createRng(seed);
    state = createInitialState(encounters, rng);
    clearLog(logPanel);
  };

  const frame = () => {
    camera = render(ctx, state, camera);
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
      state = resolveTurn(state, action, rng);
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
      state = resolveTurn(state, action, rng);
    }
  });

  window.requestAnimationFrame(frame);
}

void main();
