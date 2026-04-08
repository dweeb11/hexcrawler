import { coordKey } from "../../engine/hex";
import { getVisibleNeighbors } from "../../engine/map";
import { type GameState, type HexTile } from "../../engine/state";
import { drawHexagon, hexToPixel, HEX_SIZE } from "../canvas";
import type { Camera } from "../camera";
import { worldToScreen } from "../camera";
import { COLORS, BIOME_GLYPHS } from "../glyphs";
import { renderHud } from "../hud";
import { drawHintOverlay, type ActiveHint } from "../hint-overlay";
import { drawLegend } from "../legend";

function searingDistance(state: GameState): number {
  const playerAxisValue = state.player.hex[state.searing.axis];
  if (state.searing.direction === 1) {
    return playerAxisValue - state.searing.line;
  }
  return state.searing.line - playerAxisValue;
}

function drawConsumedGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  shimmerPhase: number,
): void {
  const grad = ctx.createRadialGradient(x, y - radius * 0.3, 0, x, y, radius);
  // Shimmer cycles between hot orange core and deep red rim
  const coreAlpha = 0.85 + Math.sin(shimmerPhase) * 0.15;
  grad.addColorStop(0, `rgba(200, 60, 10, ${coreAlpha})`);
  grad.addColorStop(0.6, "rgba(120, 20, 5, 0.9)");
  grad.addColorStop(1, "rgba(32, 7, 8, 1)");
  ctx.fillStyle = grad;
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: HexTile,
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

  ctx.save();
  ctx.globalAlpha = tile.visited ? 1 : 0.4;
  drawHexagon(ctx, screen.x, screen.y, HEX_SIZE - 1);
  if (tile.consumed) {
    drawConsumedGradient(ctx, screen.x, screen.y, HEX_SIZE - 1, shimmerPhase);
  } else {
    ctx.fillStyle = COLORS.fog;
  }
  ctx.fill();
  ctx.strokeStyle = tile.consumed ? COLORS.consumedEdge : COLORS.biome[tile.biome];
  ctx.lineWidth = 1.25;
  ctx.stroke();

  ctx.fillStyle = tile.consumed ? COLORS.searing : COLORS.biome[tile.biome];
  ctx.font = "bold 18px monospace";
  ctx.fillText(BIOME_GLYPHS[tile.biome], screen.x, screen.y - 4);
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
  // Only show within 5 hexes; intensity increases as distance decreases
  if (distance > 5) return;
  const baseIntensity = (5 - distance) / 5;
  const pulse = 0.5 + Math.sin(pulsePhase) * 0.5;
  const alpha = baseIntensity * (0.15 + pulse * 0.25);

  const grad = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.85,
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
): void {
  const world = hexToPixel(coord);
  const screen = worldToScreen(camera, world.x, world.y);
  ctx.save();
  drawHexagon(ctx, screen.x, screen.y, HEX_SIZE - 3);
  ctx.strokeStyle = COLORS.fogEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
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

  for (const tile of state.map.values()) {
    drawTile(ctx, tile, camera, width, height, shimmerPhase);
  }

  const fogCoords = getVisibleNeighbors(
    state.player.hex,
    state.player.hope,
    state.searing.axis,
    state.searing.direction,
  );
  for (const coord of fogCoords) {
    if (!state.map.has(coordKey(coord))) {
      drawFogTile(ctx, camera, coord);
    }
  }

  const playerWorld = hexToPixel(state.player.hex);
  const playerScreen = worldToScreen(camera, playerWorld.x, playerWorld.y);
  ctx.save();
  ctx.fillStyle = COLORS.player;
  ctx.font = "bold 24px monospace";
  ctx.fillText("@", playerScreen.x, playerScreen.y);
  ctx.restore();

  drawSearingEdgeGlow(ctx, width, height, searingDistance(state), pulsePhase);

  renderHud(ctx, state, width);
  drawLegend(ctx, width, "map");

  if (activeHint) {
    drawHintOverlay(ctx, activeHint, width, height);
  }
}
