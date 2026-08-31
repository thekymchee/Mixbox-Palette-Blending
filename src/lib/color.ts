import { converter } from "culori";

const toOkhsl = converter("okhsl");
const toOklch = converter("oklch");
const toOklab = converter("oklab");

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

/** OKLab a/b for an sRGB color, given as [r, g, b] in 0-255. Used to
 * compare a mixed swatch's actual hue/chroma against a target position
 * (e.g. the color wheel/plane's geometric-center point) without lightness
 * - which the wheel's slider sets independently of any real pigment
 * mix's lightness - skewing the comparison. */
export function rgbToOklabAB([r, g, b]: [number, number, number]): { a: number; b: number } {
  const oklab = toOklab({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return { a: oklab?.a ?? 0, b: oklab?.b ?? 0 };
}

/** Plain average of several hex colors' OKLab a/b - the same "geometric
 * center" the OKLab plane plots, computed once so other views (like the
 * blended swatch) can target the same point without depending on the
 * plane component being mounted. */
export function colorsCentroidAB(hexColors: string[]): { a: number; b: number } | null {
  let sumA = 0;
  let sumB = 0;
  let count = 0;
  for (const hex of hexColors) {
    const oklab = toOklab(hex);
    if (!oklab) continue;
    sumA += oklab.a;
    sumB += oklab.b;
    count++;
  }
  if (count === 0) return null;
  return { a: sumA / count, b: sumB / count };
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(hex.trim()) || /^#?[0-9a-f]{3}$/i.test(hex.trim());
}

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  return trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
}
