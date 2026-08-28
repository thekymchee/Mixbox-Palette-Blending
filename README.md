# Mixbox Palette Blending

A web app for exploring pigment-based color blending. Pick 2–6 colors and see
them mixed as real paint — using [Mixbox](https://github.com/scrtwpns/mixbox)'s
Kubelka-Munk pigment model — across a swatch shaped like the polygon your
colors form (a line for 2, a triangle for 3, a diamond for 4, a pentagon for
5, a hexagon for 6).

## Features

- **Polygon swatch** — each selected color sits at one vertex of a regular
  polygon; the interior is filled by mixing all vertex colors together in
  Mixbox's latent pigment space, weighted by
  [mean value coordinates](https://en.wikipedia.org/wiki/Mean_value_coordinates)
  for each point. This gives true pigment mixing (e.g. yellow + blue → green)
  rather than a flat RGB gradient.
- **OKLAB color wheel** — a perceptually uniform hue/chroma wheel (via
  [culori](https://culorijs.org/)) you can click or drag on to pick a color.
  A lightness slider re-renders the wheel's visible gamut at a different
  lightness. Your pigment library is plotted as small dots; the colors
  currently being blended are plotted as larger, bold rings.
- **Three ways to choose a color** for each slot: click/drag on the color
  wheel, type a hex code directly, or pick from an editable pigment list.
- **Editable pigment library** — add, remove, or reset the list of pigments
  (seeded with Mixbox's built-in set). Stored in `localStorage`, so it
  persists across sessions.

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [mixbox](https://www.npmjs.com/package/mixbox) for pigment-based color mixing
- [culori](https://culorijs.org/) for OKLAB color space conversions

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
```
