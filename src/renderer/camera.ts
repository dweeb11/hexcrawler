import type { CubeCoord } from "../engine/hex";
import { hexToPixel } from "./canvas";

export interface Camera {
  readonly offsetX: number;
  readonly offsetY: number;
}

export function createCamera(): Camera {
  return { offsetX: 0, offsetY: 0 };
}

export function centerOnHex(
  camera: Camera,
  coord: CubeCoord,
  canvasWidth: number,
  canvasHeight: number,
): Camera {
  const world = hexToPixel(coord);
  return {
    ...camera,
    offsetX: canvasWidth / 2 - world.x,
    offsetY: canvasHeight / 2 - world.y,
  };
}

export function worldToScreen(camera: Camera, x: number, y: number): { x: number; y: number } {
  return {
    x: x + camera.offsetX,
    y: y + camera.offsetY,
  };
}

export function screenToWorld(camera: Camera, x: number, y: number): { x: number; y: number } {
  return {
    x: x - camera.offsetX,
    y: y - camera.offsetY,
  };
}
