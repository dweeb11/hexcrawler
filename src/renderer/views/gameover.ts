import { COLORS } from "../glyphs";
import { drawLegend } from "../legend";

export function renderGameOver(
  ctx: CanvasRenderingContext2D,
  reason: string,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.searing;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "bold 36px monospace";
  ctx.fillText("Game Over", width / 2, 120);

  ctx.fillStyle = COLORS.text;
  ctx.font = "18px monospace";
  ctx.fillText(reason, width / 2, 220);

  drawLegend(ctx, width, height, "gameover");
  ctx.restore();
}
