export type ActiveHint = { id: string; text: string };

export function drawHintOverlay(
  ctx: CanvasRenderingContext2D,
  hint: ActiveHint,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.font = "13px monospace";
  const hintWidth = ctx.measureText(hint.text).width + 40;
  const hintX = (width - hintWidth) / 2;
  const hintY = height - 50;
  ctx.fillStyle = "rgba(40, 40, 20, 0.9)";
  ctx.fillRect(hintX, hintY, hintWidth, 30);
  ctx.strokeStyle = "#da4";
  ctx.strokeRect(hintX, hintY, hintWidth, 30);
  ctx.fillStyle = "#da4";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hint.text, width / 2, hintY + 16);
  ctx.restore();
}
