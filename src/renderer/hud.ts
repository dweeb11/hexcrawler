import type { GameState } from "../engine/state";
import { COLORS } from "./glyphs";

function bar(label: string, value: number, max: number): string {
  const filled = "█".repeat(Math.max(0, value));
  const empty = "░".repeat(Math.max(0, max - value));
  return `${label}: ${filled}${empty} ${value}/${max}`;
}

export function renderHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.panel;
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  ctx.fillRect(16, 16, 308, 120);
  ctx.strokeRect(16, 16, 308, 120);

  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "14px monospace";
  ctx.fillText(bar("Supply", state.player.supply, 10), 28, 28);
  ctx.fillText(bar("Hope", state.player.hope, 5), 28, 50);
  ctx.fillText(bar("Health", state.player.health, 5), 28, 72);
  ctx.fillText(`Turn: ${state.turn}`, 28, 98);

  const playerAxisValue = state.player.hex[state.searing.axis];
  const distance =
    state.searing.direction === 1
      ? playerAxisValue - state.searing.line
      : state.searing.line - playerAxisValue;
  const warning =
    distance <= 2
      ? "Searing close"
      : distance <= 4
        ? "Searing advancing"
        : "Searing distant";

  ctx.textAlign = "right";
  ctx.fillStyle = distance <= 2 ? COLORS.searing : COLORS.textDim;
  ctx.fillText(warning, width - 24, 28);
  ctx.restore();
}
