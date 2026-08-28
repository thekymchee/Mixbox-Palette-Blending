import { converter, formatHex } from "culori";
import type { Oklab } from "culori";

// A Cartesian OKLab a/b scatter plane, in the style of artistpigments.org's
// color-plane charts (https://artistpigments.org): unlike the Okhsl circle,
// points are plotted at their true OKLab chroma rather than normalized to
// the gamut boundary, so pigments spread out by real perceptual distance
// instead of clustering at a wheel's rim.

const toOklab = converter("oklab");
const toRgb = converter("rgb");

export function hexToOklab(hex: string): Oklab {
  const oklab = toOklab(hex);
  if (!oklab) throw new Error(`Invalid color: ${hex}`);
  return oklab;
}

function isDisplayable(rgb: { r: number; g: number; b: number } | undefined): rgb is { r: number; g: number; b: number } {
  return (
    rgb !== undefined &&
    rgb.r >= -1e-3 &&
    rgb.r <= 1 + 1e-3 &&
    rgb.g >= -1e-3 &&
    rgb.g <= 1 + 1e-3 &&
    rgb.b >= -1e-3 &&
    rgb.b <= 1 + 1e-3
  );
}

export function isInGamut(l: number, a: number, b: number): boolean {
  return isDisplayable(toRgb({ mode: "oklab", l, a, b }));
}

export function oklabToRgb01(l: number, a: number, b: number): { r: number; g: number; b: number } | null {
  const rgb = toRgb({ mode: "oklab", l, a, b });
  if (!isDisplayable(rgb)) return null;
  return {
    r: Math.max(0, Math.min(1, rgb.r)),
    g: Math.max(0, Math.min(1, rgb.g)),
    b: Math.max(0, Math.min(1, rgb.b)),
  };
}

/** Nearest in-gamut color along the ray from the achromatic axis through
 * (a, b), at the given lightness - used to pick a color from a click that
 * landed outside the visible sRGB gamut. */
export function clampToGamutHex(l: number, a: number, b: number): string {
  const chroma = Math.hypot(a, b);
  if (chroma === 0) return formatHex({ mode: "oklab", l, a: 0, b: 0 }) ?? "#000000";

  const ux = a / chroma;
  const uy = b / chroma;

  let lo = 0;
  let hi = chroma;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut(l, ux * mid, uy * mid)) lo = mid;
    else hi = mid;
  }

  return formatHex({ mode: "oklab", l, a: ux * lo, b: uy * lo }) ?? "#000000";
}

/** Pixel offset from the plane's center for an (a, b) pair, given the
 * domain's half-extent (the a/b value that lands exactly on the plot's
 * edge). Positive b (yellow) points up on screen, positive a (red)
 * points right - flipping the y axis to match how these planes are
 * conventionally drawn. */
export function oklabToPlaneOffset(a: number, b: number, halfExtent: number, radiusPx: number): { x: number; y: number } {
  return { x: (a / halfExtent) * radiusPx, y: -(b / halfExtent) * radiusPx };
}

export function planeOffsetToOklabAB(x: number, y: number, halfExtent: number, radiusPx: number): { a: number; b: number } {
  return { a: (x / radiusPx) * halfExtent, b: -(y / radiusPx) * halfExtent };
}
