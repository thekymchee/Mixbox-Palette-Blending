export interface Pigment {
  id: string;
  name: string;
  hex: string;
}

// Mixbox's built-in pigment set (Kubelka-Munk calibrated colors).
// See https://github.com/scrtwpns/mixbox
export const DEFAULT_PIGMENTS: Pigment[] = [
  { id: "cadmium-yellow", name: "Cadmium Yellow", hex: "#FEEC00" },
  { id: "hansa-yellow", name: "Hansa Yellow", hex: "#FCD300" },
  { id: "cadmium-orange", name: "Cadmium Orange", hex: "#FF6900" },
  { id: "cadmium-red", name: "Cadmium Red", hex: "#FF2702" },
  { id: "quinacridone-magenta", name: "Quinacridone Magenta", hex: "#80022E" },
  { id: "cobalt-violet", name: "Cobalt Violet", hex: "#4E0042" },
  { id: "ultramarine-blue", name: "Ultramarine Blue", hex: "#190059" },
  { id: "cobalt-blue", name: "Cobalt Blue", hex: "#002185" },
  { id: "phthalo-blue", name: "Phthalo Blue", hex: "#0D1B44" },
  { id: "phthalo-green", name: "Phthalo Green", hex: "#003C32" },
  { id: "permanent-green", name: "Permanent Green", hex: "#076D16" },
  { id: "sap-green", name: "Sap Green", hex: "#6B9404" },
  { id: "burnt-sienna", name: "Burnt Sienna", hex: "#7B4800" },
  { id: "titanium-white", name: "Titanium White", hex: "#FFFFFF" },
  { id: "mars-black", name: "Mars Black", hex: "#100C0C" },
];

const STORAGE_KEY = "mixbox-palette-blending:pigments";

export function loadPigments(): Pigment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PIGMENTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PIGMENTS;
    return parsed;
  } catch {
    return DEFAULT_PIGMENTS;
  }
}

export function savePigments(pigments: Pigment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pigments));
  } catch {
    // localStorage unavailable (private mode, quota) - edits just won't persist.
  }
}

export function makePigmentId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : `pigment-${suffix}`;
}
