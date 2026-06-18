import { coordKey } from "../../engine/hex";
import { getVisibleNeighbors } from "../../engine/visibility";
import {
  getSearingGlyph,
  getSearingIntensity,
  searingDistance,
} from "../../engine/searing";
import { getEffectiveCaps } from "../../engine/relics";
import { type GameState, type HexTile, type SearingState } from "../../engine/state";
import { drawHexagon, hexToPixel, HEX_SIZE } from "../canvas";
import type { Camera } from "../camera";
import { worldToScreen } from "../camera";
import { COLORS, BIOME_GLYPHS } from "../glyphs";
import { renderHud } from "../hud";
import { drawHintOverlay, type ActiveHint } from "../hint-overlay";
import { drawLegend } from "../legend";

function lowHopeThreshold(relics: GameState["relics"]): number {
  return Math.floor(getEffectiveCaps(relics).hope * 0.4);
}

function drawConsumedGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  shimmerPhase: number,
): void {
  const grad = ctx.createRadialGradient(x, y - radius * 0.3, 0, x, y, radius);
  const coreAlpha = 0.85 + Math.sin(shimmerPhase) * 0.15;
  grad.addColorStop(0, `rgba(200, 60, 10, ${coreAlpha})`);
  grad.addColorStop(0.6, "rgba(120, 20, 5, 0.9)");
  grad.addColorStop(1, "rgba(32, 7, 8, 1)");
  ctx.fillStyle = grad;
}

function drawProximityHeat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  intensity: number,
  shimmerPhase: number,
): void {
  const pulse = 0.85 + Math.sin(shimmerPhase) * 0.15;
  const alpha = intensity * 0.55 * pulse;
  const grad = ctx.createRadialGradient(x, y + radius * 0.2, 0, x, y, radius);
  grad.addColorStop(0, `rgba(220, 80, 20, ${alpha})`);
  grad.addColorStop(0.7, `rgba(160, 40, 10, ${alpha * 0.7})`);
  grad.addColorStop(1, `rgba(80, 15, 5, ${alpha * 0.3})`);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: HexTile,
  searing: SearingState,
  camera: Camera,
  screenWidth: number,
  screenHeight: number,
  shimmerPhase: number,
): void {
  const world = hexToPixel(tile.coord);
  const screen = worldToScreen(camera, world.x, world.y);
  if (
    screen.x < -HEX_SIZE * 2 ||
    screen.x > screenWidth + HEX_SIZE * 2 ||
    screen.y < -HEX_SIZE * 2 ||
    screen.y > screenHeight + HEX_SIZE * 2
  ) {
    return;
  }

  const intensity = getSearingIntensity(tile.coord, searing);
  const searingGlyph = getSearingGlyph(intensity);

  ctx.save();
  ctx.globalAlpha = tile.visited ? 1 : 0.4;
  drawHexagon(ctx, screen.x, screen.y, HEX_SIZE - 1);
  if (tile.consumed) {
    drawConsumedGradient(ctx, screen.x, screen.y, HEX_SIZE - 1, shimmerPhase);
    ctx.fill();
  } else {
    ctx.fillStyle = COLORS.fog;
    ctx.fill();
    if (intensity > 0) {
      drawProximityHeat(ctx, screen.x, screen.y, HEX_SIZE - 1, intensity, shimmerPhase);
    }
  }

  if (tile.consumed) {
    ctx.strokeStyle = COLORS.consumedEdge;
  } else if (intensity > 0) {
    const edgeAlpha = 0.5 + intensity * 0.5;
    ctx.strokeStyle = `rgba(200, 50, 20, ${edgeAlpha})`;
    ctx.lineWidth = 1.25 + intensity * 0.75;
  } else {
    ctx.strokeStyle = COLORS.biome[tile.biome];
    ctx.lineWidth = 1.25;
  }
  ctx.stroke();

  if (tile.consumed) {
    ctx.fillStyle = COLORS.searing;
    ctx.font = "bold 18px monospace";
    ctx.fillText(searingGlyph || "█", screen.x, screen.y - 4);
  } else {
    ctx.fillStyle = COLORS.biome[tile.biome];
    ctx.font = "bold 18px monospace";
    ctx.fillText(BIOME_GLYPHS[tile.biome], screen.x, screen.y - 4);
    if (searingGlyph) {
      ctx.fillStyle = `rgba(255, 80, 30, ${0.5 + intensity * 0.5})`;
      ctx.font = "bold 14px monospace";
      ctx.fillText(searingGlyph, screen.x, screen.y + 12);
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSearingEdgeGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  distance: number,
  pulsePhase: number,
): void {
  if (distance > 5) {
    return;
  }
  const baseIntensity = (5 - distance) / 5;
  const pulse = 0.5 + Math.sin(pulsePhase) * 0.5;
  const alpha = baseIntensity * (0.15 + pulse * 0.25);

  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.3,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.85,
  );
  grad.addColorStop(0, "rgba(180, 20, 0, 0)");
  grad.addColorStop(1, `rgba(200, 30, 0, ${alpha})`);

  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawFogTile(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  coord: { q: number; r: number; s: number },
  searing: SearingState,
  shimmerPhase: number,
): void {
  const intensity = getSearingIntensity(coord, searing);
  const searingGlyph = getSearingGlyph(intensity);
  const world = hexToPixel(coord);
  const screen = worldToScreen(camera, world.x, world.y);

  ctx.save();
  drawHexagon(ctx, screen.x, screen.y, HEX_SIZE - 3);
  if (intensity > 0) {
    ctx.fillStyle = `rgba(40, 10, 5, ${intensity * 0.5})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(200, 50, 20, ${0.4 + intensity * 0.5})`;
    ctx.lineWidth = 1 + intensity;
  } else {
    ctx.strokeStyle = COLORS.fogEdge;
    ctx.lineWidth = 1;
  }
  ctx.stroke();

  if (searingGlyph) {
    const pulse = 0.75 + Math.sin(shimmerPhase) * 0.25;
    ctx.fillStyle = `rgba(255, 80, 30, ${intensity * pulse})`;
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(searingGlyph, screen.x, screen.y);
  }
  ctx.restore();
}

export function renderMap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  width: number,
  height: number,
  activeHint: ActiveHint | null,
): void {
  const now = Date.now();
  const shimmerPhase = (now / 800) % (Math.PI * 2);
  const pulsePhase = (now / 600) % (Math.PI * 2);

  const { hope } = state.player;
  const hopeThreshold = lowHopeThreshold(state.relics);
  if (hope <= hopeThreshold) {
    const saturation = Math.round((hope / hopeThreshold) * 80);
    ctx.filter = `saturate(${saturation}%)`;
  }

  for (const tile of state.map.values()) {
    drawTile(ctx, tile, state.searing, camera, width, height, shimmerPhase);
  }

  const fogCoords = getVisibleNeighbors(
    state.player.hex,
    state.player.hope,
    state.searing.axis,
    state.searing.direction,
  );
  for (const coord of fogCoords) {
    if (!state.map.has(coordKey(coord))) {
      drawFogTile(ctx, camera, coord, state.searing, shimmerPhase);
    }
  }

  const playerWorld = hexToPixel(state.player.hex);
  const playerScreen = worldToScreen(camera, playerWorld.x, playerWorld.y);
  ctx.save();
  ctx.fillStyle = COLORS.player;
  ctx.font = "bold 24px monospace";
  ctx.fillText("@", playerScreen.x, playerScreen.y);
  ctx.restore();

  ctx.filter = "none";
  const distance = searingDistance(state.player.hex, state.searing);
  drawSearingEdgeGlow(ctx, width, height, distance, pulsePhase);

  renderHud(ctx, state, width);
  drawLegend(ctx, width, "map");

  if (activeHint) {
    drawHintOverlay(ctx, activeHint, width, height);
  }
}
