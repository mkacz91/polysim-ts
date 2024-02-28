// Math Utilities
// ======================

import { Line } from "./line";

export const abs = Math.abs;
export const min = Math.min;
export const max = Math.max;

// 2D Cartesian Vector
export class PVector {
  constructor(public x: number, public y: number) { }

  magSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  // Determines whether a `PVector` contains infinities or NaNs
  isSingular(): boolean {
    return !(isFinite(this.x) && isFinite(this.y));
  }

  static sub(a: PVector, b: PVector): PVector {
    return new PVector(a.x - b.x, a.y - b.y);
  }

  // Computes the _per product_ (aka. _cross product_) of two vectors
  static per(u: PVector, v: PVector): number {
    return u.x * v.y - v.x * u.y;
  }

  // Produces a vector spanned between two points
  static span(a: PVector, b: PVector): PVector {
    return PVector.sub(b, a);
  }

  // Computes the squared distance between two points
  static distSq(a: PVector, b: PVector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
}

// Geometry Class
// --------------
//
// Provides elementary geometrical operations
export class Geometry {
  // Tests which side of line a given point lies at.
  //
  //   * Returns positive value if `p` is on the left side of line through
  //     `a` and `b`.
  //
  //   * Returns negative value if `p` is on the right side of line through
  //     `a` and `b`.
  //
  //   * Returns 0 if `a`, `b` and `p` are colinear.
  public static side(a: PVector, b: PVector, p: PVector): number {
    return PVector.per(PVector.span(a, b), PVector.span(a, p));
  }

  // Tests whether segments `ab` and `cd` intersect
  public static intersect(a: PVector, b: PVector, c: PVector, d: PVector): boolean {
    // The segments intersect only if the endpoints of one are on opposite sides
    // of the other (both ways)
    const ab = PVector.span(a, b), ac = PVector.span(a, c), ad = PVector.span(a, d);
    const sab = PVector.per(ab, ac) * PVector.per(ab, ad);
    if (sab > 0)
      return false;
    const cd = PVector.span(c, d), cb = PVector.span(c, b);
    const scd = PVector.per(cd, ac) * PVector.per(cd, cb);
    // Note that `ac` is used instead of `ca` in the above line, thus reversing
    // the following condition
    if (scd < 0)
      return false;
    // When the points are colinear, we have to check if the segments overlap
    if (sab == 0 && scd == 0) {
      const abSq = ab.magSq();
      return ac.magSq() <= abSq || ad.magSq() < abSq;
    }
    return true;
  }

  // Returns a projection of point onto a line
  static project(p: PVector, l: Line): PVector {
    const t = -(l.a * p.x + l.b * p.y + l.c) / (l.a * l.a + l.b * l.b);
    return new PVector(p.x + t * l.a, p.y + t * l.b);
  }

  // Returns the intersection point of two lines. The result may contain ifinities
  // if the lines are parallel, or NaNs if they are identical.
  static intersection(l1: Line, l2: Line): PVector {
    let a11 = l1.a, a12 = l1.b, b1 = -l1.c;
    let a21 = l2.a, a22 = l2.b, b2 = -l2.c;

    // We now solve a linear equation `Ax = b`, where `A = [a11 a12; a21 a22]`,
    // `x = [x1; x2]` `b = [b1; b2]`. We use Gaussian elimination method with
    // full pivot selection.

    // We rearrange the equation so that the pivot is `a11`
    let swapResult = false;
    if (max(abs(a11), abs(a12)) < max(abs(a21), abs(a22))) {
      let tmp: number;
      tmp = a11; a11 = a21; a21 = tmp;
      tmp = a12; a12 = a22; a22 = tmp;
      tmp = b1; b1 = b2; b2 = tmp;
    }
    if (abs(a11) < abs(a12)) {
      let tmp: number;
      tmp = a11; a11 = a12; a12 = tmp;
      tmp = a21; a21 = a22; a22 = tmp;
      swapResult = true;
    }

    a22 -= a12 * a21 / a11;
    b2 -= b1 * a21 / a11;
    const x2 = b2 / a22;
    const x1 = (b1 - a12 * x2) / a11;

    return swapResult ? new PVector(x2, x1) : new PVector(x1, x2);
  }
}

// Truncates value to given range
function clamp(x: number, a: number, b: number): number {
  if (x < a)
    return a;
  else if (b < x)
    return b;
  else return x;
}
