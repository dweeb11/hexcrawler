import type { HintId } from "../ui/hints";

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

export interface HintDismissals {
  dismissed: ReadonlySet<HintId>;
  dismiss(id: HintId): void;
}

export function createHintDismissals(): HintDismissals {
  const dismissed = loadDismissedHints();

  return {
    dismissed,
    dismiss(id: HintId): void {
      if (!dismissed.has(id)) {
        (dismissed as Set<HintId>).add(id);
        saveDismissedHints(dismissed as Set<HintId>);
      }
    },
  };
}
