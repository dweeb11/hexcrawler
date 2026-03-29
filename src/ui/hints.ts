const HINTS_KEY = "waning-light-hints";

export type HintId = "first-turn" | "low-supply" | "first-encounter" | "first-rumor";

interface HintState {
  dismissed: HintId[];
}

function loadHintState(): HintState {
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    if (!raw) {
      return { dismissed: [] };
    }

    const parsed = JSON.parse(raw) as Partial<HintState>;
    const dismissed = Array.isArray(parsed.dismissed)
      ? parsed.dismissed.filter(
          (value): value is HintId =>
            value === "first-turn" ||
            value === "low-supply" ||
            value === "first-encounter" ||
            value === "first-rumor",
        )
      : [];
    return { dismissed };
  } catch {
    return { dismissed: [] };
  }
}

function saveHintState(state: HintState): void {
  localStorage.setItem(HINTS_KEY, JSON.stringify(state));
}

export function isHintDismissed(id: HintId): boolean {
  return loadHintState().dismissed.includes(id);
}

export function dismissHint(id: HintId): void {
  const state = loadHintState();
  if (!state.dismissed.includes(id)) {
    state.dismissed.push(id);
    saveHintState(state);
  }
}

export function getActiveHint(context: {
  turn: number;
  supply: number;
  maxSupply: number;
  mode: string;
}): { id: HintId; text: string } | null {
  if (context.turn === 0 && !isHintDismissed("first-turn")) {
    return { id: "first-turn", text: "QWEASD to move  |  R to rest  |  F to forage" };
  }

  if (context.mode === "encounter" && !isHintDismissed("first-encounter")) {
    return { id: "first-encounter", text: "Press 1, 2, or 3 to choose" };
  }

  if (
    context.supply <= 1 &&
    context.supply < context.maxSupply &&
    !isHintDismissed("low-supply")
  ) {
    return { id: "low-supply", text: "Supplies are low - press F to forage" };
  }

  return null;
}
