import type { GameState } from "../engine/state";
import { centerOnHex, type Camera } from "./camera";
import { COLORS } from "./glyphs";
import { renderCamp } from "./views/camp";
import { renderEncounter } from "./views/encounter";
import { renderGameOver } from "./views/gameover";
import { renderMap } from "./views/map";

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  activeHint: { id: string; text: string } | null,
): Camera {
  const ratio = window.devicePixelRatio || 1;
  const width = ctx.canvas.width / ratio;
  const height = ctx.canvas.height / ratio;
  const centeredCamera = centerOnHex(camera, state.player.hex, width, height);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  switch (state.mode.type) {
    case "map":
      renderMap(ctx, state, centeredCamera, width, height, activeHint);
      break;
    case "encounter":
      renderEncounter(ctx, state, width, height, activeHint);
      break;
    case "camp":
      renderCamp(ctx, state.mode, width, height);
      break;
    case "gameover":
      renderGameOver(ctx, state, width, height);
      break;
  }

  return centeredCamera;
}
