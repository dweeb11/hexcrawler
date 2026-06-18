import type { Action, GameState } from "../engine/state";
import { pixelToHex } from "../renderer/canvas";
import type { Camera } from "../renderer/camera";
import { screenToWorld } from "../renderer/camera";
import { hitTestEncounterChoice } from "../renderer/encounter-layout";
import { clickedNeighborToAction } from "./input";

export type CanvasTouchResult = Action | "restart";

export function canvasTouchToAction(
  state: GameState,
  x: number,
  y: number,
  camera: Camera,
): CanvasTouchResult | null {
  switch (state.mode.type) {
    case "gameover":
      return "restart";
    case "camp":
      return { type: "dismiss" };
    case "encounter": {
      const choiceIndex = hitTestEncounterChoice(
        y,
        state.mode.encounter.choices.length,
        state.mode.rumorContext != null,
      );
      if (choiceIndex === null) {
        return null;
      }
      return { type: "choose", choiceIndex };
    }
    case "pendingEncounter":
      return null;
    case "map": {
      const world = screenToWorld(camera, x, y);
      const clicked = pixelToHex(world.x, world.y);
      return clickedNeighborToAction(state, clicked);
    }
    default: {
      const _exhaustive: never = state.mode;
      return _exhaustive;
    }
  }
}
