import { useState, useEffect, useRef } from "react";
import { meanValueCoordinates, pointInPolygon, regularPolygonVertices, type Point } from "../lib/polygon";
import { hexToLatent, mixLatentsWeighted, rgbToHex, type RgbTuple } from "../lib/mix";
import { rgbToOklabAB, rgbToOklch } from "../lib/color";

interface PolygonSwatchProps {
  colors: string[];
  steps: number;
  tint: number;
  size: number;
  /** The OKLab plane's geometric-center point (plain average of the
   * selected colors' OKLab a/b - the same point regardless of which wheel
   * view is currently shown), so the swatch's "+" can mark whichever tile's
   * actual pigment mix comes closest to it, instead of whichever tile sits
   * at the polygon's spatial center. */
  targetAB: { a: number; b: number } | null;
}

interface HoverState {
  x: number;
  y: number;
  hex: string;
  oklch: { l: number; c: number; h: number };
}

const clipboardSupported =
  typeof navigator !== "undefined" && !!navigator.clipboard?.write && typeof window.ClipboardItem !== "undefined";

const BLACK_LATENT = hexToLatent("#000000");
const WHITE_LATENT = hexToLatent("#FFFFFF");

export function PolygonSwatch({ colors, steps, tint, size, targetAB }: PolygonSwatchProps) {
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
      renderLineSteps(ctx, colors, steps, tint, size, targetAB);
      return;
    }

    renderPolygonSteps(ctx, colors, steps, tint, size, targetAB);
  }, [colors, steps, tint, size, targetAB]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rgb = colors.length >= 2 ? colorAtPoint(colors, steps, tint, size, x, y) : null;
    setHover(rgb ? { x, y, hex: rgbToHex(rgb), oklch: rgbToOklch(rgb) } : null);
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
          <div className="swatch-hover-hex">{hover.hex}</div>
          <div className="swatch-hover-oklch">
            L {(hover.oklch.l * 100).toFixed(0)}% · C {hover.oklch.c.toFixed(3)} · H {hover.oklch.h.toFixed(0)}°
          </div>
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
// Fraction of the canvas the shape's own bounding box fills - not the
// circle that circumscribes it, so odd-sided shapes (triangle, pentagon)
// don't leave a dead margin below their flat base.
const FILL_FRACTION = 0.92;

/** 0-5 shades from black to the pure mix; 5-10 tints from the pure mix to
 * white. Weights sum to 1 so this composes with the vertex weights below
 * into a single latent-space mix. */
function tintWeights(tint: number): { original: number; black: number; white: number } {
  if (tint <= 5) {
    const original = tint / 5;
    return { original, black: 1 - original, white: 0 };
  }
  const white = (tint - 5) / 5;
  return { original: 1 - white, black: 0, white };
}

function lineGeometry(size: number) {
  const margin = size * 0.06;
  const height = size * 0.5;
  const top = (size - height) / 2;
  const width = size - margin * 2;
  return { margin, top, height, width };
}

/** Lays the polygon out so its own bounding box - not its circumscribed
 * circle - fills FILL_FRACTION of the canvas, centered. Returns both the
 * canvas-space vertices and circleCenter, the point equidistant from all
 * vertices (where mean value coordinates give every vertex equal weight);
 * for an odd-sided polygon this is not the same as the bbox's center, so
 * it's tracked separately for the "geometric center" swatch marker. */
function polygonGeometry(n: number, size: number) {
  const unitVertices = regularPolygonVertices(n, 0, 0, 1);
  const minX = Math.min(...unitVertices.map((v) => v.x));
  const maxX = Math.max(...unitVertices.map((v) => v.x));
  const minY = Math.min(...unitVertices.map((v) => v.y));
  const maxY = Math.max(...unitVertices.map((v) => v.y));
  const bboxCx = (minX + maxX) / 2;
  const bboxCy = (minY + maxY) / 2;
  const scale = (size * FILL_FRACTION) / Math.max(maxX - minX, maxY - minY);

  const toCanvas = (p: Point): Point => ({
    x: size / 2 + (p.x - bboxCx) * scale,
    y: size / 2 + (p.y - bboxCy) * scale,
  });

  const vertices = unitVertices.map(toCanvas);
  const circleCenter = toCanvas({ x: 0, y: 0 });
  const gridSize = size * FILL_FRACTION;
  const gridMin = size / 2 - gridSize / 2;

  return { vertices, circleCenter, gridSize, gridMin };
}

/** Looks up the exact color rendered at a canvas point, using the same
 * tile geometry as the render functions below, for the hover tooltip. */
function colorAtPoint(colors: string[], steps: number, tint: number, size: number, x: number, y: number): RgbTuple | null {
  const latents = colors.map(hexToLatent);
  const { original, black, white } = tintWeights(tint);

  if (colors.length === 2) {
    const { margin, top, height, width } = lineGeometry(size);
    if (x < margin || x > margin + width || y < top || y > top + height) return null;
    const cellWidth = width / steps;
    const i = Math.min(steps - 1, Math.max(0, Math.floor((x - margin) / cellWidth)));
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    return mixLatentsWeighted(
      [...latents, BLACK_LATENT, WHITE_LATENT],
      [(1 - t) * original, t * original, black, white],
    );
  }

  const { vertices, gridSize, gridMin } = polygonGeometry(colors.length, size);
  const tileSize = gridSize / steps;
  const col = Math.floor((x - gridMin) / tileSize);
  const row = Math.floor((y - gridMin) / tileSize);
  if (col < 0 || col >= steps || row < 0 || row >= steps) return null;

  const tileCenter: Point = { x: gridMin + tileSize * (col + 0.5), y: gridMin + tileSize * (row + 0.5) };
  if (!pointInPolygon(tileCenter, vertices)) return null;

  const weights = meanValueCoordinates(tileCenter, vertices);
  return mixLatentsWeighted(
    [...latents, BLACK_LATENT, WHITE_LATENT],
    [...weights.map((w) => w * original), black, white],
  );
}

function colorDistanceSq(a: { a: number; b: number }, b: { a: number; b: number }): number {
  const da = a.a - b.a;
  const db = a.b - b.b;
  return da * da + db * db;
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

function renderLineSteps(
  ctx: CanvasRenderingContext2D,
  colors: string[],
  steps: number,
  tint: number,
  size: number,
  targetAB: { a: number; b: number } | null,
) {
  const { margin, top, height } = lineGeometry(size);
  const width = size - margin * 2;
  const cellWidth = width / steps;
  const latentsWithBW = [...colors.map(hexToLatent), BLACK_LATENT, WHITE_LATENT];
  const { original, black, white } = tintWeights(tint);
  const drawBorder = cellWidth >= MIN_TILE_SIZE_FOR_BORDER;

  let nearestIndex = 0;
  let nearestDist = Infinity;

  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0.5 : i / (steps - 1);

    const rgb = mixLatentsWeighted(latentsWithBW, [(1 - t) * original, t * original, black, white]);
    const dist = targetAB ? colorDistanceSq(rgbToOklabAB(rgb), targetAB) : Math.abs(t - 0.5);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIndex = i;
    }

    const [r, g, b] = rgb;
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
function renderPolygonSteps(
  ctx: CanvasRenderingContext2D,
  colors: string[],
  steps: number,
  tint: number,
  size: number,
  targetAB: { a: number; b: number } | null,
) {
  const { vertices, circleCenter, gridSize, gridMin } = polygonGeometry(colors.length, size);
  const latentsWithBW = [...colors.map(hexToLatent), BLACK_LATENT, WHITE_LATENT];
  const { original, black, white } = tintWeights(tint);
  const tileSize = gridSize / steps;
  const drawBorder = tileSize >= MIN_TILE_SIZE_FOR_BORDER;

  let nearestCx = circleCenter.x;
  let nearestCy = circleCenter.y;
  let nearestDist = Infinity;

  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const cx = gridMin + tileSize * (col + 0.5);
      const cy = gridMin + tileSize * (row + 0.5);

      if (!pointInPolygon({ x: cx, y: cy }, vertices)) continue;

      const weights = meanValueCoordinates({ x: cx, y: cy }, vertices);
      const rgb = mixLatentsWeighted(latentsWithBW, [...weights.map((w) => w * original), black, white]);
      const [r, g, b] = rgb;
      const tileX = gridMin + tileSize * col;
      const tileY = gridMin + tileSize * row;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(tileX, tileY, tileSize + 0.5, tileSize + 0.5);
      if (drawBorder) {
        ctx.strokeStyle = GRID_LINE_STYLE;
        ctx.lineWidth = 1;
        ctx.strokeRect(tileX, tileY, tileSize, tileSize);
      }

      const dist = targetAB
        ? colorDistanceSq(rgbToOklabAB(rgb), targetAB)
        : Math.hypot(cx - circleCenter.x, cy - circleCenter.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestCx = cx;
        nearestCy = cy;
      }
    }
  }

  drawPlus(ctx, nearestCx, nearestCy, Math.max(tileSize * 0.22, 4));
}
