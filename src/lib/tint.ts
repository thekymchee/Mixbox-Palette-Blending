import { hexToLatent, mixLatentsWeighted, type RgbTuple } from "./mix";

export const BLACK_LATENT = hexToLatent("#000000");
export const WHITE_LATENT = hexToLatent("#FFFFFF");

// Each Tints step mixes in a fixed 40% (1 - TINT_RATIO) of black or white
// relative to whatever remains of the mix so far, compounding step over
// step - like repeatedly stirring in a dab of black paint - rather than
// interpolating in one shot to a target fraction. Because it's the
// *remaining* pigment that shrinks by a fixed proportion each step, a
// mixture that starts darker (or is a stronger tinter, in Mixbox's latent
// space) reaches a rounding-indistinguishable black in fewer steps than a
// pale, weak-tinting one - matching how real pigments differ in how
// quickly they "give up" toward black or white.
const TINT_RATIO = 0.6;
// Upper bound on the search in stepsToConverge - at TINT_RATIO=0.6 even a
// pathologically stubborn latent vector is indistinguishable from black or
// white well before this many steps, so it only guards against an infinite
// loop rather than reflecting a realistic pigment count.
const TINT_STEP_SEARCH_CAP = 40;

// Because 0.6^k only approaches 0 asymptotically, chasing a literal
// rgb(0,0,0)/(255,255,255) costs several extra steps after a mix has
// already become visually solid - e.g. rgb(0,1,4) is indistinguishable
// from black on any display, but isn't bit-exact black. Anything within
// this many 8-bit levels of 0 or 255 reads as pure to the eye, so
// "converged" is judged against this tolerance instead.
const VISUAL_CONVERGENCE_THRESHOLD = 4;

export function isConvergedBlack(rgb: RgbTuple): boolean {
  return rgb.every((c) => c <= VISUAL_CONVERGENCE_THRESHOLD);
}

export function isConvergedWhite(rgb: RgbTuple): boolean {
  return rgb.every((c) => c >= 255 - VISUAL_CONVERGENCE_THRESHOLD);
}

/** Which extreme (if either) a rendered color has visually converged to,
 * for marking a grid tile as "arrived" rather than merely very dark/light. */
export function convergedExtreme(rgb: RgbTuple): "black" | "white" | null {
  if (isConvergedBlack(rgb)) return "black";
  if (isConvergedWhite(rgb)) return "white";
  return null;
}

/** How many compounding steps (at TINT_RATIO) it takes `latent` mixed
 * toward `targetLatent` to become visually indistinguishable from it - the
 * step after which the rendered color keeps changing in theory but not in
 * anything anyone could actually see. */
function stepsToConverge(latent: number[], targetLatent: number[], isBlack: boolean): number {
  for (let k = 0; k <= TINT_STEP_SEARCH_CAP; k++) {
    const original = TINT_RATIO ** k;
    const rgb = mixLatentsWeighted([latent, targetLatent], [original, 1 - original]);
    if (isBlack ? isConvergedBlack(rgb) : isConvergedWhite(rgb)) return k;
  }
  return TINT_STEP_SEARCH_CAP;
}

/** The Tints slider's range for a given palette: as many steps toward
 * black as the slowest-converging selected pigment actually needs to
 * become visually solid black (the "pure" index), plus however many the
 * slowest-converging one needs toward white - so the slider's ends always
 * land on true black/white for whatever's selected, without wasting steps
 * once every pigment has already gotten there. */
export function tintRangeForColors(colors: string[]): { pure: number; max: number } {
  const latents = colors.map(hexToLatent);
  const blackSteps = latents.length ? Math.max(...latents.map((l) => stepsToConverge(l, BLACK_LATENT, true))) : 1;
  const whiteSteps = latents.length ? Math.max(...latents.map((l) => stepsToConverge(l, WHITE_LATENT, false))) : 1;
  const pure = Math.max(blackSteps, 1);
  return { pure, max: pure + Math.max(whiteSteps, 1) };
}

/** 0..pureIndex compounds toward black, pureIndex..max compounds toward
 * white; weights sum to 1 so this composes with the vertex weights below
 * into a single latent-space mix. */
export function tintWeights(tint: number, pureIndex: number): { original: number; black: number; white: number } {
  const stepsFromPure = Math.abs(tint - pureIndex);
  const original = TINT_RATIO ** stepsFromPure;
  if (tint <= pureIndex) return { original, black: 1 - original, white: 0 };
  return { original, black: 0, white: 1 - original };
}
