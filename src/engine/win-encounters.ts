import type { Encounter, GameOverOutcome } from "./state";

export const PILLARS_ENCOUNTER_ID = "pillars-of-frost";
export const GEAR_RITUAL_ENCOUNTER_ID = "gear-ritual";

const PILLARS_WIN_REASON =
  "You stand before the Pillars of Frost, monuments to a world that was. The Searing is far behind. You are safe — for now.";
const GEAR_WIN_REASON =
  "The Gear turns. The mechanism groans to life. The sun shudders — and moves. You have restarted the world.";

export const PILLARS_WIN_ENCOUNTER: Encounter = {
  id: PILLARS_ENCOUNTER_ID,
  text: "Towering columns of ice rise from the earth, veined with light that predates the Searing. The cold here is absolute — and merciful.",
  requiredTags: [],
  choices: [{ label: "You made it.", outcome: {} }],
};

export const GEAR_RITUAL_ENCOUNTER: Encounter = {
  id: GEAR_RITUAL_ENCOUNTER_ID,
  text: "Your relics hum in resonance. The old mechanism stirs beneath the world — ready to turn, if you dare.",
  requiredTags: [],
  choices: [
    { label: "Perform the ritual.", outcome: {} },
    { label: "Not yet.", outcome: {} },
  ],
};

export type WinChoiceResolution =
  | { readonly type: "win"; readonly outcome: GameOverOutcome; readonly reason: string }
  | { readonly type: "decline" };

export function resolveSpecialWinChoice(
  encounterId: string,
  choiceIndex: number,
): WinChoiceResolution | null {
  if (encounterId === PILLARS_ENCOUNTER_ID) {
    return { type: "win", outcome: "win_pillars", reason: PILLARS_WIN_REASON };
  }

  if (encounterId === GEAR_RITUAL_ENCOUNTER_ID) {
    if (choiceIndex === 0) {
      return { type: "win", outcome: "win_gear", reason: GEAR_WIN_REASON };
    }
    return { type: "decline" };
  }

  return null;
}
