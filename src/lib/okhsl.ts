import { converter, formatHex } from "culori";
import type { Okhsl } from "culori";

// Okhsl color-picker circle, per Björn Ottosson's design
// (https://bottosson.github.io/posts/colorpicker/): hue is the angle,
// saturation is the radius, both at a fixed lightness. Because Okhsl's s
// is defined as a fraction of the sRGB gamut boundary at that hue and
// lightness, s=1 always lands exactly on the gamut edge - the wheel is a
// perfect circle with no clamping or gamut search needed, unlike a raw
// OKLab a/b plot.

const toOkhsl = converter("okhsl");
const toRgb = converter("rgb");

export interface HueSat {
  h: number;
  s: number;
}

export function hexToOkhsl(hex: string): Okhsl {
  const okhsl = toOkhsl(hex);
  if (!okhsl) throw new Error(`Invalid color: ${hex}`);
  return okhsl;
}

export function okhslToHex(h: number, s: number, l: number): string {
  return formatHex({ mode: "okhsl", h, s, l }) ?? "#000000";
}

/** RGB in [0, 1] per channel; always in-gamut for h in any range, s and l
 * in [0, 1]. */
export function okhslToRgb01(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const rgb = toRgb({ mode: "okhsl", h, s, l });
  return {
    r: Math.max(0, Math.min(1, rgb?.r ?? 0)),
    g: Math.max(0, Math.min(1, rgb?.g ?? 0)),
    b: Math.max(0, Math.min(1, rgb?.b ?? 0)),
  };
}

/** Pixel offset from the wheel's center for a hue/saturation pair. Hue 0
 * points straight up, increasing clockwise (matching the polygon swatch's
 * vertex layout). */
export function hueSatToWheelOffset(h: number, s: number, radiusPx: number): { x: number; y: number } {
  const angle = (h * Math.PI) / 180 - Math.PI / 2;
  const r = s * radiusPx;
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

/** Inverse of hueSatToWheelOffset: pixel offset from center -> hue/saturation. */
export function wheelOffsetToHueSat(x: number, y: number, radiusPx: number): HueSat {
  const dist = Math.hypot(x, y);
  const s = radiusPx > 0 ? Math.min(dist / radiusPx, 1) : 0;
  const angle = Math.atan2(y, x);
  const h = (((angle + Math.PI / 2) * 180) / Math.PI + 360) % 360;
  return { h, s };
}
