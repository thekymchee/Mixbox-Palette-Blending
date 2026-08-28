import { useCallback, useEffect, useRef } from "react";
import { hexToOkhsl, hueSatToWheelOffset, okhslToHex, okhslToRgb01, wheelOffsetToHueSat } from "../lib/okhsl";
import type { Pigment } from "../lib/pigments";

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
  midpointHex: string | null;
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

      const { h, s } = wheelOffsetToHueSat(dx, dy, radius);
      const { r, g, b } = okhslToRgb01(h, s, lightness);

      image.data[idx] = Math.round(r * 255);
      image.data[idx + 1] = Math.round(g * 255);
      image.data[idx + 2] = Math.round(b * 255);
      image.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

export function ColorWheel({
  size,
  lightness,
  pigments,
  selectedColors,
  activeIndex,
  midpointHex,
  onPick,
}: ColorWheelProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const { h, s } = wheelOffsetToHueSat(dx, dy, radius);
      onPick(okhslToHex(h, s, lightness));
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
  const midpoint = midpointHex ? safeOkhsl(midpointHex) : undefined;

  return (
    <>
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
            const ok = safeOkhsl(pigment.hex);
            if (!ok) return null;
            const { x, y } = hueSatToWheelOffset(ok.h ?? 0, ok.s, radius);
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
            const ok = safeOkhsl(color.hex);
            if (!ok) return null;
            const { x, y } = hueSatToWheelOffset(ok.h ?? 0, ok.s, radius);
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

          {midpoint &&
            (() => {
              const { x, y } = hueSatToWheelOffset(midpoint.h ?? 0, midpoint.s, radius);
              return <PlusMarker cx={radius + x} cy={radius + y} />;
            })()}
        </svg>
      </div>

      {midpointHex && <MidpointInfo hex={midpointHex} />}
    </>
  );
}

function PlusMarker({ cx, cy }: { cx: number; cy: number }) {
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

function MidpointInfo({ hex }: { hex: string }) {
  const ok = safeOkhsl(hex);
  return (
    <div className="midpoint-info">
      <span className="midpoint-info-swatch" style={{ backgroundColor: hex }} />
      <div className="midpoint-info-text">
        <span className="midpoint-info-label">Midpoint mix</span>
        <span className="midpoint-info-hex">{hex}</span>
        {ok && (
          <span className="midpoint-info-hsl">
            h {Math.round(ok.h ?? 0)}° · s {Math.round(ok.s * 100)}% · l {Math.round(ok.l * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

function safeOkhsl(hex: string) {
  try {
    return hexToOkhsl(hex);
  } catch {
    return undefined;
  }
}
