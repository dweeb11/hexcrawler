export const ENCOUNTER_CHOICE_HEIGHT = 54;

const ENCOUNTER_LAYOUT = {
  normal: { textY: 150, statsY: 260, choiceStartY: 320 },
  rumor: { textY: 160, statsY: 270, choiceStartY: 330 },
} as const;

export type EncounterLayout = (typeof ENCOUNTER_LAYOUT)[keyof typeof ENCOUNTER_LAYOUT];

export function encounterLayout(hasRumorContext: boolean): EncounterLayout {
  return hasRumorContext ? ENCOUNTER_LAYOUT.rumor : ENCOUNTER_LAYOUT.normal;
}

export function encounterChoiceY(choiceIndex: number, hasRumorContext: boolean): number {
  const layout = encounterLayout(hasRumorContext);
  return layout.choiceStartY + choiceIndex * ENCOUNTER_CHOICE_HEIGHT;
}

export function hitTestEncounterChoice(
  y: number,
  choiceCount: number,
  hasRumorContext: boolean,
): number | null {
  const choiceIndex = Math.floor(
    (y - encounterLayout(hasRumorContext).choiceStartY) / ENCOUNTER_CHOICE_HEIGHT,
  );
  if (choiceIndex >= 0 && choiceIndex < choiceCount) {
    return choiceIndex;
  }
  return null;
}
