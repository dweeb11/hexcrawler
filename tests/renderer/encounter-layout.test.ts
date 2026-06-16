import { describe, expect, it } from "vitest";
import {
  encounterChoiceY,
  encounterLayout,
  hitTestEncounterChoice,
} from "../../src/renderer/encounter-layout";

describe("encounter layout", () => {
  it("offsets rumor layout 10px lower than normal", () => {
    expect(encounterLayout(false)).toEqual({ textY: 150, statsY: 260, choiceStartY: 320 });
    expect(encounterLayout(true)).toEqual({ textY: 160, statsY: 270, choiceStartY: 330 });
  });

  it("spaces choices 54px apart", () => {
    expect(encounterChoiceY(0, false)).toBe(320);
    expect(encounterChoiceY(1, false)).toBe(374);
    expect(encounterChoiceY(2, true)).toBe(438);
  });

  it("hit-tests normal encounters from choiceStartY", () => {
    expect(hitTestEncounterChoice(320, 3, false)).toBe(0);
    expect(hitTestEncounterChoice(373, 3, false)).toBe(0);
    expect(hitTestEncounterChoice(374, 3, false)).toBe(1);
  });

  it("hit-tests rumor encounters from rumor choiceStartY", () => {
    expect(hitTestEncounterChoice(320, 3, true)).toBe(null);
    expect(hitTestEncounterChoice(330, 3, true)).toBe(0);
    expect(hitTestEncounterChoice(383, 3, true)).toBe(0);
    expect(hitTestEncounterChoice(384, 3, true)).toBe(1);
  });

  it("returns null outside choice bounds", () => {
    expect(hitTestEncounterChoice(100, 2, false)).toBe(null);
    expect(hitTestEncounterChoice(500, 2, false)).toBe(null);
  });
});
