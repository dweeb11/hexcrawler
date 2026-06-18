import { SEARING_GRADIENT_GLYPHS } from "../engine/searing";
import { COLORS } from "./glyphs";
import {
  getSearingEdgeArrowColor,
  getSearingGlyphColorForIndex,
} from "./searing-style";

export type LegendMode = "map" | "encounter" | "camp" | "gameover";

type LegendLine =
  | { style: "header"; label: string }
  | { style: "normal"; label: string }
  | { style: "spacer" };

type LegendSegment = {
  text: string;
  color: string;
  font?: string;
};

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

function drawSegmentedLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  segments: readonly LegendSegment[],
): void {
  let cursor = x;
  for (const segment of segments) {
    ctx.fillStyle = segment.color;
    ctx.font = segment.font ?? "13px monospace";
    ctx.fillText(segment.text, cursor, y);
    cursor += ctx.measureText(segment.text).width;
  }
}

function drawSearingLegendLines(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  lineHeight: number,
): number {
  let y = startY;

  ctx.fillStyle = "#da4";
  ctx.font = "bold 11px monospace";
  ctx.fillText("SEARING", x, y + 12);
  y += lineHeight;

  const glyphSegments: LegendSegment[] = [];
  for (let index = 0; index < SEARING_GRADIENT_GLYPHS.length; index++) {
    const glyph = SEARING_GRADIENT_GLYPHS[index] ?? "█";
    const isConsumed = index === SEARING_GRADIENT_GLYPHS.length - 1;
    glyphSegments.push({
      text: glyph,
      color: getSearingGlyphColorForIndex(index),
      font: isConsumed ? "bold 18px monospace" : "bold 14px monospace",
    });
    if (index < SEARING_GRADIENT_GLYPHS.length - 1) {
      glyphSegments.push({ text: " ", color: COLORS.text });
    }
  }
  glyphSegments.push({ text: "  near → consumed", color: COLORS.textDim });
  drawSegmentedLine(ctx, x, y + 12, glyphSegments);
  y += lineHeight;

  drawSegmentedLine(ctx, x, y + 12, [
    { text: "◀", color: getSearingEdgeArrowColor(0.85), font: "bold 16px monospace" },
    { text: "  edge = threat direction", color: COLORS.textDim },
  ]);
  y += lineHeight;

  return y;
}

function drawMapLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  width: number,
  padding: number,
  lineHeight: number,
): void {
  const lines: LegendLine[] = [
    { label: "MOVEMENT", style: "header" },
    { label: "  Q W E ", style: "normal" },
    { label: "    @   ", style: "normal" },
    { label: "  A S D ", style: "normal" },
    { style: "spacer" },
    { label: "ACTIONS", style: "header" },
    { label: "R  Rest (+Health)", style: "normal" },
    { label: "F  Forage (+Supply)", style: "normal" },
    { label: "J  Journal", style: "normal" },
    { style: "spacer" },
  ];

  const searingLineCount = 3;
  const totalHeight = (lines.length + searingLineCount) * lineHeight + 8;
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

  drawSearingLegendLines(ctx, x, y, lineHeight);
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
