declare module "mixbox" {
  type RgbTuple = [number, number, number];

  const mixbox: {
    LATENT_SIZE: number;
    lerp(color1: RgbTuple | string, color2: RgbTuple | string, t: number): RgbTuple;
    rgbToLatent(r: number, g: number, b: number): number[];
    rgbToLatent(rgb: RgbTuple): number[];
    latentToRgb(latent: number[]): RgbTuple;
  };

  export default mixbox;
}
