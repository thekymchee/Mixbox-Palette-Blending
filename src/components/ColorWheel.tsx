import { useCallback, useEffect, useMemo, useRef } from "react";
import { converter } from "culori";
import type { Oklab } from "culori";
import { MAX_CHROMA, oklabToWheelOffset, wheelOffsetToOklabAB } from "../lib/oklab";
import type { Pigment } from "../lib/pigments";

const toRgb = converter("rgb");
type OklabConverter = (hex: string) => Oklab | undefined;

export interface WheelColor {
  hex: string;
  label?: string;
}

interface ColorWheelProps {
  size: number;
  lightness: number;
  pigments: Pigment[];
  selectedColors: WheelColor[];
  activeIndex: number;
  onPick: (hex: string) => void;
}

const WHEEL_RESOLUTION = 220;

function paintWheelBackground(canvas: HTMLCanvasElement, lightness: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const res = WHEEL_RESOLUTION;
  canvas.width = res;
  canvas.height = res;

  const image = ctx.createImageData(res, res);
  const center = res / 2;
  const radius = res / 2;

  for (let py = 0; py < res; py++) {
    for (let px = 0; px < res; px++) {
      const dx = px - center + 0.5;
      const dy = py - center + 0.5;
      const dist = Math.hypot(dx, dy);
      const idx = (py * res + px) * 4;

      if (dist > radius) {
        image.data[idx + 3] = 0;
        continue;
      }

      const { a, b } = wheelOffsetToOklabAB(dx, dy, radius);
      const rgb = toRgb({ mode: "oklab", l: lightness, a, b });
      const inGamut =
        rgb !== undefined &&
        rgb.r >= -1e-3 &&
        rgb.r <= 1 + 1e-3 &&
        rgb.g >= -1e-3 &&
        rgb.g <= 1 + 1e-3 &&
        rgb.b >= -1e-3 &&
        rgb.b <= 1 + 1e-3;

      if (!inGamut || !rgb) {
        image.data[idx + 3] = 0;
        continue;
      }

      image.data[idx] = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255);
      image.data[idx + 1] = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255);
      image.data[idx + 2] = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255);
      image.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

export function ColorWheel({ size, lightness, pigments, selectedColors, activeIndex, onPick }: ColorWheelProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toOklab = useMemo(() => converter("oklab"), []);

  useEffect(() => {
    if (bgCanvasRef.current) paintWheelBackground(bgCanvasRef.current, lightness);
  }, [lightness]);

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const radius = rect.width / 2;
      const dx = clientX - rect.left - radius;
      const dy = clientY - rect.top - radius;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, radius);
      const scale = dist > 0 ? clampedDist / dist : 0;
      const { a, b } = wheelOffsetToOklabAB(dx * scale, dy * scale, radius);
      const hex = pickHexFromAB(lightness, a, b);
      onPick(hex);
    },
    [lightness, onPick],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pickAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    pickAt(e.clientX, e.clientY);
  };

  const radius = size / 2;

  return (
    <div
      ref={containerRef}
      className="color-wheel"
      style={{ width: size, height: size }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <canvas ref={bgCanvasRef} className="color-wheel-canvas" style={{ width: size, height: size }} />

      <svg className="color-wheel-overlay" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {pigments.map((pigment) => {
          const ok = safeOklab(toOklab, pigment.hex);
          if (!ok) return null;
          const { x, y } = oklabToWheelOffset(ok.a, ok.b, radius);
          return (
            <circle
              key={pigment.id}
              cx={radius + x}
              cy={radius + y}
              r={4}
              fill={pigment.hex}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={0.75}
              opacity={0.8}
            >
              <title>{pigment.name}</title>
            </circle>
          );
        })}

        {selectedColors.map((color, i) => {
          const ok = safeOklab(toOklab, color.hex);
          if (!ok) return null;
          const { x, y } = oklabToWheelOffset(ok.a, ok.b, radius);
          const isActive = i === activeIndex;
          return (
            <g key={i}>
              <circle
                cx={radius + x}
                cy={radius + y}
                r={isActive ? 11 : 9}
                fill={color.hex}
                stroke={isActive ? "#1a1a1a" : "#ffffff"}
                strokeWidth={isActive ? 3 : 2.5}
              />
              <text x={radius + x} y={radius + y - 14} textAnchor="middle" className="wheel-index-label">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function safeOklab(toOklab: OklabConverter, hex: string) {
  try {
    return toOklab(hex);
  } catch {
    return undefined;
  }
}

function pickHexFromAB(lightness: number, a: number, b: number): string {
  const chroma = Math.hypot(a, b);
  const clampedChroma = Math.min(chroma, MAX_CHROMA);
  const scale = chroma > 0 ? clampedChroma / chroma : 0;
  const finalA = a * scale;
  const finalB = b * scale;

  let lo = 0;
  let hi = 1;
  let best = { r: 1, g: 1, b: 1 };
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const rgb = toRgb({ mode: "oklab", l: lightness, a: finalA * mid, b: finalB * mid });
    const inGamut =
      rgb !== undefined && rgb.r >= -1e-4 && rgb.r <= 1 + 1e-4 && rgb.g >= -1e-4 && rgb.g <= 1 + 1e-4 && rgb.b >= -1e-4 && rgb.b <= 1 + 1e-4;
    if (inGamut) {
      lo = mid;
      if (rgb) best = rgb;
    } else hi = mid;
  }

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const toHex = (v: number) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0");
  return `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`.toUpperCase();
}
