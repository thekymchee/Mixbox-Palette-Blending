import { useCallback, useEffect, useMemo, useRef } from "react";
import { clampToGamutHex, hexToOklab, oklabToPlaneOffset, oklabToRgb01, planeOffsetToOklabAB } from "../lib/oklabPlane";
import type { Pigment } from "../lib/pigments";
import type { WheelColor } from "./ColorWheel";

interface ColorPlaneProps {
  size: number;
  lightness: number;
  pigments: Pigment[];
  selectedColors: WheelColor[];
  activeIndex: number;
  onPick: (hex: string) => void;
}

const PLANE_RESOLUTION = 220;
const MIN_HALF_EXTENT = 0.12;
const PADDING_FACTOR = 1.3;
// Hue-angle ticks around the plot, using OKLCH's standard hue definition
// (0 deg along +a, increasing counterclockwise) - the same number shown
// as "h" elsewhere in the app.
const DEGREE_TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

function computeHalfExtent(pigments: Pigment[], selectedColors: WheelColor[]): number {
  let maxAbs = MIN_HALF_EXTENT;
  for (const hex of [...pigments.map((p) => p.hex), ...selectedColors.map((c) => c.hex)]) {
    const ok = safeOklab(hex);
    if (!ok) continue;
    maxAbs = Math.max(maxAbs, Math.abs(ok.a), Math.abs(ok.b));
  }
  return maxAbs * PADDING_FACTOR;
}

function paintPlaneBackground(canvas: HTMLCanvasElement, lightness: number, halfExtent: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const res = PLANE_RESOLUTION;
  canvas.width = res;
  canvas.height = res;

  const image = ctx.createImageData(res, res);
  const center = res / 2;

  for (let py = 0; py < res; py++) {
    for (let px = 0; px < res; px++) {
      const dx = px - center + 0.5;
      const dy = py - center + 0.5;
      const idx = (py * res + px) * 4;

      const { a, b } = planeOffsetToOklabAB(dx, dy, halfExtent, center);
      const rgb = oklabToRgb01(lightness, a, b);

      if (!rgb) {
        image.data[idx + 3] = 0;
        continue;
      }

      image.data[idx] = Math.round(rgb.r * 255);
      image.data[idx + 1] = Math.round(rgb.g * 255);
      image.data[idx + 2] = Math.round(rgb.b * 255);
      image.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

export function ColorPlane({ size, lightness, pigments, selectedColors, activeIndex, onPick }: ColorPlaneProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const halfExtent = useMemo(() => computeHalfExtent(pigments, selectedColors), [pigments, selectedColors]);

  useEffect(() => {
    if (bgCanvasRef.current) paintPlaneBackground(bgCanvasRef.current, lightness, halfExtent);
  }, [lightness, halfExtent]);

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.width / 2;
      const dx = Math.max(-center, Math.min(center, clientX - rect.left - center));
      const dy = Math.max(-center, Math.min(center, clientY - rect.top - center));
      const { a, b } = planeOffsetToOklabAB(dx, dy, halfExtent, center);
      onPick(clampToGamutHex(lightness, a, b));
    },
    [lightness, halfExtent, onPick],
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

  const centroid = useMemo(() => {
    if (selectedColors.length < 2) return null;
    let sumA = 0;
    let sumB = 0;
    let count = 0;
    for (const color of selectedColors) {
      const ok = safeOklab(color.hex);
      if (!ok) continue;
      sumA += ok.a;
      sumB += ok.b;
      count++;
    }
    if (count === 0) return null;
    return { a: sumA / count, b: sumB / count };
  }, [selectedColors]);

  const centroidHex = useMemo(() => {
    if (!centroid) return null;
    return clampToGamutHex(lightness, centroid.a, centroid.b);
  }, [centroid, lightness]);

  const gridValues = [-halfExtent, -halfExtent / 2, 0, halfExtent / 2, halfExtent];
  const degreeCircleRadius = radius - 24;

  return (
    <>
      <div className="color-plane-wrap">
        <span className="plane-axis-label plane-axis-label-b">b (blue ↔ yellow)</span>
        <div
          ref={containerRef}
          className="color-plane"
          style={{ width: size, height: size }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <canvas ref={bgCanvasRef} className="color-plane-canvas" style={{ width: size, height: size }} />

          <svg className="color-plane-overlay" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle className="plane-degree-circle" cx={radius} cy={radius} r={degreeCircleRadius} />
            {DEGREE_TICKS.map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const ux = Math.cos(rad);
              // Screen y is flipped relative to OKLab b, matching oklabToPlaneOffset.
              const uy = -Math.sin(rad);
              const innerX = radius + ux * (degreeCircleRadius - 6);
              const innerY = radius + uy * (degreeCircleRadius - 6);
              const outerX = radius + ux * degreeCircleRadius;
              const outerY = radius + uy * degreeCircleRadius;
              const labelX = radius + ux * (degreeCircleRadius + 13);
              const labelY = radius + uy * (degreeCircleRadius + 13);
              return (
                <g key={deg} className="plane-degree-tick">
                  <line x1={innerX} y1={innerY} x2={outerX} y2={outerY} />
                  <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle">
                    {deg}°
                  </text>
                </g>
              );
            })}

            {gridValues.map((v) => {
              const { x } = oklabToPlaneOffset(v, 0, halfExtent, radius);
              const { y } = oklabToPlaneOffset(0, v, halfExtent, radius);
              return (
                <g key={v} className="plane-gridline">
                  <line x1={radius + x} y1={0} x2={radius + x} y2={size} strokeWidth={v === 0 ? 1.5 : 0.75} />
                  <line x1={0} y1={radius + y} x2={size} y2={radius + y} strokeWidth={v === 0 ? 1.5 : 0.75} />
                  {v !== 0 && (
                    <text x={radius + x + 3} y={size - 4} className="plane-tick-label">
                      {v.toFixed(2)}
                    </text>
                  )}
                </g>
              );
            })}

            {pigments.map((pigment) => {
              const ok = safeOklab(pigment.hex);
              if (!ok) return null;
              const { x, y } = oklabToPlaneOffset(ok.a, ok.b, halfExtent, radius);
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
              const ok = safeOklab(color.hex);
              if (!ok) return null;
              const { x, y } = oklabToPlaneOffset(ok.a, ok.b, halfExtent, radius);
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

            {centroid &&
              (() => {
                const { x, y } = oklabToPlaneOffset(centroid.a, centroid.b, halfExtent, radius);
                return <PlaneCross cx={radius + x} cy={radius + y} />;
              })()}
          </svg>
        </div>
        <span className="plane-axis-label plane-axis-label-a">a (green ↔ magenta)</span>
      </div>

      {centroidHex && <PlaneCentroidInfo hex={centroidHex} centroid={centroid} />}
    </>
  );
}

function PlaneCross({ cx, cy }: { cx: number; cy: number }) {
  const half = 7;
  return (
    <g className="wheel-plus-marker">
      <path
        d={`M ${cx - half} ${cy} L ${cx + half} ${cy} M ${cx} ${cy - half} L ${cx} ${cy + half}`}
        stroke="#ffffff"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - half} ${cy} L ${cx + half} ${cy} M ${cx} ${cy - half} L ${cx} ${cy + half}`}
        stroke="#1a1a1a"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
}

function PlaneCentroidInfo({ hex, centroid }: { hex: string; centroid: { a: number; b: number } | null }) {
  return (
    <div className="midpoint-info">
      <span className="midpoint-info-swatch" style={{ backgroundColor: hex }} />
      <div className="midpoint-info-text">
        <span className="midpoint-info-label">Geometric center</span>
        <span className="midpoint-info-hex">{hex}</span>
        {centroid && (
          <span className="midpoint-info-hsl">
            a {centroid.a.toFixed(3)} · b {centroid.b.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
}

function safeOklab(hex: string) {
  try {
    return hexToOklab(hex);
  } catch {
    return undefined;
  }
}
