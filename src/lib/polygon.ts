export interface Point {
  x: number;
  y: number;
}

/** Vertices of a regular n-gon centered at (cx, cy) with the given radius,
 * with one vertex pointing straight up. n=4 yields a diamond, n=6 a
 * pointy-top hexagon, etc. */
export function regularPolygonVertices(n: number, cx: number, cy: number, radius: number): Point[] {
  const vertices: Point[] = [];
  const start = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const angle = start + (i * 2 * Math.PI) / n;
    vertices.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return vertices;
}

const EPS = 1e-8;

/** Mean value coordinates (Hormann & Floater) for point p with respect to
 * a (possibly non-convex) polygon. Returns weights that sum to 1, equal 1
 * at the matching vertex and vary smoothly across the interior. Used to
 * blend per-vertex colors across the polygon's fill. */
export function meanValueCoordinates(p: Point, vertices: Point[]): number[] {
  const n = vertices.length;
  const s = vertices.map((v) => ({ x: v.x - p.x, y: v.y - p.y }));
  const r = s.map((si) => Math.hypot(si.x, si.y));

  for (let i = 0; i < n; i++) {
    if (r[i] < EPS) {
      const w = new Array(n).fill(0);
      w[i] = 1;
      return w;
    }
  }

  const tanHalf = new Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = s[i].x * s[j].y - s[i].y * s[j].x;
    const dot = s[i].x * s[j].x + s[i].y * s[j].y;

    if (Math.abs(cross) < EPS && dot < 0) {
      const w = new Array(n).fill(0);
      const sum = r[i] + r[j];
      w[i] = r[j] / sum;
      w[j] = r[i] / sum;
      return w;
    }

    tanHalf[i] = cross !== 0 ? (r[i] * r[j] - dot) / cross : 0;
  }

  const w = new Array(n);
  let wSum = 0;
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const wi = (tanHalf[prev] + tanHalf[i]) / r[i];
    w[i] = wi;
    wSum += wi;
  }
  for (let i = 0; i < n; i++) w[i] /= wSum;
  return w;
}

export function oneHotWeights(n: number, index: number): number[] {
  const weights = new Array(n).fill(0);
  weights[index] = 1;
  return weights;
}

export interface FanTriangle {
  points: [Point, Point, Point];
  /** Weight vectors at each of the 3 corners, in the same order as `points`. */
  cornerWeights: [number[], number[], number[]];
}

export interface FanLatticePoint {
  point: Point;
  weights: number[];
}

interface FanWedge {
  v1: Point;
  v2: Point;
  w1: number[];
  w2: number[];
}

/** Fan-triangulates the n-gon into n wedges from its centroid - the shared
 * setup behind both fanTriangleMesh (a filled mosaic) and fanLatticePoints
 * (discrete markers, à la a ternary plot's scatter of dots). */
function fanWedges(vertices: Point[]): { centroid: Point; centroidWeights: number[]; wedges: FanWedge[] } {
  const n = vertices.length;
  const centroid: Point = {
    x: vertices.reduce((sum, v) => sum + v.x, 0) / n,
    y: vertices.reduce((sum, v) => sum + v.y, 0) / n,
  };
  const centroidWeights = new Array(n).fill(1 / n);
  const wedges: FanWedge[] = vertices.map((v1, i) => ({
    v1,
    v2: vertices[(i + 1) % n],
    w1: oneHotWeights(n, i),
    w2: oneHotWeights(n, (i + 1) % n),
  }));
  return { centroid, centroidWeights, wedges };
}

/** A point at barycentric position (i, j, steps-i-j) within one wedge
 * (centroid, wedge.v1, wedge.v2) - exact at the wedge's own vertices (i=steps
 * or j=steps), which is what guarantees polygon vertices land on exact
 * lattice points instead of the near-miss a Cartesian pixel/tile grid gives. */
function wedgeLatticePoint(
  wedge: FanWedge,
  centroid: Point,
  centroidWeights: number[],
  i: number,
  j: number,
  steps: number,
): FanLatticePoint {
  const k = steps - i - j;
  const fi = i / steps;
  const fj = j / steps;
  const fk = k / steps;
  return {
    point: {
      x: centroid.x * fk + wedge.v1.x * fi + wedge.v2.x * fj,
      y: centroid.y * fk + wedge.v1.y * fi + wedge.v2.y * fj,
    },
    weights: centroidWeights.map((cw, idx) => cw * fk + wedge.w1[idx] * fi + wedge.w2[idx] * fj),
  };
}

/** Generalizes a ternary plot's "build the grid in weight-space" trick
 * (exact at n=3 since a triangle already is a 2-simplex) to any n: fan-
 * triangulates the n-gon into n wedges from its centroid, then subdivides
 * each wedge (centroid, vertex i, vertex i+1) into a `steps`-deep
 * barycentric lattice. Every lattice point's weight vector is a linear
 * combination of the centroid (average of all n colors) and the two wedge
 * vertices (one-hot), computed directly from its lattice position - so a
 * polygon's own vertices are always exact lattice points (weight 1 there),
 * unlike sampling a Cartesian pixel/tile grid and converting to weights
 * after the fact, which almost never lands exactly on a vertex. */
export function fanTriangleMesh(vertices: Point[], steps: number): FanTriangle[] {
  const { centroid, centroidWeights, wedges } = fanWedges(vertices);
  const triangles: FanTriangle[] = [];

  for (const wedge of wedges) {
    const latticePoint = (i: number, j: number) => wedgeLatticePoint(wedge, centroid, centroidWeights, i, j, steps);

    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps - i; j++) {
        const a = latticePoint(i, j);
        const b = latticePoint(i + 1, j);
        const c = latticePoint(i, j + 1);
        triangles.push({ points: [a.point, b.point, c.point], cornerWeights: [a.weights, b.weights, c.weights] });

        if (i + j + 2 <= steps) {
          const d = latticePoint(i + 1, j + 1);
          triangles.push({ points: [b.point, d.point, c.point], cornerWeights: [b.weights, d.weights, c.weights] });
        }
      }
    }
  }

  return triangles;
}

/** Just the fan lattice's points (no triangulated faces) - for plotting each
 * one as a small fixed-size marker, the way a ternary plot places a dot at
 * every weight-space grid point rather than filling the plane between them.
 * Shared points between adjacent wedges (the centroid, and each spoke from
 * it to a vertex) are produced once per wedge; since duplicates carry the
 * same weights, drawing them twice is harmless. */
export function fanLatticePoints(vertices: Point[], steps: number): FanLatticePoint[] {
  const { centroid, centroidWeights, wedges } = fanWedges(vertices);
  const points: FanLatticePoint[] = [];

  for (const wedge of wedges) {
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps - i; j++) {
        points.push(wedgeLatticePoint(wedge, centroid, centroidWeights, i, j, steps));
      }
    }
  }

  return points;
}

/** Which corner's weights best represent a fan triangle's flat fill: exact
 * one-hot corners (touching a real polygon vertex) always win so vertex
 * tiles stay pure, otherwise the 3 corners' weights are averaged. */
export function fanTriangleFillWeights(cornerWeights: [number[], number[], number[]]): number[] {
  const pureCorner = cornerWeights.find((w) => w.some((v) => v === 1));
  if (pureCorner) return pureCorner;

  const n = cornerWeights[0].length;
  const avg = new Array(n).fill(0);
  for (const w of cornerWeights) for (let i = 0; i < n; i++) avg[i] += w[i] / cornerWeights.length;
  return avg;
}

export function pointInPolygon(p: Point, vertices: Point[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    const intersects =
      vi.y > p.y !== vj.y > p.y && p.x < ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
