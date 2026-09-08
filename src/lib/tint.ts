import { hexToLatent, mixLatentsWeighted, type RgbTuple } from "./mix";

export const BLACK_LATENT = hexToLatent("#000000");
export const WHITE_LATENT = hexToLatent("#FFFFFF");

// Each Tints step stirs in one more fixed-size dab of black or white paint
// - the dab itself doesn't grow or shrink, unlike a proportional/compounding
// mix. In parts-of-paint terms: the original mix stays at a constant 1
// part, while accumulated black or white grows by one dab's worth per
// step, so after k steps the original is 1-in-(1+k*dab) of the total - a
// dilution curve, not a percentage removed each time. A mixture that
// starts darker (or is a stronger tinter, in Mixbox's latent space) still
// needs fewer dabs to become visually solid black/white than a pale,
// weak-tinting one, since the same dab overwhelms less pigment faster -
// matching how real pigments differ in how quickly they "give up" toward
// black or white as you keep stirring in more paint.
//
// The two sides use different dab sizes on purpose. Mixbox's white pigment
// behaves like real titanium white: extremely strong-scattering, so it
// overwhelms almost any pigment at close to the same rate regardless of
// how dark that pigment started - a small black dab already shows strong
// per-pigment spread, but the same-sized white dab compresses everything
// into too few steps to see that dilution happening. Cutting the white dab
// down stretches that side back out into a visible fade.
const TINT_DAB_SIZE_BLACK = 6;
const TINT_DAB_SIZE_WHITE = 2;
// Upper bound on the search in stepsToConverge - even a pathologically
// stubborn latent vector is indistinguishable from black or white well
// before this many steps, so it only guards against an infinite loop
// rather than reflecting a realistic pigment count.
const TINT_STEP_SEARCH_CAP = 120;

// The original's share of the mix (1/(1+k*dab)) only approaches 0
// asymptotically, so chasing a literal rgb(0,0,0)/(255,255,255) costs
// several extra dabs after a mix has already become visually solid - e.g.
// rgb(7,11,1) already reads as black to the eye, but isn't bit-exact.
// Anything within this many 8-bit levels of 0 or 255 counts as pure, so
// "converged" is judged against this tolerance instead - generous enough
// that a typical saturated pigment (not just near-grays) reads as done
// within a handful of dabs, matching what it actually looks like on screen.
const VISUAL_CONVERGENCE_THRESHOLD = 12;

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

/** How many fixed-size dabs it takes `latent` mixed toward `targetLatent`
 * to become visually indistinguishable from it - the step after which the
 * rendered color keeps changing in theory but not in anything anyone could
 * actually see. */
function stepsToConverge(latent: number[], targetLatent: number[], isBlack: boolean): number {
  const dabSize = isBlack ? TINT_DAB_SIZE_BLACK : TINT_DAB_SIZE_WHITE;
  for (let k = 1; k <= TINT_STEP_SEARCH_CAP; k++) {
    const rgb = mixLatentsWeighted([latent, targetLatent], [1, k * dabSize]);
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

/** 0..pureIndex dabs in black, pureIndex..max dabs in white. `original`
 * stays a constant 1 part - only the accumulated dab weight grows - so
 * this composes with the vertex weights below (which already sum to 1)
 * into a single latent-space mix where black/white keeps diluting the
 * original mix rather than a fixed fraction of it being replaced. */
export function tintWeights(tint: number, pureIndex: number): { original: number; black: number; white: number } {
  const stepsFromPure = Math.abs(tint - pureIndex);
  if (tint <= pureIndex) return { original: 1, black: stepsFromPure * TINT_DAB_SIZE_BLACK, white: 0 };
  return { original: 1, black: 0, white: stepsFromPure * TINT_DAB_SIZE_WHITE };
}
