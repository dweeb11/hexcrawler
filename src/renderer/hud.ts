import { getEffectiveCaps } from "../engine/relics";
import {
  getSearingTowardConsumedDelta,
  searingDistance,
} from "../engine/searing";
import { addCoords, scaleCoord } from "../engine/hex";
import { type GameState } from "../engine/state";
import { hexToPixel } from "./canvas";
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

const COMPASS_ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"] as const;

function searingCompassArrow(state: GameState): string {
  const towardConsumed = getSearingTowardConsumedDelta(state.searing);
  const reference = addCoords(state.player.hex, scaleCoord(towardConsumed, 4));
  const playerPixel = hexToPixel(state.player.hex);
  const refPixel = hexToPixel(reference);
  const angle = Math.atan2(refPixel.y - playerPixel.y, refPixel.x - playerPixel.x);
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.round(normalized / (Math.PI / 4)) % COMPASS_ARROWS.length;
  return COMPASS_ARROWS[index] ?? "←";
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
  const caps = getEffectiveCaps(state.relics);
  drawResourceBar(ctx, 28, 34, "◆", "Supply", state.player.supply, caps.supply);
  drawResourceBar(ctx, 28, 58, "✦", "Hope", state.player.hope, caps.hope);
  drawResourceBar(ctx, 28, 82, "♥", "Health", state.player.health, caps.health);

  ctx.fillStyle = COLORS.text;
  ctx.font = "14px monospace";
  ctx.fillText(`Turn: ${state.turn}`, 28, 108);

  const activeLeadCount = state.rumors.active.length;
  if (activeLeadCount > 0) {
    ctx.fillStyle = "#da4";
    ctx.font = "14px monospace";
    const label = activeLeadCount === 1 ? "1 active lead" : `${activeLeadCount} active leads`;
    ctx.fillText(`◆ ${label}`, 170, 108);
  }

  const distance = searingDistance(state.player.hex, state.searing);
  const arrow = searingCompassArrow(state);
  const hexLabel = distance === 1 ? "hex" : "hexes";
  if (distance <= 5) {
    ctx.fillStyle = distance <= 2 ? "#d44" : "#da4";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`⚠ SEARING ${arrow} ${distance} ${hexLabel}`, 28, 128);
  } else {
    ctx.fillStyle = "#a85";
    ctx.font = "14px monospace";
    ctx.fillText(`☀ Searing ${arrow} ${distance} ${hexLabel}`, 28, 128);
  }

  ctx.restore();
}
