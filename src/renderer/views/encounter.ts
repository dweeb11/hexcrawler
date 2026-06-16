import { encounterChoiceY, encounterLayout } from "../encounter-layout";
import { type GameState, type ResourceDelta } from "../../engine/state";
import { encounterHasDiscoveryChoice } from "../../engine/rumors";
import { COLORS } from "../glyphs";
import { drawHintOverlay, type ActiveHint } from "../hint-overlay";
import { drawLegend } from "../legend";

const RUMOR_COLOR = "#da4";

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
  const rumorContext = mode.rumorContext;
  const isDiscoveryLead =
    !rumorContext && encounterHasDiscoveryChoice(mode.encounter);

  ctx.save();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  if (rumorContext) {
    ctx.strokeStyle = RUMOR_COLOR;
    ctx.lineWidth = 1;
    ctx.font = "16px monospace";
    ctx.fillStyle = RUMOR_COLOR;
    ctx.textAlign = "center";
    ctx.fillText("─ ═ ─", width / 2, 52);
  }

  ctx.fillStyle = rumorContext || isDiscoveryLead ? RUMOR_COLOR : COLORS.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "bold 28px monospace";

  if (rumorContext) {
    ctx.fillText(`Rumor — ${rumorContext.rumorTitle}`, width / 2, 80);
    ctx.font = "16px monospace";
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(
      `Part ${rumorContext.stepIndex + 1} of ${rumorContext.stepCount}`,
      width / 2,
      118,
    );
  } else if (isDiscoveryLead) {
    ctx.fillText("A Lead Surfaces", width / 2, 80);
  } else {
    ctx.fillText("Encounter", width / 2, 80);
  }

  ctx.font = "18px monospace";
  ctx.fillStyle = COLORS.text;
  const layout = encounterLayout(rumorContext != null);
  wrapText(ctx, mode.encounter.text, width / 2, layout.textY, width * 0.7, 28);

  ctx.font = "14px monospace";
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(
    `Supply ${player.supply}  Hope ${player.hope}  Health ${player.health}`,
    width / 2,
    layout.statsY,
  );

  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  const hasRumorContext = rumorContext != null;
  mode.encounter.choices.forEach((choice, index) => {
    const chanceLabel = choice.chance ? ` (${Math.round(choice.chance * 100)}%)` : "";
    const leadLabel = choice.discoversRumor ? "  [reveals a lead]" : "";
    const line = `${index + 1}. ${choice.label}${chanceLabel} -> ${formatDelta(choice.outcome)}${leadLabel}`;
    wrapText(ctx, line, width * 0.18, encounterChoiceY(index, hasRumorContext), width * 0.64, 24);
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
