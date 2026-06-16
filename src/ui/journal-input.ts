import type { Action, GameMode, GameState } from "../engine/state";
import { keyToAction } from "./input";

export type JournalKeydownResult =
  | { type: "none" }
  | { type: "toggle-journal" }
  | { type: "close-journal" }
  | { type: "game-action"; action: Action };

export function resolveJournalKeydown(
  key: string,
  mode: GameMode,
  status: GameState["status"],
  journalOpen: boolean,
): JournalKeydownResult {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "j" && (status === "playing" || journalOpen)) {
    return { type: "toggle-journal" };
  }

  if (journalOpen) {
    if (normalizedKey === "escape") {
      return { type: "close-journal" };
    }

    const action = keyToAction(key, mode);
    if (action) {
      return { type: "game-action", action };
    }

    return { type: "none" };
  }

  const action = keyToAction(key, mode);
  if (action) {
    return { type: "game-action", action };
  }

  return { type: "none" };
}
