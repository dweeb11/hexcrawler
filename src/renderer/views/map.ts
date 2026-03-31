import { coordKey } from "../../engine/hex";
import { getVisibleNeighbors } from "../../engine/map";
import { type GameState, type HexTile } from "../../engine/state";
import { drawHexagon, hexToPixel, HEX_SIZE } from "../canvas";
import type { Camera } from "../camera";
import { worldToScreen } from "../camera";
import { COLORS, BIOME_GLYPHS } from "../glyphs";
import { renderHud } from "../hud";
import { drawLegend } from "../legend";

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: HexTile,
  camera: Camera,
  screenWidth: number,
  screenHeight: number,
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
  ctx.fillStyle = tile.consumed ? COLORS.consumed : COLORS.fog;
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
  activeHint: { id: string; text: string } | null,
): void {
  for (const tile of state.map.values()) {
    drawTile(ctx, tile, camera, width, height);
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

  renderHud(ctx, state, width);
  drawLegend(ctx, width, height, "map");

  if (activeHint) {
    ctx.save();
    ctx.font = "13px monospace";
    const hintWidth = ctx.measureText(activeHint.text).width + 40;
    const hintX = (width - hintWidth) / 2;
    const hintY = height - 50;
    ctx.fillStyle = "rgba(40, 40, 20, 0.9)";
    ctx.fillRect(hintX, hintY, hintWidth, 30);
    ctx.strokeStyle = "#da4";
    ctx.strokeRect(hintX, hintY, hintWidth, 30);
    ctx.fillStyle = "#da4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(activeHint.text, width / 2, hintY + 16);
    ctx.restore();
  }
}
