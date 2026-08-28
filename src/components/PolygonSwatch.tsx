import { useEffect, useRef } from "react";
import { meanValueCoordinates, regularPolygonVertices } from "../lib/polygon";
import { hexToLatent, mixLatentsWeighted } from "../lib/mix";

interface PolygonSwatchProps {
  colors: string[];
  steps: number;
  size: number;
}

export function PolygonSwatch({ colors, steps, size }: PolygonSwatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    if (colors.length < 2) return;

    if (colors.length === 2) {
      renderLineSteps(ctx, colors, steps, size);
      return;
    }

    renderPolygonSteps(ctx, colors, steps, size);
  }, [colors, steps, size]);

  return <canvas ref={canvasRef} className="polygon-swatch-canvas" style={{ width: size, height: size }} />;
}

const GRID_LINE_STYLE = "rgba(0,0,0,0.12)";

function drawPlus(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - half, cy);
  ctx.lineTo(cx + half, cy);
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx, cy + half);
  ctx.stroke();

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - half, cy);
  ctx.lineTo(cx + half, cy);
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx, cy + half);
  ctx.stroke();
  ctx.restore();
}

function renderLineSteps(ctx: CanvasRenderingContext2D, colors: string[], steps: number, size: number) {
  const margin = size * 0.08;
  const top = size * 0.35;
  const height = size * 0.3;
  const width = size - margin * 2;
  const cellWidth = width / steps;
  const latents = colors.map(hexToLatent);

  let nearestIndex = 0;
  let nearestDist = Infinity;

  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    const dist = Math.abs(t - 0.5);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIndex = i;
    }

    const [r, g, b] = mixLatentsWeighted(latents, [1 - t, t]);
    const x = margin + cellWidth * i;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x, top, cellWidth, height);
    ctx.strokeStyle = GRID_LINE_STYLE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, top, cellWidth, height);
  }

  const nearestCx = margin + cellWidth * (nearestIndex + 0.5);
  const nearestCy = top + height / 2;
  drawPlus(ctx, nearestCx, nearestCy, Math.min(cellWidth, height) * 0.22);
}

function renderPolygonSteps(ctx: CanvasRenderingContext2D, colors: string[], steps: number, size: number) {
  const n = colors.length;
  const center = size / 2;
  const radius = size * 0.42;
  const vertices = regularPolygonVertices(n, center, center, radius);
  const latents = colors.map(hexToLatent);

  ctx.save();
  ctx.beginPath();
  vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
  ctx.closePath();
  ctx.clip();

  const gridSize = radius * 2;
  const gridMin = center - radius;
  const tileSize = gridSize / steps;

  let nearestCx = center;
  let nearestCy = center;
  let nearestDist = Infinity;

  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const cx = gridMin + tileSize * (col + 0.5);
      const cy = gridMin + tileSize * (row + 0.5);

      const weights = meanValueCoordinates({ x: cx, y: cy }, vertices);
      const [r, g, b] = mixLatentsWeighted(latents, weights);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(gridMin + tileSize * col, gridMin + tileSize * row, tileSize + 0.5, tileSize + 0.5);
      ctx.strokeStyle = GRID_LINE_STYLE;
      ctx.lineWidth = 1;
      ctx.strokeRect(gridMin + tileSize * col, gridMin + tileSize * row, tileSize, tileSize);

      const dist = Math.hypot(cx - center, cy - center);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestCx = cx;
        nearestCy = cy;
      }
    }
  }

  ctx.restore();

  drawPlus(ctx, nearestCx, nearestCy, tileSize * 0.22);

  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
