export type HintId = "first-turn" | "low-supply" | "first-encounter";

const HINT_TEXTS: Record<HintId, string> = {
  "first-turn": "QWEASD to move  |  R to rest  |  F to forage",
  "first-encounter": "Press 1, 2, or 3 to choose",
  "low-supply": "Supplies are low - press F to forage",
};

export function getActiveHint(
  context: {
    turn: number;
    supply: number;
    maxSupply: number;
    mode: string;
  },
  dismissedHints: ReadonlySet<HintId>,
): { id: HintId; text: string } | null {
  if (context.turn === 0 && !dismissedHints.has("first-turn")) {
    return { id: "first-turn", text: HINT_TEXTS["first-turn"] };
  }

  if (context.mode === "encounter" && !dismissedHints.has("first-encounter")) {
    return { id: "first-encounter", text: HINT_TEXTS["first-encounter"] };
  }

  if (
    context.supply <= 1 &&
    context.supply < context.maxSupply &&
    !dismissedHints.has("low-supply")
  ) {
    return { id: "low-supply", text: HINT_TEXTS["low-supply"] };
  }

  return null;
}
