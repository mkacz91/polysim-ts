// Path Simplifier
// ===============
//
// The main idea of the simplification algorithm is to find the shortest route
// (we use _route_ instead of _path_ to avoid ambiguity with the polyline) in
// the (unweighted) _admissible segment graph_. The vertices of this graph are
// the path points themselves. Two points, with indices _i_ and _j_, _i_ < _j_,
// are connected if they fulfill the following conditions:
//
//   1. The subpath _S_ spanning between _i_ and _j_, inclusive, is _simple_,
//      i.e., has no self intersections.
//
//   2. The maximal distance between any point of the subpath _S_, and the
//      optimal linear approximation _L_ of path _S_, does not exceed the
//      threshold.
//
//   3. Point _i_ is a pioneer with respect to line _L_ among _S_.
//
//   4. Point _j_ is a pioneer with respect to line _L_ among _S_.
//
// After the shortest route is found, the simplified path is made up of the
// linear approximations of subpaths that correspond to the route's edges.
// For details, see: `PathSimplifier.getSimplified()`.
//
// But still some definitions remain unclear. By _optimal linear approximation_
// of a point set we would normally understand a line which has the smallest
// maximal distance to the points. But since finding such line is
// computationally hard, we use a line that is optimal in the _least squares_
// sense as a fair approximation. After linear preprocessing of a point
// sequence, such lines can be found in constant time for any subsequence. This
// is implemented by [`LineFitter`](LineFitter.html).
//
// For a set of points _S_, and a line _L_, point _p_ is a _pioneer_, if it
// belongs to _S_ and it's projection on _L_ is the most external among
// projection of all other points. In other words, the projections of other
// elements of _S_ reside on one side of the _p_'s projection. Typically, there
// are two pioneers for given _S_ and _L_.
//
// A pioneer always belongs to the _convex hull_ of it's set. Moreover, if
// we have such hull for our disposition, we can verify in constant time whether
// a given point belonging to that hull is a pioneer. For details, refer to
// `PathSimplifier.isPioneer()`. Moreover, convex hull for simple polygonal
// lines can be computed online in linear time, as is done by
// [`SimplePathHull`](SimplePathHull.html).
//
// To maintain a simplified path online, as the points arrive, the strategy is
// to take the newest point, say _j_, and for, _i_ = _j_ - 1, _j_ - 2, ...,
// 0, check if _i_ and _j_ can be connected. Along the way, seek the shothest
// route using a dynamic programming approach.
//
// From what was already said, it follows that conditions 1, 3, and 4, can be
// resolved in constant time for each _i_. The only problem remains for the
// 2nd condition. But the approximation of the maximal distance can still be
// effectively computed, using the fact, that all points lie in small radius
// from the last optimal line. This task is handled by `ErrorBox`, later in this
// file.
//
// Also note, that if any of the conditions: 1, 2, 4, fails, no further iteration
// is necessary, because we will never recover. That said, the resulting online
// step is pessimistically linear in time, but the practical complexity is much
// better.

import { Line } from "./line";
import { LineFitter } from "./line_fitter";
import { Geometry, PVector, max, min } from "./math";
import { IPathListener, Path } from "./path";
import { SimplePathHull, SimplePathHullNode } from "./simple_path_hull";

// PathSimplifier Class
// ----------------------
//
// Maintains a simplified version of path. Can be attached to a `Path` object
// as a listener and then adjusts the simplified path online on any
// modification.
export class PathSimplifier implements IPathListener {
  // The original path
  private path: Path;

  // Length of the path being simplified. Normally this should be equivalent to
  // `path.length()` but in the initial steps, when starting with a non empty
  // path, it may be smaller, in order to artificially simulate the construction
  // process.
  private pathLength = 0;

  // `LineFitter` to retrieve information about optimal linear approximation of
  // selected path segments. It is registered as listener to `path` before this
  // `PathSimplifier`, so when we receive a path change callback, the fitter can
  // be assumed to already be in the newest state.
  readonly fitter: LineFitter;

  // Additional information stored for the points of simplified path. The
  // indexing of `tags` is identical to that of `path`'s.
  private readonly tags: PointTag[] = [];

  // The maximal allowed squared distance between original path points and the
  // simplified path.
  private readonly thresholdSq;

  // List of events that occured for each considered `i` during last
  // `onAddPoint()`. Used for visualization purposes and debugging.
  public readonly trace: Event[] = [];

  // Creates a simplifier attached to given path and using given threshold as
  // the maximal distance between the path points and the simplified path.
  constructor(path: Path, threshold: number) {
    this.path = path;
    this.fitter = new LineFitter(path);
    this.thresholdSq = threshold * threshold;
    path.addListener(this);

    // We artificially invoke the modification callbacks to simulate the
    // construction steps that have taken place before this simplifier was
    // created
    this.onClear(path);
    for (const p of path) {
      this.onAddPoint(path, p);
    }
  }

  onClear(_: Path): void {
    this.pathLength = 0;
    this.tags.length = 0;
  }

  onAddPoint(path: Path, p: PVector): void {
    this.trace.length = 0;
    this.trace.push('accept');
    const j = this.pathLength++;
    const pj = p; // equivalent to path.point(j)
    const errorBox = new ErrorBox(this.fitter.fitLine(j, j), pj);
    const hull = new SimplePathHull();
    const nj = hull.offer(pj);

    if (j === 0) {
      this.tags.push({ dist: 0, next: -1, cut: false });
      return;
    }

    let next = j - 1;
    let dist = this.tags[next].dist;

    for (let i = j - 1; i >= 0; --i) {
      const pi = path.point(i);
      const ti = this.tags[i];

      // Stop if the segment starting at `i` intersects with any other segment along
      // the path to `j`, because `hull` only handles simple polylines.
      if (
        ti.cut ||
        i < j - 2 &&
        Geometry.intersect(pi, path.point(i + 1), path.point(j - 1), pj)
      ) {
        ti.cut = true;
        this.trace.push('cut');
        break;
      }

      // Compute the optimal line approximation along with the maximal error
      // approximation and stop if the threshold is violated
      const line = this.fitter.fitLine(i, j);
      errorBox.extend(line, pi);
      if (errorBox.error() > this.thresholdSq) {
        this.trace.push('threshold');
        break;
      }

      // Consider the edge between `i` and `j` as admissible, if both points are
      // pioneers with respect to the optimal line. If the `j`th point is not
      // a pioneer, then it will never get back to being one, so we can break
      // right here.
      const ni = hull.offer(pi);
      if (!ni || !PathSimplifier.isPioneer(line, ni)) {
        this.trace.push('pioneer_weak');
        continue;
      }
      if (!PathSimplifier.isPioneer(line, nj!)) {
        this.trace.push('pioneer_strong');
        break;
      }

      this.trace.push('accept');
      if (ti.dist < dist) {
        next = i;
        dist = ti.dist;
      }
    }

    this.tags.push({ dist: dist + 1, next, cut: false });
  }

  // For a given line an a convex hull point, determines whether that point is
  // a pioneer with respect to that line
  private static isPioneer(line: Line, n: SimplePathHullNode): boolean {
    if (!n.isValid)
      return false;
    // For a hull point, it suffices to check whether the projections of its
    // adjecent hull points lie on the same side of its projection
    const t = line.tangent();
    const dp = PVector.dot(t, PVector.span(n.pos, n.prev.pos));
    const dn = PVector.dot(t, PVector.span(n.pos, n.next.pos));
    return dp * dn >= 0;
  }

  // Retrieves the simplified path
  getSimplified(): Path {
    if (this.pathLength <= 1)
      return this.path;

    const path = this.path, tags = this.tags, fitter = this.fitter;
    const result = new Path();

    // We go along the shortest route and take the line approximations of the
    // subpaths corresponding to passed edges. We add intersectionf of
    // subsequent lines as points of the simplified path. The first and the last
    // point are projections of the first and last point of the original path
    // onto the corresponding lines.
    let j = this.pathLength - 1;
    let i = tags[j].next;
    let line = fitter.fitLine(i, j);
    result.addPoint(Geometry.project(path.point(j), line));
    while (i != 0) {
      j = i;
      i = tags[j].next;
      const pj = path.point(j);
      const prevLine = line;
      line = fitter.fitLine(i, j);
      const p = Geometry.intersection(line, prevLine);
      // **TODO:** If the lines are parallel or some other crazy stuff, I can't
      // seem to find any good solution without violating the threshold
      // condition. Honestly, just adding `p`, only guarantees that we are within two
      // threshold of the original path.
      if (p.isSingular() || PVector.distSq(p, pj) > 4 * this.thresholdSq)
        result.addPoint(pj);
      else
        result.addPoint(p);
    }

    result.addPoint(Geometry.project(path.point(0), line));
    return result;
  }
}

// Additional information stored for each point of the original path
type PointTag = {
  // Distance to the starting point in the admissible segment graph
  dist: number;

  // Index of the next vertex along the shortest path in the admissible
  // segment graph
  next: number;

  // Determines whether the segment starting in this point takes part in an
  // intersection with another non-adjecent segment later in the path.
  cut: boolean;
}

// Possible events that may occur during addmisibility checking of segment
// `ij` during `onAddPoint()`. Used for visualization purposes and
// debugging.
type Event
  // The segment obeys all rules from 1 to 4
  = 'accept'
  // Point `i` takes part in an intesection (rule 1 violated)
  | 'cut'
  // The distance to optimal line exceeds threshold (rule 2 violated)
  | 'threshold'
  // Point `i` is not a pioneer (rule 3 violated)
  | 'pioneer_weak'
  // Point `j` is not a pioneer (rule 4 violated)
  | 'pioneer_strong';

// ErrorBox Class
// --------------
//
// Manages a rectangle defined in line coordinates. It is used as a bound for
// positions of points of a given set. For detailed explanation of line
// coordinates, see: [`Line`](Line.html).
export class ErrorBox {
  // Line in which cooordinate system this rectangle is defined
  private line: Line;

  // Minimum and maximum _s_ coordinate
  private s0: number;
  private s1: number;

  // Minimum and maximum _t_ coordinate
  private t0: number;
  private t1: number;

  // Creates a new error box in given line coordinate system, containing
  // a single point
  constructor(line: Line, p: PVector) {
    this.line = line;
    const l = line.map(p);
    this.s0 = this.s1 = l.s;
    this.t0 = this.t1 = l.t;
  }

  // Adds new point to the bounded set, possibly enlarging the box, and
  // converts the representation to coordinate system of a new line.
  extend(line: Line, p: PVector): void {
    const l = line.map(p);
    const l00 = line.remapc(this.line, this.s0, this.t0);
    const l01 = line.remapc(this.line, this.s0, this.t1);
    const l10 = line.remapc(this.line, this.s1, this.t0);
    const l11 = line.remapc(this.line, this.s1, this.t1);

    this.line = line;
    this.s0 = min(l.s, l00.s, l01.s, l10.s, l11.s);
    this.s1 = max(l.s, l00.s, l01.s, l10.s, l11.s);
    this.t0 = min(l.t, l00.t, l01.t, l10.t, l11.t);
    this.t1 = max(l.t, l00.t, l01.t, l10.t, l11.t);
  }

  // Computes the largest possible value of the squared distance between a point
  // inside the rectangle, and the line defining its coordinate system
  error(): number {
    const t0 = this.t0, t1 = this.t1, line = this.line;
    return max(t0 * t0, t1 * t1) * (line.a * line.a + line.b * line.b);
  }

  // Gets the four rectangle vertices in cartesian coordinate system
  getCartesianCorners(): PVector[] {
    const line = this.line;
    return [
      line.unmapc(this.s0, this.t0),
      line.unmapc(this.s0, this.t1),
      line.unmapc(this.s1, this.t1),
      line.unmapc(this.s1, this.t0),
    ];
  }
}
