import { converter } from "culori";

const toOkhsl = converter("okhsl");
const toOklch = converter("oklch");

/** Lightness (Okhsl l, 0-100) for a hex color, or null if the hex is
 * invalid. Uses Okhsl rather than raw OKLab so it matches the "l" shown
 * elsewhere (the circle/plane's geometric-center info). */
export function hexLightnessPercent(hex: string): number | null {
  const okhsl = toOkhsl(hex);
  if (!okhsl) return null;
  return Math.round(okhsl.l * 100);
}

export interface OklchSummary {
  l: number;
  c: number;
  h: number;
}

/** OKLCH lightness/chroma/hue for an sRGB color, given as [r, g, b] in
 * 0-255. Hue is 0 when chroma is 0 (achromatic). */
export function rgbToOklch([r, g, b]: [number, number, number]): OklchSummary {
  const oklch = toOklch({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return { l: oklch?.l ?? 0, c: oklch?.c ?? 0, h: oklch?.h ?? 0 };
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(hex.trim()) || /^#?[0-9a-f]{3}$/i.test(hex.trim());
}

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  return trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
}
