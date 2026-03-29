import { deserializeState, serializeState, type GameState } from "../engine/state";

export const SAVE_KEY = "waning-light-save";

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame(state: GameState): void {
  const serialized = serializeState(state);
  localStorage.setItem(SAVE_KEY, JSON.stringify(serialized));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return deserializeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
