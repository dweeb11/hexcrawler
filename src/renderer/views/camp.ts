import type { GameMode } from "../../engine/state";
import { COLORS } from "../glyphs";

export function renderCamp(
  ctx: CanvasRenderingContext2D,
  mode: Extract<GameMode, { type: "camp" }>,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "bold 28px monospace";
  ctx.fillText("Camp", width / 2, 110);

  ctx.font = "18px monospace";
  ctx.fillText(mode.result.text, width / 2, 210);
  if (mode.incident) {
    ctx.fillStyle = COLORS.encounter;
    ctx.fillText(mode.incident.text, width / 2, 260);
  }

  ctx.fillStyle = COLORS.textDim;
  ctx.font = "14px monospace";
  ctx.fillText("Press any mapped key to continue.", width / 2, height - 80);
  ctx.restore();
}
