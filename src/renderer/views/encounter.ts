import { type GameState, type ResourceDelta } from "../../engine/state";
import { COLORS } from "../glyphs";
import { drawHintOverlay, type ActiveHint } from "../hint-overlay";
import { drawLegend } from "../legend";

function formatDelta(delta: ResourceDelta): string {
  const parts = Object.entries(delta)
    .filter(([, value]) => value)
    .map(([key, value]) => `${value && value > 0 ? "+" : ""}${value} ${key}`);
  return parts.length > 0 ? parts.join(", ") : "no change";
}

export function renderEncounter(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  activeHint: ActiveHint | null,
): void {
  if (state.mode.type !== "encounter") {
    return;
  }

  const mode = state.mode;
  const player = state.player;

  ctx.save();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "bold 28px monospace";
  ctx.fillText("Encounter", width / 2, 80);

  ctx.font = "18px monospace";
  wrapText(ctx, mode.encounter.text, width / 2, 150, width * 0.7, 28);

  ctx.font = "14px monospace";
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(
    `Supply ${player.supply}  Hope ${player.hope}  Health ${player.health}`,
    width / 2,
    260,
  );

  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  let y = 320;
  mode.encounter.choices.forEach((choice, index) => {
    const chanceLabel = choice.chance ? ` (${Math.round(choice.chance * 100)}%)` : "";
    const line = `${index + 1}. ${choice.label}${chanceLabel} -> ${formatDelta(choice.outcome)}`;
    wrapText(ctx, line, width * 0.18, y, width * 0.64, 24);
    y += 54;
  });

  drawLegend(ctx, width, "encounter");

  if (activeHint) {
    drawHintOverlay(ctx, activeHint, width, height);
  }

  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = nextLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, cursorY);
  }
}
