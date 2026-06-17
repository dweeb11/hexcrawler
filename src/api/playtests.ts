import { coordKey } from "../engine/hex";
import type { GameState } from "../engine/state";

const PLAYTESTS_ENDPOINT = "/api/playtests";

export type PlaytestOutcome = "won" | "lost";

export interface PlaytestPayload {
  outcome: PlaytestOutcome;
  turnsSurvived: number;
  deathCause?: string;
  biomesVisited: string[];
  rumorsCompleted: number;
}

export function buildPlaytestPayload(
  gameState: GameState,
  outcome: PlaytestOutcome,
): PlaytestPayload {
  const biomesVisited = [
    ...new Set(
      [...gameState.map.values()]
        .filter((tile) => tile.visited)
        .map((tile) => tile.biome),
    ),
  ];
  const deathCause =
    outcome === "lost" && gameState.mode.type === "gameover"
      ? gameState.mode.reason
      : undefined;

  return {
    outcome,
    turnsSurvived: gameState.turn,
    deathCause,
    biomesVisited,
    rumorsCompleted: gameState.rumors.completed.length,
  };
}

export function submitPlaytest(
  gameState: GameState,
  outcome: PlaytestOutcome,
  fetchFn: typeof fetch = fetch,
): void {
  const payload = buildPlaytestPayload(gameState, outcome);

  fetchFn(PLAYTESTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Fire-and-forget; ignore network failures.
  });
}
