import { COLORS } from "./glyphs";

export type LegendMode = "map" | "encounter" | "camp" | "gameover";

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number,
): void {
  ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
  ctx.fillRect(x - padding, y - padding, width + padding * 2, height + padding * 2);
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(x - padding, y - padding, width + padding * 2, height + padding * 2);
}

function drawMapLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  width: number,
  padding: number,
  lineHeight: number,
): void {
  const lines = [
    { label: "MOVEMENT", style: "header" as const },
    { label: "  Q   W", style: "normal" as const },
    { label: "A   @   E", style: "normal" as const },
    { label: "  S   D", style: "normal" as const },
    { label: "", style: "spacer" as const },
    { label: "ACTIONS", style: "header" as const },
    { label: "R  Rest (+Health)", style: "normal" as const },
    { label: "F  Forage (+Supply)", style: "normal" as const },
    { label: "J  Journal", style: "normal" as const },
  ];

  const totalHeight = lines.length * lineHeight + 8;
  drawPanel(ctx, x, startY, width, totalHeight, padding);

  let y = startY;
  for (const line of lines) {
    if (line.style === "header") {
      ctx.fillStyle = "#888";
      ctx.font = "bold 11px monospace";
      ctx.fillText(line.label, x, y + 12);
    } else if (line.style === "normal") {
      ctx.fillStyle = COLORS.text;
      ctx.font = "13px monospace";
      ctx.fillText(line.label, x, y + 12);
    }
    y += lineHeight;
  }
}

function drawEncounterLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  width: number,
  padding: number,
  lineHeight: number,
): void {
  const totalHeight = 2 * lineHeight + 8;
  drawPanel(ctx, x, startY, width, totalHeight, padding);

  ctx.fillStyle = "#888";
  ctx.font = "bold 11px monospace";
  ctx.fillText("CHOICES", x, startY + 12);
  ctx.fillStyle = COLORS.text;
  ctx.font = "13px monospace";
  ctx.fillText("1-9  Select choice", x, startY + lineHeight + 12);
}

function drawCampLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  width: number,
  padding: number,
  lineHeight: number,
): void {
  const totalHeight = 2 * lineHeight + 8;
  drawPanel(ctx, x, startY, width, totalHeight, padding);

  ctx.fillStyle = "#888";
  ctx.font = "bold 11px monospace";
  ctx.fillText("CAMP", x, startY + 12);
  ctx.fillStyle = COLORS.text;
  ctx.font = "13px monospace";
  ctx.fillText("Any key  Continue", x, startY + lineHeight + 12);
}

function drawGameOverLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  width: number,
  padding: number,
  lineHeight: number,
): void {
  const totalHeight = 2 * lineHeight + 8;
  drawPanel(ctx, x, startY, width, totalHeight, padding);

  ctx.fillStyle = "#888";
  ctx.font = "bold 11px monospace";
  ctx.fillText("RESTART", x, startY + 12);
  ctx.fillStyle = COLORS.text;
  ctx.font = "13px monospace";
  ctx.fillText("Enter  New Game", x, startY + lineHeight + 12);
}

export function drawLegend(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  _canvasHeight: number,
  mode: LegendMode,
): void {
  const padding = 12;
  const lineHeight = 18;
  const legendWidth = 190;
  const x = canvasWidth - legendWidth - padding;
  const y = padding;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  if (mode === "map") {
    drawMapLegend(ctx, x, y, legendWidth, padding, lineHeight);
  } else if (mode === "encounter") {
    drawEncounterLegend(ctx, x, y, legendWidth, padding, lineHeight);
  } else if (mode === "camp") {
    drawCampLegend(ctx, x, y, legendWidth, padding, lineHeight);
  } else {
    drawGameOverLegend(ctx, x, y, legendWidth, padding, lineHeight);
  }

  ctx.restore();
}
