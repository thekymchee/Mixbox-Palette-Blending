import { useEffect, useRef } from "react";
import { meanValueCoordinates, regularPolygonVertices } from "../lib/polygon";
import { hexToLatent, mixLatentsWeighted } from "../lib/mix";

interface PolygonSwatchProps {
  colors: string[];
  size: number;
}

const RESOLUTION = 240;

export function PolygonSwatch({ colors, size }: PolygonSwatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = RESOLUTION;
    canvas.height = RESOLUTION;
    ctx.clearRect(0, 0, RESOLUTION, RESOLUTION);

    if (colors.length < 2) return;

    if (colors.length === 2) {
      renderLine(ctx, colors);
      return;
    }

    renderPolygon(ctx, colors);
  }, [colors]);

  return <canvas ref={canvasRef} className="polygon-swatch-canvas" style={{ width: size, height: size }} />;
}

function renderLine(ctx: CanvasRenderingContext2D, colors: string[]) {
  const margin = RESOLUTION * 0.12;
  const barHeight = RESOLUTION * 0.28;
  const top = (RESOLUTION - barHeight) / 2;
  const width = RESOLUTION - margin * 2;
  const samples = 128;
  const latents = colors.map(hexToLatent);

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const [r, g, b] = mixLatentsWeighted(latents, [1 - t, t]);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    const x = margin + (width * i) / samples;
    ctx.fillRect(x, top, width / samples + 1, barHeight);
  }
}

function renderPolygon(ctx: CanvasRenderingContext2D, colors: string[]) {
  const n = colors.length;
  const center = RESOLUTION / 2;
  const radius = RESOLUTION * 0.42;
  const vertices = regularPolygonVertices(n, center, center, radius);
  const latents = colors.map(hexToLatent);

  ctx.save();
  ctx.beginPath();
  vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
  ctx.closePath();
  ctx.clip();

  // Bounding box of the polygon, sampled at a coarser grid than RESOLUTION
  // and upscaled by the browser's own smoothing (via the canvas's CSS
  // size) - full per-pixel latent mixing at RESOLUTION^2 is unnecessary
  // and slower than it needs to be.
  const step = 3;
  const minX = Math.min(...vertices.map((v) => v.x));
  const maxX = Math.max(...vertices.map((v) => v.x));
  const minY = Math.min(...vertices.map((v) => v.y));
  const maxY = Math.max(...vertices.map((v) => v.y));

  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const weights = meanValueCoordinates({ x, y }, vertices);
      const [r, g, b] = mixLatentsWeighted(latents, weights);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, y, step + 1, step + 1);
    }
  }

  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
