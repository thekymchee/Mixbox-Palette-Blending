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
