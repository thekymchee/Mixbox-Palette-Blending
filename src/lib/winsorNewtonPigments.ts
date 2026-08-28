import type { Pigment } from "./pigments";

// Approximate swatch colors for common Winsor & Newton Professional
// Watercolour hues, typed by hand from general product familiarity - NOT
// measured spectrophotometer data. For accurate, measured swatches, see
// https://artistpigments.org/brands/winsor-and-newton-professional-water-colour
// (their masstone measurements weren't reachable from this environment).
// Treat these as a reasonable visual approximation, not a color-accurate
// reference.
export const WINSOR_NEWTON_DISCLAIMER =
  "Approximate colors from general knowledge, not measured swatch data. See artistpigments.org for authoritative values.";

export const WINSOR_NEWTON_PIGMENTS: Pigment[] = [
  { id: "wn-winsor-yellow", name: "Winsor Yellow", hex: "#FFDE00" },
  { id: "wn-winsor-lemon", name: "Winsor Lemon", hex: "#FFF200" },
  { id: "wn-cadmium-yellow-pale", name: "Cadmium Yellow Pale", hex: "#FFDA1A" },
  { id: "wn-cadmium-yellow", name: "Cadmium Yellow", hex: "#FFC20E" },
  { id: "wn-cadmium-yellow-deep", name: "Cadmium Yellow Deep", hex: "#FFA400" },
  { id: "wn-aureolin", name: "Aureolin", hex: "#FFC90E" },
  { id: "wn-new-gamboge", name: "New Gamboge", hex: "#F9A602" },
  { id: "wn-winsor-orange", name: "Winsor Orange", hex: "#FF6A13" },
  { id: "wn-cadmium-orange", name: "Cadmium Orange", hex: "#FF6600" },
  { id: "wn-cadmium-red-pale", name: "Cadmium Red Pale", hex: "#FF2400" },
  { id: "wn-cadmium-red", name: "Cadmium Red", hex: "#E2231A" },
  { id: "wn-cadmium-red-deep", name: "Cadmium Red Deep", hex: "#C8102E" },
  { id: "wn-winsor-red", name: "Winsor Red", hex: "#E1261C" },
  { id: "wn-permanent-rose", name: "Permanent Rose", hex: "#E0457B" },
  { id: "wn-rose-madder-genuine", name: "Rose Madder Genuine", hex: "#E8899A" },
  { id: "wn-permanent-magenta", name: "Permanent Magenta", hex: "#9B1B52" },
  { id: "wn-quinacridone-magenta", name: "Quinacridone Magenta", hex: "#8E1B4C" },
  { id: "wn-alizarin-crimson", name: "Alizarin Crimson", hex: "#7E1F23" },
  { id: "wn-winsor-violet", name: "Winsor Violet (Dioxazine)", hex: "#4B2E83" },
  { id: "wn-cobalt-violet", name: "Cobalt Violet", hex: "#8B5A96" },
  { id: "wn-ultramarine-violet", name: "Ultramarine Violet", hex: "#4B3B78" },
  { id: "wn-french-ultramarine", name: "French Ultramarine", hex: "#1B3F91" },
  { id: "wn-ultramarine", name: "Ultramarine", hex: "#2036A6" },
  { id: "wn-cobalt-blue", name: "Cobalt Blue", hex: "#2255A4" },
  { id: "wn-cobalt-blue-deep", name: "Cobalt Blue Deep", hex: "#1B3B7A" },
  { id: "wn-cerulean-blue", name: "Cerulean Blue", hex: "#3399CC" },
  { id: "wn-winsor-blue-gs", name: "Winsor Blue (Green Shade)", hex: "#0C3C78" },
  { id: "wn-winsor-blue-rs", name: "Winsor Blue (Red Shade)", hex: "#1B2A6B" },
  { id: "wn-antwerp-blue", name: "Antwerp Blue", hex: "#1C3F5E" },
  { id: "wn-prussian-blue", name: "Prussian Blue", hex: "#0F2A44" },
  { id: "wn-indanthrene-blue", name: "Indanthrene Blue", hex: "#1A2B4C" },
  { id: "wn-winsor-green-bs", name: "Winsor Green (Blue Shade)", hex: "#00543C" },
  { id: "wn-winsor-green-ys", name: "Winsor Green (Yellow Shade)", hex: "#017147" },
  { id: "wn-viridian", name: "Viridian", hex: "#40826D" },
  { id: "wn-permanent-sap-green", name: "Permanent Sap Green", hex: "#5C7A29" },
  { id: "wn-hookers-green", name: "Hooker's Green", hex: "#2B5233" },
  { id: "wn-olive-green", name: "Olive Green", hex: "#556B2F" },
  { id: "wn-terre-verte", name: "Terre Verte", hex: "#6E7F52" },
  { id: "wn-yellow-ochre", name: "Yellow Ochre", hex: "#C89B3C" },
  { id: "wn-raw-sienna", name: "Raw Sienna", hex: "#C67C2E" },
  { id: "wn-burnt-sienna", name: "Burnt Sienna", hex: "#953B25" },
  { id: "wn-raw-umber", name: "Raw Umber", hex: "#6B4B33" },
  { id: "wn-burnt-umber", name: "Burnt Umber", hex: "#5A3A22" },
  { id: "wn-light-red", name: "Light Red", hex: "#C1440E" },
  { id: "wn-venetian-red", name: "Venetian Red", hex: "#A64B32" },
  { id: "wn-indian-red", name: "Indian Red", hex: "#8C3B2E" },
  { id: "wn-naples-yellow", name: "Naples Yellow", hex: "#F4C77E" },
  { id: "wn-davys-gray", name: "Davy's Gray", hex: "#838577" },
  { id: "wn-paynes-gray", name: "Payne's Gray", hex: "#3B3F4D" },
  { id: "wn-neutral-tint", name: "Neutral Tint", hex: "#4A4A52" },
  { id: "wn-ivory-black", name: "Ivory Black", hex: "#2B2B2B" },
  { id: "wn-lamp-black", name: "Lamp Black", hex: "#1C1C1C" },
  { id: "wn-chinese-white", name: "Chinese White", hex: "#F5F3EA" },
];
