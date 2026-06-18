import { SEARING_GRADIENT_GLYPHS } from "../engine/searing";
import { COLORS } from "./glyphs";

/** Matches proximity overlay and consumed glyph colors on the hex map. */
export function getSearingGlyphColor(intensity: number): string {
  if (intensity >= 1) {
    return COLORS.searing;
  }
  return `rgba(255, 80, 30, ${0.5 + intensity * 0.5})`;
}

export function getSearingGlyphColorForIndex(index: number): string {
  const intensity = Math.min(1, (index + 0.5) / SEARING_GRADIENT_GLYPHS.length);
  return getSearingGlyphColor(intensity);
}

export function getSearingEdgeArrowColor(alpha: number): string {
  return `rgba(255, 60, 20, ${alpha})`;
}
