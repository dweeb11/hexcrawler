import { fetchEncounters } from "./api/encounters";
import { createAnalyticsClient } from "./api/analytics";
import { coordKey } from "./engine/hex";
import { ALL_RUMORS } from "./engine/data/rumors";
import { clearSave, hasSave, loadGame, saveGame } from "./ui/save";
import { pixelToHex, setupCanvas } from "./renderer/canvas";
import { createCamera } from "./renderer/camera";
import { render } from "./renderer/renderer";
import { createInitialState, MAX_SUPPLY, type Action, type GameState } from "./engine/state";
import { resolveTurn } from "./engine/turn";
import { screenToWorld } from "./renderer/camera";
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
import { clickedNeighborToAction, keyToAction } from "./ui/input";
import { toggleJournal, updateJournal, setJournalTab } from "./ui/journal";

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

function submitPlaytest(gameState: GameState, outcome: "won" | "lost"): void {
  const biomesVisited = [...new Set(
    [...gameState.map.values()]
      .filter((tile) => tile.visited)
      .map((tile) => tile.biome),
  )];
  const deathCause =
    outcome === "lost" && gameState.mode.type === "gameover"
      ? gameState.mode.reason
      : undefined;
  const rumorsCompleted = gameState.rumors.completed.length;

  fetch("/api/playtests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outcome,
      turnsSurvived: gameState.turn,
      deathCause,
      biomesVisited,
      rumorsCompleted,
    }),
  }).catch(() => { /* fire-and-forget; ignore network failures */ });
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
  let seed = Date.now();
  let rng = createRng(seed);
  let analytics = createAnalyticsClient();
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
        state = createInitialState(encounters, rng, ALL_RUMORS);
        analytics.track("game_start", { seed, fromSave: true });
      }
    } else {
      clearSave();
      state = createInitialState(encounters, rng, ALL_RUMORS);
      analytics.track("game_start", { seed, fromSave: true });
    }
  } else {
    state = createInitialState(encounters, rng, ALL_RUMORS);
    analytics.track("game_start", { seed, fromSave: false });
  }

  const restart = () => {
    seed = Date.now();
    rng = createRng(seed);
    analytics = createAnalyticsClient();
    state = createInitialState(encounters, rng, ALL_RUMORS);
    clearSave();
    clearLog(logPanel);
    analytics.track("game_start", { seed, restart: true });
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
    const previousRumorIds = new Set(previousState.rumors.active.map((rumor) => rumor.rumorId));
    const previousRelicIds = new Set(previousState.relics.map((relic) => relic.id));

    if (
      action.type === "push" &&
      coordKey(nextState.player.hex) !== coordKey(previousState.player.hex)
    ) {
      dismissHint("first-turn");
      playMove();
    }

    if (action.type === "choose" && previousState.mode.type === "encounter") {
      dismissHint("first-encounter");
      playChoiceSelect();
    }

    if (action.type === "pause" && action.activity === "forage") {
      dismissHint("low-supply");
      playForage();
    }

    if (action.type === "pause" && action.activity === "rest") {
      playRest();
    }

    if (
      nextState.mode.type === "encounter" &&
      previousState.mode.type !== "encounter"
    ) {
      playEncounterOpen();
      const encounterHex = nextState.map.get(coordKey(nextState.mode.hex));
      analytics.track("encounter", {
        turnCount: nextState.turn,
        encounterId: nextState.mode.encounter.id,
        biome: encounterHex?.biome ?? null,
      });
    }

    if (nextState.searing.line !== previousState.searing.line) {
      playSearingAdvance();
    }

    if (nextState.status === "won" && previousState.status !== "won") {
      playWin();
      submitPlaytest(nextState, "won");
      analytics.track("game_end", {
        outcome: "won",
        cause: "won",
        turnCount: nextState.turn,
      });
    }

    if (nextState.status === "lost" && previousState.status !== "lost") {
      playLoss();
      submitPlaytest(nextState, "lost");
      analytics.track("game_end", {
        outcome: "lost",
        cause: nextState.mode.type === "gameover" ? nextState.mode.reason : "unknown",
        turnCount: nextState.turn,
      });
    }

    if (nextState.turn > previousState.turn) {
      analytics.track("turn", {
        turnCount: nextState.turn,
        actionType: action.type,
      });
    }

    for (const rumor of nextState.rumors.active) {
      if (!previousRumorIds.has(rumor.rumorId)) {
        analytics.track("rumor", {
          rumorId: rumor.rumorId,
          turnCount: nextState.turn,
        });
      }
    }

    for (const relic of nextState.relics) {
      if (!previousRelicIds.has(relic.id)) {
        analytics.track("relic", {
          relicId: relic.id,
          turnCount: nextState.turn,
        });
      }
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
    applyHopeStyling(logPanel, state.player.hope);
    window.requestAnimationFrame(frame);
  };

  document.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    const normalizedKey = event.key.toLowerCase();

    if (state.mode.type === "gameover" && event.key === "Enter") {
      restart();
      return;
    }

    if (normalizedKey === "j" && state.status === "playing") {
      event.preventDefault();
      toggleJournal(journalPanel, logPanel);
      updateJournal(journalContent, state);
      return;
    }

    if (!journalPanel.classList.contains("hidden")) {
      return;
    }

    const action = keyToAction(event.key, state.mode);
    if (action) {
      applyAction(action);
    }
  });

  journalTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      journalTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const tabName = tab.getAttribute("data-tab");
      if (tabName === "rumors" || tabName === "relics") {
        setJournalTab(tabName);
        updateJournal(journalContent, state);
      }
    });
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

    if (state.mode.type === "gameover") {
      restart();
      return;
    }

    if (state.mode.type === "camp") {
      applyAction({ type: "dismiss" });
      return;
    }

    if (state.mode.type === "encounter") {
      // Encounter choices are drawn at y=320 with 54px spacing in canvas CSS coordinates
      const CHOICE_START_Y = 320;
      const CHOICE_HEIGHT = 54;
      const choiceIndex = Math.floor((y - CHOICE_START_Y) / CHOICE_HEIGHT);
      if (choiceIndex >= 0 && choiceIndex < state.mode.encounter.choices.length) {
        applyAction({ type: "choose", choiceIndex });
      }
      return;
    }

    if (state.mode.type === "map") {
      const world = screenToWorld(camera, x, y);
      const clicked = pixelToHex(world.x, world.y);
      const action = clickedNeighborToAction(state.player.hex, clicked);
      if (action) {
        applyAction(action);
      }
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
