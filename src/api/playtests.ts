import type { GameState } from "../engine/state";

const PLAYTESTS_ENDPOINT = "/api/playtests";

export interface PlaytestPayload {
  outcome: "won" | "lost";
  turnsSurvived: number;
  deathCause?: string;
  biomesVisited: string[];
  rumorsCompleted: number;
}

export function buildPlaytestPayload(
  gameState: GameState,
  outcome: "won" | "lost",
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
  const rumorsCompleted = gameState.rumors.completed.length;

  return {
    outcome,
    turnsSurvived: gameState.turn,
    deathCause,
    biomesVisited,
    rumorsCompleted,
  };
}

export function submitPlaytest(
  gameState: GameState,
  outcome: "won" | "lost",
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
