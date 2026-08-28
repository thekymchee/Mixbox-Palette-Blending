import mixbox from "mixbox";

export type RgbTuple = [number, number, number];

function hexToRgb(hex: string): RgbTuple {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex([r, g, b]: RgbTuple): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToLatent(hex: string): number[] {
  return mixbox.rgbToLatent(hexToRgb(hex));
}

/** Weighted pigment mix from precomputed latent vectors (one per color, in
 * the same order as `weights`). Precomputing latents once per render and
 * reusing them across many grid cells avoids redundant hex/latent
 * conversions when filling a polygon. */
export function mixLatentsWeighted(latents: number[][], weights: number[]): RgbTuple {
  const latentSum = new Array(mixbox.LATENT_SIZE).fill(0);
  let weightSum = 0;
  for (let i = 0; i < latents.length; i++) {
    const w = weights[i];
    if (w <= 0) continue;
    weightSum += w;
    const latent = latents[i];
    for (let j = 0; j < mixbox.LATENT_SIZE; j++) {
      latentSum[j] += w * latent[j];
    }
  }
  if (weightSum <= 0) return [255, 255, 255];
  for (let j = 0; j < mixbox.LATENT_SIZE; j++) latentSum[j] /= weightSum;
  return mixbox.latentToRgb(latentSum);
}

/** Weighted pigment mix of any number of colors, done in Mixbox's latent
 * pigment space so it reflects Kubelka-Munk-style pigment mixing rather
 * than a naive RGB average. */
export function mixWeighted(hexColors: string[], weights: number[]): RgbTuple {
  return mixLatentsWeighted(hexColors.map(hexToLatent), weights);
}

export { hexToRgb };
