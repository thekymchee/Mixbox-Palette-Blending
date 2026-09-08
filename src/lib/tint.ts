import { hexToLatent, hexToRgb, mixLatentsWeighted, type RgbTuple } from "./mix";
import { rgbToOklch } from "./color";

export const BLACK_LATENT = hexToLatent("#000000");
export const WHITE_LATENT = hexToLatent("#FFFFFF");

// Modeled after how printed color atlases (Munsell's Value axis, the CIELAB-
// based HLC Colour Atlas) handle tints and shades: instead of mixing in a
// fixed amount or proportion of black/white and letting whatever lightness
// falls out fall out, each step targets an evenly-spaced *perceptual*
// lightness (OKLab L, 0-1) - the same kind of axis Munsell's Value and
// HLC's L represent. Munsell spans black to white in 10-11 Value steps;
// 0.1 per step matches that convention directly.
//
// A pigment's own starting lightness decides how many steps it takes to
// reach the end (less distance to travel from a darker start), which is
// exactly the per-pigment differentiation this feature has always been
// after - it just now comes from evenly-paced perceptual distance instead
// of an artifact of Kubelka-Munk mixing math (which produced either a
// cliff or a long flat tail depending on how "dab-sized" mixing was tuned).
const TINT_STEP_LIGHTNESS = 0.1;
// Bisection iterations to find the mixing amount that hits a target
// lightness - each halves the search interval, so this is far more
// precision than an 8-bit channel needs.
const BISECTION_ITERATIONS = 14;

function oklabLightness(rgb: RgbTuple): number {
  return rgbToOklch(rgb).l;
}

/** Which extreme (if either) a rendered color is exactly pure black/white -
 * under this model that's a deliberate snap once a step's target lightness
 * clamps to 0 or 1 (see applyPerceptualTint), not an asymptotic approach,
 * so exact equality is the correct check rather than a tolerance. */
export function convergedExtreme(rgb: RgbTuple): "black" | "white" | null {
  if (rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0) return "black";
  if (rgb[0] === 255 && rgb[1] === 255 && rgb[2] === 255) return "white";
  return null;
}

function stepsToEdge(l0: number, edge: 0 | 1): number {
  return Math.max(1, Math.ceil(Math.abs(edge - l0) / TINT_STEP_LIGHTNESS));
}

/** The Tints slider's range for a given palette: as many evenly-spaced
 * lightness steps as the darkest selected pigment needs to reach black
 * (the "pure" index), plus however many the lightest one needs to reach
 * white - so the slider's ends always land on true black/white, sized to
 * whatever's actually selected. */
export function tintRangeForColors(colors: string[]): { pure: number; max: number } {
  if (colors.length === 0) return { pure: 1, max: 2 };
  const lightnesses = colors.map((hex) => oklabLightness(hexToRgb(hex)));
  const blackSteps = Math.max(...lightnesses.map((l) => stepsToEdge(l, 0)));
  const whiteSteps = Math.max(...lightnesses.map((l) => stepsToEdge(l, 1)));
  return { pure: blackSteps, max: blackSteps + whiteSteps };
}

/** Blends `originalLatents` (weighted by `originalWeights`, which sum to 1)
 * toward black or white to land on the evenly-spaced OKLab lightness this
 * `tint` step targets, relative to `pureIndex` (the untinted mix). The
 * blend itself is a straight latent-space interpolation between the tile's
 * own mix and pure black/white (still real Kubelka-Munk optics along the
 * way, so hue and chroma evolve physically) - only the *stopping point*
 * along that line is chosen by lightness rather than by a fixed amount. */
export function applyPerceptualTint(
  originalLatents: number[][],
  originalWeights: number[],
  tint: number,
  pureIndex: number,
): RgbTuple {
  const originalRgb = mixLatentsWeighted(originalLatents, originalWeights);
  if (tint === pureIndex) return originalRgb;

  const towardBlack = tint < pureIndex;
  const targetLatent = towardBlack ? BLACK_LATENT : WHITE_LATENT;
  const l0 = oklabLightness(originalRgb);
  const stepsFromPure = Math.abs(tint - pureIndex);
  const targetL = towardBlack
    ? Math.max(0, l0 - stepsFromPure * TINT_STEP_LIGHTNESS)
    : Math.min(1, l0 + stepsFromPure * TINT_STEP_LIGHTNESS);

  if (towardBlack && targetL <= 0) return [0, 0, 0];
  if (!towardBlack && targetL >= 1) return [255, 255, 255];

  const blendAt = (t: number): RgbTuple =>
    mixLatentsWeighted([...originalLatents, targetLatent], [...originalWeights.map((w) => w * (1 - t)), t]);

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const l = oklabLightness(blendAt(mid));
    const pastTarget = towardBlack ? l <= targetL : l >= targetL;
    if (pastTarget) hi = mid;
    else lo = mid;
  }
  return blendAt(hi);
}
