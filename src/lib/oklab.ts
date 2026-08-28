import { converter, formatHex } from "culori";
import type { Oklab } from "culori";

const toOklab = converter("oklab");
const toRgb = converter("rgb");

/** Max OKLab chroma plotted at the rim of the wheel. Comfortably covers the
 * sRGB gamut's most saturated colors (~0.32 peak chroma) with a little
 * headroom so vivid hues don't sit right at the edge. */
export const MAX_CHROMA = 0.33;

export function hexToOklab(hex: string): Oklab {
  const oklab = toOklab(hex);
  if (!oklab) throw new Error(`Invalid color: ${hex}`);
  return oklab;
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(hex.trim()) || /^#?[0-9a-f]{3}$/i.test(hex.trim());
}

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  return trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
}

/** sRGB-clamped hex for an OKLab coordinate, used to paint the wheel and to
 * commit a click/drag position picked on it. Chroma is reduced along the
 * same hue until the color is displayable, preserving lightness and hue. */
export function oklabToDisplayableHex(l: number, a: number, b: number): string {
  const chroma = Math.hypot(a, b);
  if (chroma === 0) return formatHex(toRgb({ mode: "oklab", l, a, b })) ?? "#000000";

  const hueX = a / chroma;
  const hueY = b / chroma;

  let lo = 0;
  let hi = chroma;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const rgb = toRgb({ mode: "oklab", l, a: hueX * mid, b: hueY * mid });
    const inGamut =
      rgb !== undefined && rgb.r >= -1e-4 && rgb.r <= 1 + 1e-4 && rgb.g >= -1e-4 && rgb.g <= 1 + 1e-4 && rgb.b >= -1e-4 && rgb.b <= 1 + 1e-4;
    if (inGamut) lo = mid;
    else hi = mid;
  }

  const rgb = toRgb({ mode: "oklab", l, a: hueX * lo, b: hueY * lo });
  return formatHex(rgb) ?? "#000000";
}

/** Pixel offset from the wheel's center for a given (a, b), scaled so
 * MAX_CHROMA lands on the rim. */
export function oklabToWheelOffset(a: number, b: number, radiusPx: number): { x: number; y: number } {
  return { x: (a / MAX_CHROMA) * radiusPx, y: (b / MAX_CHROMA) * radiusPx };
}

/** Inverse of oklabToWheelOffset: pixel offset from center -> OKLab (a, b). */
export function wheelOffsetToOklabAB(x: number, y: number, radiusPx: number): { a: number; b: number } {
  return { a: (x / radiusPx) * MAX_CHROMA, b: (y / radiusPx) * MAX_CHROMA };
}
