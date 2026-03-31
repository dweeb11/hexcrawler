import {
  MAX_HEALTH,
  MAX_HOPE,
  MAX_SUPPLY,
  type GameState,
} from "../engine/state";
import { COLORS } from "./glyphs";

function resourceColor(current: number, max: number): string {
  const ratio = current / max;
  if (ratio > 0.6) {
    return "#4a9";
  }
  if (ratio > 0.3) {
    return "#da4";
  }
  return "#d44";
}

function drawResourceBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  icon: string,
  label: string,
  current: number,
  max: number,
): void {
  const color = resourceColor(current, max);
  const barWidth = 100;
  const barHeight = 12;
  const fillWidth = (Math.max(0, current) / max) * barWidth;

  ctx.fillStyle = color;
  ctx.font = "14px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`${icon} ${label}`, x, y);

  ctx.fillStyle = "#333";
  ctx.fillRect(x + 110, y - 10, barWidth, barHeight);

  ctx.fillStyle = color;
  ctx.fillRect(x + 110, y - 10, fillWidth, barHeight);

  ctx.fillStyle = "#c0c0c0";
  ctx.fillText(`${current}/${max}`, x + 220, y);
}

function searingDistance(state: GameState): number {
  const playerAxisValue = state.player.hex[state.searing.axis];
  if (state.searing.direction === 1) {
    return playerAxisValue - state.searing.line;
  }

  return state.searing.line - playerAxisValue;
}

export function renderHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  _width: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.panel;
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  ctx.fillRect(16, 16, 320, 138);
  ctx.strokeRect(16, 16, 320, 138);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  drawResourceBar(ctx, 28, 34, "◆", "Supply", state.player.supply, MAX_SUPPLY);
  drawResourceBar(ctx, 28, 58, "✦", "Hope", state.player.hope, MAX_HOPE);
  drawResourceBar(ctx, 28, 82, "♥", "Health", state.player.health, MAX_HEALTH);

  ctx.fillStyle = COLORS.text;
  ctx.font = "14px monospace";
  ctx.fillText(`Turn: ${state.turn}`, 28, 108);

  const distance = searingDistance(state);
  if (distance <= 5) {
    ctx.fillStyle = distance <= 2 ? "#d44" : "#da4";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`⚠ SEARING: ${distance} hex${distance === 1 ? "" : "es"}`, 28, 128);
  }

  ctx.restore();
}
