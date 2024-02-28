// Linear Approximation
// ====================
//
// Given line _L_: _ax_ + _by_ + _c_ = 0 and point _p_ = (_x_, _y_), we can
// compute the squared distace d(_L_, _p_) between those two, using the
// simple formula
//
//              d(L, p) = (ax + by + c)^2 / (a^2 + b^2).
//
// Given a set of _n_ points, _p1_ = (_x1_, _y1_), _p2_ = (_x2_, _y2_), ...,
// _pn_ = (_xn_, _yn_), We define the _least square error_ f(_a_, _b_, _c_) of
// a linear approximation _L_ by the sum of their squared distances:
//
//        f(a, b, c) = d(L, p1) + d(L, p2) + . . . + d(L, pn).
//
// Minimizing this error yields an _optimal linear approximation in the least
// squares sense_. Solving this problem, by seeking the roots of the derivative
// of f, leads to an algorithm, that after linear preprocessing, determines the
// optimal approximation for any continuous subsequence of points in constant
// time.

import { Line } from "./line";
import { PVector, max } from "./math";
import { IPathListener, Path } from "./path";

// LineFitter Class
// ----------------
//
// Provides means to quickly retrieve optimal linear approximation of
// a subsequence of path points. Can be attached to a `Path` object, thus making
// the linear approximation readily avilable after any modification.
export class LineFitter implements IPathListener {
  // Length of the path being approximated. Normally this should be equivalent
  // to `path.length()` but in the initial steps, when starting with a non empty
  // path, it may be smaller to artificially simulate the construction process.
  private pathLength = 0;

  // Partial sums of the point x coordinates
  private readonly sumsX: number[] = [];

  // Partial sums of the point y coordinates
  private readonly sumsY: number[] = [];

  // Partial sums of the squares of point x coordinates
  private readonly sumsXX: number[] = [];

  // Partial sums of the squares of point y coordinates
  private readonly sumsYY: number[] = [];

  // Partial sums of the products of point coordinates
  private readonly sumsXY: number[] = [];

  // Creates new fitter attached to given path
  constructor(path: Path) {
    path.addListener(this);

    // We artificially invoke the modification callbacks to simulate the
    // construction steps that have taken place before this fitter was created
    this.onClear(path);
    for (const p of path) {
      this.onAddPoint(path, p);
    }
  }

  onClear(_: Path): void {
    this.pathLength = 0;
    this.sumsX.length = 0; this.sumsX.push(0);
    this.sumsY.length = 0; this.sumsY.push(0);
    this.sumsXX.length = 0; this.sumsXX.push(0);
    this.sumsYY.length = 0; this.sumsYY.push(0);
    this.sumsXY.length = 0; this.sumsXY.push(0);
  }

  onAddPoint(_: Path, p: PVector): void {
    const x = p.x, y = p.y;
    const i = this.pathLength;
    this.sumsX.push(this.sumsX[i] + x);
    this.sumsY.push(this.sumsY[i] + y);
    this.sumsXX.push(this.sumsXX[i] + x * x);
    this.sumsYY.push(this.sumsYY[i] + y * y);
    this.sumsXY.push(this.sumsXY[i] + x * y);
    ++this.pathLength;
  }

  // Gets the line approximation for the whole path
  fitLineWhole(): Line {
    return this.fitLine(0, this.pathLength - 1);
  }

  // Gets the line approximation for the subpath starting at index `i` and
  // ending at index `j`.
  fitLine(i: number, j: number): Line {
    return LineFitter.fitLine(
      LineFitter.rangeSum(this.sumsX, i, j),
      LineFitter.rangeSum(this.sumsY, i, j),
      LineFitter.rangeSum(this.sumsXX, i, j),
      LineFitter.rangeSum(this.sumsYY, i, j),
      LineFitter.rangeSum(this.sumsXY, i, j),
      j - i + 1
    );
  }

  private static fitLine(
    sumX: number, sumY: number,
    sumXX: number, sumYY: number,
    sumXY: number,
    n: number,
  ): Line {
    if (n <= 0)
      return new Line(1, -1, 0);

    // Normally the following coefficients should never be negative, as follows
    // from the Cauchy-Schwarz inequality, but we want to play safe in case of
    // floating point errors
    const fa = max(n * sumXX - sumX * sumX, 0);
    const fb = max(n * sumYY - sumY * sumY, 0);

    // This condition detects cases where all points are nearly indistinguishable.
    // The returned line direction is difficult to compute, so we just make sure the
    // line we return passes near the points. Case `n == 1` is also handled here.
    if (fa <= Number.EPSILON && fb <= Number.EPSILON)
      return new Line(-1, -1, (sumX + sumY) / n);

    // The following computations should in ideal case give the same result, but we
    // choose the one that is numerically safer.
    if (fa < fb) {
      const a = 1;
      const b = (sumX * sumY - n * sumXY) / fb;
      const c = -(sumY * b + sumX) / n;
      return new Line(a, b, c);
    } else {
      const a = (sumX * sumY - n * sumXY) / fa;
      const b = 1;
      const c = -(sumX * a + sumY) / n;
      return new Line(a, b, c);
    }
  }

  private static rangeSum(sums: number[], i: number, j: number): number {
    return sums[j + 1] - sums[i];
  }
}
