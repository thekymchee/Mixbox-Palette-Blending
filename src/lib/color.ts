import { converter } from "culori";

const toOkhsl = converter("okhsl");

/** Lightness (Okhsl l, 0-100) for a hex color, or null if the hex is
 * invalid. Uses Okhsl rather than raw OKLab so it matches the "l" shown
 * elsewhere (the circle/plane's geometric-center info). */
export function hexLightnessPercent(hex: string): number | null {
  const okhsl = toOkhsl(hex);
  if (!okhsl) return null;
  return Math.round(okhsl.l * 100);
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(hex.trim()) || /^#?[0-9a-f]{3}$/i.test(hex.trim());
}

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  return trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
}
