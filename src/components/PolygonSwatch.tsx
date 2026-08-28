import { useState, useEffect, useRef } from "react";
import { meanValueCoordinates, pointInPolygon, regularPolygonVertices, type Point } from "../lib/polygon";
import { hexToLatent, mixLatentsWeighted, rgbToHex, type RgbTuple } from "../lib/mix";

interface PolygonSwatchProps {
  colors: string[];
  steps: number;
  size: number;
}

interface HoverState {
  x: number;
  y: number;
  hex: string;
}

const clipboardSupported =
  typeof navigator !== "undefined" && !!navigator.clipboard?.write && typeof window.ClipboardItem !== "undefined";

export function PolygonSwatch({ colors, steps, size }: PolygonSwatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rgb = colors.length >= 2 ? colorAtPoint(colors, steps, size, x, y) : null;
    setHover(rgb ? { x, y, hex: rgbToHex(rgb) } : null);
  };

  const handleDownload = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "blended-swatch.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const handleCopy = () => {
    canvasRef.current?.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopyStatus("Copied!");
      } catch {
        setCopyStatus("Copy failed");
      }
      setTimeout(() => setCopyStatus(null), 1600);
    }, "image/png");
  };

  return (
    <div className="swatch-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="polygon-swatch-canvas"
        style={{ width: size, height: size }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {hover && (
        <div className="swatch-hover-tooltip" style={{ left: hover.x, top: hover.y }}>
          {hover.hex}
        </div>
      )}
      <div className="swatch-export-row">
        <button type="button" onClick={handleDownload}>
          Download PNG
        </button>
        {clipboardSupported && (
          <button type="button" onClick={handleCopy}>
            {copyStatus ?? "Copy Image"}
          </button>
        )}
      </div>
    </div>
  );
}

const GRID_LINE_STYLE = "rgba(0,0,0,0.12)";
// Below this tile size, per-tile borders muddy the colors more than they
// help define the grid, so they're skipped.
const MIN_TILE_SIZE_FOR_BORDER = 3;

function lineGeometry(size: number) {
  const margin = size * 0.08;
  const top = size * 0.35;
  const height = size * 0.3;
  const width = size - margin * 2;
  return { margin, top, height, width };
}

function polygonGeometry(n: number, size: number) {
  const center = size / 2;
  const radius = size * 0.42;
  const vertices = regularPolygonVertices(n, center, center, radius);
  const gridSize = radius * 2;
  const gridMin = center - radius;
  return { center, radius, vertices, gridSize, gridMin };
}

/** Looks up the exact color rendered at a canvas point, using the same
 * tile geometry as the render functions below, for the hover tooltip. */
function colorAtPoint(colors: string[], steps: number, size: number, x: number, y: number): RgbTuple | null {
  const latents = colors.map(hexToLatent);

  if (colors.length === 2) {
    const { margin, top, height, width } = lineGeometry(size);
    if (x < margin || x > margin + width || y < top || y > top + height) return null;
    const cellWidth = width / steps;
    const i = Math.min(steps - 1, Math.max(0, Math.floor((x - margin) / cellWidth)));
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    return mixLatentsWeighted(latents, [1 - t, t]);
  }

  const { vertices, gridSize, gridMin } = polygonGeometry(colors.length, size);
  const tileSize = gridSize / steps;
  const col = Math.floor((x - gridMin) / tileSize);
  const row = Math.floor((y - gridMin) / tileSize);
  if (col < 0 || col >= steps || row < 0 || row >= steps) return null;

  const tileCenter: Point = { x: gridMin + tileSize * (col + 0.5), y: gridMin + tileSize * (row + 0.5) };
  if (!pointInPolygon(tileCenter, vertices)) return null;

  const weights = meanValueCoordinates(tileCenter, vertices);
  return mixLatentsWeighted(latents, weights);
}

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
  const { margin, top, height } = lineGeometry(size);
  const width = size - margin * 2;
  const cellWidth = width / steps;
  const latents = colors.map(hexToLatent);
  const drawBorder = cellWidth >= MIN_TILE_SIZE_FOR_BORDER;

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
    ctx.fillRect(x, top, cellWidth + 0.5, height);
    if (drawBorder) {
      ctx.strokeStyle = GRID_LINE_STYLE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, top, cellWidth, height);
    }
  }

  const nearestCx = margin + cellWidth * (nearestIndex + 0.5);
  const nearestCy = top + height / 2;
  drawPlus(ctx, nearestCx, nearestCy, Math.min(cellWidth, height) * 0.22);
}

/** Full, unmasked square tiles: a tile is included whenever its center
 * falls inside the polygon, but is always drawn as a complete square -
 * border tiles are shown in full rather than clipped to a sliver, giving
 * a blocky (not smooth-edged) approximation of the polygon at low step
 * counts. */
function renderPolygonSteps(ctx: CanvasRenderingContext2D, colors: string[], steps: number, size: number) {
  const { center, vertices, gridSize, gridMin } = polygonGeometry(colors.length, size);
  const latents = colors.map(hexToLatent);
  const tileSize = gridSize / steps;
  const drawBorder = tileSize >= MIN_TILE_SIZE_FOR_BORDER;

  let nearestCx = center;
  let nearestCy = center;
  let nearestDist = Infinity;

  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const cx = gridMin + tileSize * (col + 0.5);
      const cy = gridMin + tileSize * (row + 0.5);

      if (!pointInPolygon({ x: cx, y: cy }, vertices)) continue;

      const weights = meanValueCoordinates({ x: cx, y: cy }, vertices);
      const [r, g, b] = mixLatentsWeighted(latents, weights);
      const tileX = gridMin + tileSize * col;
      const tileY = gridMin + tileSize * row;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(tileX, tileY, tileSize + 0.5, tileSize + 0.5);
      if (drawBorder) {
        ctx.strokeStyle = GRID_LINE_STYLE;
        ctx.lineWidth = 1;
        ctx.strokeRect(tileX, tileY, tileSize, tileSize);
      }

      const dist = Math.hypot(cx - center, cy - center);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestCx = cx;
        nearestCy = cy;
      }
    }
  }

  drawPlus(ctx, nearestCx, nearestCy, Math.max(tileSize * 0.22, 4));
}
