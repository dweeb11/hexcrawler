import { cubeCoord, type CubeCoord } from "../engine/hex";

export const HEX_SIZE = 34;

export function hexToPixel(coord: CubeCoord): { x: number; y: number } {
  return {
    x: HEX_SIZE * 1.5 * coord.q,
    y: HEX_SIZE * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r),
  };
}

export function pixelToHex(px: number, py: number): CubeCoord {
  const q = (2 / 3 * px) / HEX_SIZE;
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / HEX_SIZE;
  const s = -q - r;

  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  let roundedS = Math.round(s);

  const qDelta = Math.abs(roundedQ - q);
  const rDelta = Math.abs(roundedR - r);
  const sDelta = Math.abs(roundedS - s);

  if (qDelta > rDelta && qDelta > sDelta) {
    roundedQ = -roundedR - roundedS;
  } else if (rDelta > sDelta) {
    roundedR = -roundedQ - roundedS;
  } else {
    roundedS = -roundedQ - roundedR;
  }

  return cubeCoord(roundedQ, roundedR, roundedS);
}

export function drawHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.beginPath();

  for (let i = 0; i < 6; i += 1) {
    const angleDeg = 60 * i - 90; // Start at 30 degrees offset for side matching
    const angleRad = Math.PI / 180 * angleDeg;
    const x = cx + size * Math.cos(angleRad);
    const y = cy + size * Math.sin(angleRad);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
}

export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable.");
  }

  const resize = () => {
    const container = canvas.parentElement ?? document.body;
    const rect = container.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  };

  resize();
  window.addEventListener("resize", resize);
  return ctx;
}
