import { COLORS } from "../glyphs";
import type { GameState } from "../../engine/state";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function renderGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  if (state.mode.type !== "gameover") {
    ctx.restore();
    return;
  }

  const { reason, outcome } = state.mode;
  const isWin = outcome.startsWith("win");

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const cx = width / 2;
  let y = Math.round(height * 0.15);

  // Title
  ctx.font = "bold 32px monospace";
  ctx.fillStyle = isWin ? "#4ab88a" : COLORS.searing;
  ctx.fillText(isWin ? "Victory" : "Game Over", cx, y);
  y += 52;

  // Narrative reason
  ctx.font = "16px monospace";
  ctx.fillStyle = COLORS.text;
  const reasonLines = wrapText(ctx, reason, width - 120);
  for (const line of reasonLines) {
    ctx.fillText(line, cx, y);
    y += 24;
  }
  y += 32;

  // Stats
  const { stats } = state;
  const statLines = [
    `Turns survived:       ${state.turn}`,
    `Hexes explored:       ${stats.hexesExplored}`,
    `Encounters resolved:  ${stats.encountersResolved}`,
    `Rumors discovered:    ${stats.rumorsDiscovered}`,
    `Rumors completed:     ${stats.rumorsCompleted}`,
    `Relics collected:     ${stats.relicsCollected}`,
  ];
  ctx.font = "14px monospace";
  ctx.fillStyle = "#888888";
  for (const line of statLines) {
    ctx.fillText(line, cx, y);
    y += 22;
  }

  y += 28;
  ctx.fillStyle = "#555555";
  ctx.font = "14px monospace";
  ctx.fillText("Press Enter or tap to play again", cx, y);

  ctx.restore();
}
