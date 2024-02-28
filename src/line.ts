// Line and its Coordinate System
// ==============================
//
// Line in 2D cartesian spacecan be defined implicitly by equation
//
//                         ax + by + c = 0.
//
// Such implicit definition is associated with a _line coordinate system_. Every
// plane point (_x_, _y_) be uniquely represented in the line's (_s_, _t_)
// coordinates as follows:
//
//                       (x, y) = O + sT + tN,
//
// where _O_ is the origin of the coordinate system and is defined as the
// projection of cartesian origin (0, 0) onto the line, whereas,
// _T_ = (-_b_, _a_) and _N_ = (_a_, _b_) are the tangent and normal vectors of
// the line.
//
// **Note:** Different implicit definitions of the same line may yield different
// coordinate systems.

import { PVector, abs } from "./math";

// Line Class
// ----------
//
// Represents an implicit line definition and provides routines to work with
// its coordinate system
export class Line {
  // Creates line with given coefficients
  constructor(public a: number, public b: number, public c: number) { }

  // Gets the line origin defined as the projection of the (0, 0) cartesian
  // point onto the line. This is the origin of this line's coordinate system.
  origin(): PVector {
    const a = this.a, b = this.b, c = this.c;
    const c1 = -c / (a * a + b * b);
    return new PVector(a * c1, b * c1);
  }

  // Gets the (`-b`, `a`) vector. This is the base vector for the _s_ line
  // coordinate.
  tangent(): PVector {
    return new PVector(-this.b, this.a);
  }

  // Gets the (`a`, `b`) vector. This is the base vector for the _t_ line
  // coordinate.
  normal(): PVector {
    return new PVector(this.a, this.b);
  }

  // Converts point from (_x_, _y_) cartesian coordinates to (s, t) line
  // coordinates
  map(p: PVector): LVector {
    const a = this.a, b = this.b, c = this.c;
    const c1 = a * a + b * b;
    const t = (a * p.x + b * p.y + c) / c1;
    const c2 = c / c1 - t;
    const s = abs(a) > abs(b) ? (p.y + b * c2) / a : -(p.x + a * c2) / b;
    return new LVector(s, t);
  }

  // Converts point from (_s_, _t_) line coordinates to cartesian (_x_, _y_)
  // coordinates
  unmap(l: LVector): PVector {
    return this.unmapc(l.s, l.t);
  }

  // Converts point from (_s_, _t_) line coordinates to cartesian (_x_, _y_)
  // coordinates
  unmapc(s: number, t: number): PVector {
    const a = this.a, b = this.b, c = this.c;
    const c1 = t - c / (a * a + b * b);
    return new PVector(c1 * a - s * b, c1 * b + s * a);
  }

  // Converts point given in this line's coordinates to the coordinate
  // system of another line
  remap(other: Line, l: LVector): LVector {
    return this.remapc(other, l.s, l.t);
  }

  // Converts point given in this line's coordinates to the coordinate
  // system of another line
  remapc(other: Line, s: number, t: number): LVector {
    return this.map(other.unmapc(s, t));
  }
}

// LVector Class
// -------------
//
// Represents a point in line (_s_, _t_) coordinates
class LVector {
  // Creates new point with given coordinates
  public constructor(public s: number, public t: number) { }
}
