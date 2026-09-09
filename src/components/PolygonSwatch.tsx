import { useState, useEffect, useMemo, useRef } from "react";
import {
  fanLatticePoints,
  fanTriangleFillWeights,
  fanTriangleMesh,
  meanValueCoordinates,
  oneHotWeights,
  pointInPolygon,
  regularPolygonVertices,
  type Point,
} from "../lib/polygon";
import { hexToLatent, rgbToHex, type RgbTuple } from "../lib/mix";
import { rgbToOklabAB, rgbToOklch } from "../lib/color";
import { applyPerceptualTint, convergedExtreme, tintRangeForColors } from "../lib/tint";

export type GridMode = "squares" | "fan" | "dots";

interface PolygonSwatchProps {
  colors: string[];
  steps: number;
  tint: number;
  size: number;
  /** "squares" clips a Cartesian tile grid to the polygon, then snaps only
   * the tile nearest each vertex to a pure color. "fan" builds the grid
   * directly in weight-space (see fanTriangleMesh) so every vertex is an
   * exact lattice point with no snapping needed. "dots" plots that same
   * weight-space lattice (see fanLatticePoints) as hexagon markers sized to
   * tile edge-to-edge - a honeycomb, not a filled triangle mosaic - so each
   * hexagon shrinks as `steps` rises to keep fitting the fixed-size canvas
   * without gaps or overlap. Ignored for the 2-color line case, which is
   * already exact at both ends. */
  gridMode: GridMode;
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

export function PolygonSwatch({ colors, steps, tint, size, targetAB, gridMode }: PolygonSwatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const tintPure = useMemo(() => tintRangeForColors(colors).pure, [colors]);
  // Populated by renderFanSteps/renderDotsSteps so hover hit-testing can
  // reuse the exact geometry/colors just drawn, instead of recomputing it.
  const fanMeshRef = useRef<{ points: [Point, Point, Point]; rgb: RgbTuple }[]>([]);
  const dotsRef = useRef<{ x: number; y: number; radius: number; rgb: RgbTuple }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    if (colors.length < 2) return;

    if (colors.length === 2) {
      renderLineSteps(ctx, colors, steps, tint, tintPure, size, targetAB);
      return;
    }

    if (gridMode === "fan") {
      fanMeshRef.current = renderFanSteps(ctx, colors, steps, tint, tintPure, size, targetAB);
      return;
    }

    if (gridMode === "dots") {
      dotsRef.current = renderDotsSteps(ctx, colors, steps, tint, tintPure, size, targetAB);
      return;
    }

    renderPolygonSteps(ctx, colors, steps, tint, tintPure, size, targetAB);
  }, [colors, steps, tint, tintPure, size, targetAB, gridMode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rgb =
      colors.length < 2
        ? null
        : colors.length >= 3 && gridMode === "fan"
          ? colorAtPointFan(fanMeshRef.current, x, y)
          : colors.length >= 3 && gridMode === "dots"
            ? colorAtPointDots(dotsRef.current, x, y)
            : colorAtPoint(colors, steps, tint, tintPure, size, x, y);
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
function colorAtPoint(
  colors: string[],
  steps: number,
  tint: number,
  tintPure: number,
  size: number,
  x: number,
  y: number,
): RgbTuple | null {
  const latents = colors.map(hexToLatent);

  if (colors.length === 2) {
    const { margin, top, height, width } = lineGeometry(size);
    if (x < margin || x > margin + width || y < top || y > top + height) return null;
    const cellWidth = width / steps;
    const i = Math.min(steps - 1, Math.max(0, Math.floor((x - margin) / cellWidth)));
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    return applyPerceptualTint(latents, [1 - t, t], tint, tintPure);
  }

  const { vertices, gridSize, gridMin } = polygonGeometry(colors.length, size);
  const tileSize = gridSize / steps;
  const col = Math.floor((x - gridMin) / tileSize);
  const row = Math.floor((y - gridMin) / tileSize);
  if (col < 0 || col >= steps || row < 0 || row >= steps) return null;

  const tileCenter: Point = { x: gridMin + tileSize * (col + 0.5), y: gridMin + tileSize * (row + 0.5) };
  if (!pointInPolygon(tileCenter, vertices)) return null;

  const pureCornerTiles = nearestTilePerVertex(steps, gridMin, tileSize, vertices);
  const vertexIndex = pureCornerTiles.get(row * steps + col);
  const weights = vertexIndex !== undefined ? oneHotWeights(latents.length, vertexIndex) : meanValueCoordinates(tileCenter, vertices);
  return applyPerceptualTint(latents, weights, tint, tintPure);
}

/** For each polygon vertex, finds the closest rendered tile (by center
 * distance, among tiles whose center falls inside the polygon) - so that
 * tile can be forced to the exact pigment color instead of its natural
 * mean-value-coordinate blend. A tile's own MVC weight for its "home"
 * vertex is usually well under 1 (nowhere near pure) since tile centers
 * don't land exactly on a vertex, so without this no swatch ever shows a
 * truly unmixed selected pigment. Keyed by `row * steps + col`. */
function nearestTilePerVertex(steps: number, gridMin: number, tileSize: number, vertices: Point[]): Map<number, number> {
  const nearestByVertex = new Map<number, { tileKey: number; distSq: number }>();

  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const cx = gridMin + tileSize * (col + 0.5);
      const cy = gridMin + tileSize * (row + 0.5);
      if (!pointInPolygon({ x: cx, y: cy }, vertices)) continue;

      const tileKey = row * steps + col;
      vertices.forEach((v, i) => {
        const distSq = (cx - v.x) ** 2 + (cy - v.y) ** 2;
        const current = nearestByVertex.get(i);
        if (!current || distSq < current.distSq) nearestByVertex.set(i, { tileKey, distSq });
      });
    }
  }

  const tileToVertex = new Map<number, number>();
  for (const [vertexIndex, { tileKey }] of nearestByVertex) tileToVertex.set(tileKey, vertexIndex);
  return tileToVertex;
}

function pointInTriangle(p: Point, [a, b, c]: [Point, Point, Point]): boolean {
  const cross = (o: Point, u: Point, v: Point) => (u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x);
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** Looks up the color of whichever fan triangle contains (x, y), reusing
 * the mesh renderFanSteps just drew rather than recomputing fan geometry. */
function colorAtPointFan(mesh: { points: [Point, Point, Point]; rgb: RgbTuple }[], x: number, y: number): RgbTuple | null {
  const p: Point = { x, y };
  for (const tri of mesh) {
    if (pointInTriangle(p, tri.points)) return tri.rgb;
  }
  return null;
}

/** Looks up the color of whichever dot marker (x, y) falls within, reusing
 * the markers renderDotsSteps just drew. Returns null in the gaps between
 * markers, same as hovering empty space on a real scatter plot. */
function colorAtPointDots(dots: { x: number; y: number; radius: number; rgb: RgbTuple }[], x: number, y: number): RgbTuple | null {
  let nearest: { rgb: RgbTuple; distSq: number } | null = null;
  for (const dot of dots) {
    const distSq = (x - dot.x) ** 2 + (y - dot.y) ** 2;
    if (distSq <= (dot.radius * 1.6) ** 2 && (!nearest || distSq < nearest.distSq)) {
      nearest = { rgb: dot.rgb, distSq };
    }
  }
  return nearest?.rgb ?? null;
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

/** A white-outlined dark dot - same visual language as drawPlus, so it
 * reads equally well over both pure black and pure white tiles - marking a
 * tile whose color has fully converged (round-tripped to exact #000000 or
 * #FFFFFF), since a merely very-dark or very-light tile looks identical at
 * a glance. */
function drawConvergedDot(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
  ctx.restore();
}

function renderLineSteps(
  ctx: CanvasRenderingContext2D,
  colors: string[],
  steps: number,
  tint: number,
  tintPure: number,
  size: number,
  targetAB: { a: number; b: number } | null,
) {
  const { margin, top, height } = lineGeometry(size);
  const width = size - margin * 2;
  const cellWidth = width / steps;
  const latents = colors.map(hexToLatent);
  const drawBorder = cellWidth >= MIN_TILE_SIZE_FOR_BORDER;

  let nearestIndex = 0;
  let nearestDist = Infinity;

  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0.5 : i / (steps - 1);

    const rgb = applyPerceptualTint(latents, [1 - t, t], tint, tintPure);
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

    if (convergedExtreme(rgb)) {
      drawConvergedDot(ctx, x + cellWidth / 2, top + height / 2, Math.min(cellWidth, height) * 0.1);
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
  tintPure: number,
  size: number,
  targetAB: { a: number; b: number } | null,
) {
  const { vertices, circleCenter, gridSize, gridMin } = polygonGeometry(colors.length, size);
  const latents = colors.map(hexToLatent);
  const tileSize = gridSize / steps;
  const drawBorder = tileSize >= MIN_TILE_SIZE_FOR_BORDER;
  const pureCornerTiles = nearestTilePerVertex(steps, gridMin, tileSize, vertices);

  let nearestCx = circleCenter.x;
  let nearestCy = circleCenter.y;
  let nearestDist = Infinity;

  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const cx = gridMin + tileSize * (col + 0.5);
      const cy = gridMin + tileSize * (row + 0.5);

      if (!pointInPolygon({ x: cx, y: cy }, vertices)) continue;

      const vertexIndex = pureCornerTiles.get(row * steps + col);
      const weights =
        vertexIndex !== undefined ? oneHotWeights(latents.length, vertexIndex) : meanValueCoordinates({ x: cx, y: cy }, vertices);
      const rgb = applyPerceptualTint(latents, weights, tint, tintPure);
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

      if (convergedExtreme(rgb)) {
        drawConvergedDot(ctx, cx, cy, Math.max(tileSize * 0.1, 2));
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

/** Fan-triangulation grid: the polygon is triangulated into wedges from its
 * centroid, then each wedge is subdivided into a `steps`-deep barycentric
 * lattice (see fanTriangleMesh) - vertices are always exact lattice points,
 * so no post-hoc "snap the nearest tile" fix is needed for pure corners. */
function renderFanSteps(
  ctx: CanvasRenderingContext2D,
  colors: string[],
  steps: number,
  tint: number,
  tintPure: number,
  size: number,
  targetAB: { a: number; b: number } | null,
): { points: [Point, Point, Point]; rgb: RgbTuple }[] {
  const { vertices, circleCenter } = polygonGeometry(colors.length, size);
  const latents = colors.map(hexToLatent);
  const triangles = fanTriangleMesh(vertices, steps);
  const drawBorder = size / steps >= MIN_TILE_SIZE_FOR_BORDER;

  const mesh: { points: [Point, Point, Point]; rgb: RgbTuple }[] = [];
  let nearestCx = circleCenter.x;
  let nearestCy = circleCenter.y;
  let nearestDist = Infinity;

  for (const tri of triangles) {
    const weights = fanTriangleFillWeights(tri.cornerWeights);
    const rgb = applyPerceptualTint(latents, weights, tint, tintPure);
    mesh.push({ points: tri.points, rgb });

    const [r, g, b] = rgb;
    const [p0, p1, p2] = tri.points;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    if (drawBorder) {
      ctx.strokeStyle = GRID_LINE_STYLE;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const cx = (p0.x + p1.x + p2.x) / 3;
    const cy = (p0.y + p1.y + p2.y) / 3;
    if (convergedExtreme(rgb)) {
      drawConvergedDot(ctx, cx, cy, Math.max((size / steps) * 0.1, 2));
    }

    const dist = targetAB ? colorDistanceSq(rgbToOklabAB(rgb), targetAB) : Math.hypot(cx - circleCenter.x, cy - circleCenter.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestCx = cx;
      nearestCy = cy;
    }
  }

  drawPlus(ctx, nearestCx, nearestCy, Math.max((size / steps) * 0.22, 4));
  return mesh;
}

/** Fan lattice rendered as discrete hexagon markers that tile edge-to-edge
 * (see fanLatticePoints) - the way a real hex-grid honeycomb tessellates,
 * rather than a filled triangle mosaic. Adjacent lattice points along the
 * two centroid-to-vertex directions are always exactly `circumradius/steps`
 * apart (equal by construction for a regular polygon), and centers that far
 * apart tile without gaps or overlap when each hexagon's own circumradius
 * is that spacing divided by sqrt(3) - the same fixed relationship the
 * Observable notebook's own marker-size formula (r = w/(n+1)/2, for a fixed
 * plot width w) uses: the canvas stays the fixed swatch size every other
 * grid mode uses, and it's each hexagon that shrinks as `steps` rises,
 * fitting progressively more (never overlapping) tiles into it. */
function renderDotsSteps(
  ctx: CanvasRenderingContext2D,
  colors: string[],
  steps: number,
  tint: number,
  tintPure: number,
  size: number,
  targetAB: { a: number; b: number } | null,
): { x: number; y: number; radius: number; rgb: RgbTuple }[] {
  const { vertices, circleCenter } = polygonGeometry(colors.length, size);
  const latents = colors.map(hexToLatent);
  const lattice = fanLatticePoints(vertices, steps);
  const circumradius = Math.hypot(vertices[0].x - circleCenter.x, vertices[0].y - circleCenter.y);
  // A hair under the exact touching radius so antialiasing never shows a
  // 1px overlap seam between neighboring hexagons.
  const radius = Math.max(1.5, (circumradius / steps / Math.sqrt(3)) * 0.98);

  const dots: { x: number; y: number; radius: number; rgb: RgbTuple }[] = [];
  let nearestCx = circleCenter.x;
  let nearestCy = circleCenter.y;
  let nearestDist = Infinity;

  for (const { point, weights } of lattice) {
    const rgb = applyPerceptualTint(latents, weights, tint, tintPure);
    dots.push({ x: point.x, y: point.y, radius, rgb });

    const [r, g, b] = rgb;
    const marker = regularPolygonVertices(6, point.x, point.y, radius);
    ctx.beginPath();
    marker.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
    ctx.closePath();
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();

    const dist = targetAB
      ? colorDistanceSq(rgbToOklabAB(rgb), targetAB)
      : Math.hypot(point.x - circleCenter.x, point.y - circleCenter.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestCx = point.x;
      nearestCy = point.y;
    }
  }

  drawPlus(ctx, nearestCx, nearestCy, Math.max(radius * 1.4, 4));
  return dots;
}
