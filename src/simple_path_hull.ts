// Convex Hull for Simple Polygons
// ===============================
//
// The _Convex Hull Problem_ for arbitrary point set is known not to be solvalbe
// under O(_n_ log_n_) time. Nevertheless, if we know that the points make up
// non intersecting polygonal path, linear time online solutions exist, as
// reported by [**Melkman '87**](http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.512.9681).

import { Geometry, PVector } from "./math";

// Node of the doubly linked list that describes the convex hull polygon.
// Holds the hull point position and provides acces to the next and previous
// nodes in CCW order.
export type SimplePathHullNode = {
  readonly pos: PVector,
  // Previous node in CCW order
  prev: SimplePathHullNode,
  // Next node in CCW order
  next: SimplePathHullNode,
  // True if the node is part of the hull.
  isValid: boolean,
};

// SimplePathHull Class
// --------------------
//
// Performs online computation of convex hull for non intersecting polygonal
// paths. The provided result is in a form of doubly linked list of points
// arranged in CCW order. Uses Melkman algorithm with minor tweaks.
export class SimplePathHull {

  // Creates a hull node with given position and neighbours. Automatically
  // alters the pointers of adjecent nodes.
  static makeNode(
    pos: PVector, prev?: SimplePathHullNode, next?: SimplePathHullNode,
  ): SimplePathHullNode {
    const node = { pos, isValid: true } as SimplePathHullNode;
    node.prev = prev ?? node;
    node.next = next ?? node;
    node.prev.next = node.next.prev = node;
    return node;
  }

  // First node of the convex hull, or `undefined` if the hull is empty
  private _first?: SimplePathHullNode;

  // Number of points making up the hull
  private _size = 0;

  // Gets the irst node of the convex hull, or `undefined` if the hull is empty
  get first(): SimplePathHullNode | undefined {
    return this._first;
  }

  // Gets the number of points making up the hull
  size(): number {
    return this._size;
  }

  // Returns true if the hull contains no points
  isEmpty(): boolean {
    return this._size === 0;
  }

  // Tries to extend the convex hull by given point. If the point lies outside
  // or on the current hull, it is accepted, becomes the new starting point and
  // the hull is adjusted to fit the extended point set. Otherwise the point is
  // ignored.
  // Returns the newly created node if the point was accepted, and `null`
  // otherwise.
  public offer(p: PVector): SimplePathHullNode | undefined {
    if (this._size >= 3) {
      // In typical case with at least 3 hull points we seek tangents by skipping
      // all edges that become interior after adding `p` to the hull. Because
      // the offered points make up a non intersecting line, it suffices to
      // consider the viccinity of `first`.
      const first = this.first!;
      let n0 = this.first!;
      while (n0.prev != first && Geometry.side(n0.pos, n0.prev!.pos, p) >= 0)
        n0 = n0.prev!;
      let n1 = first;
      while (n1.next != first && Geometry.side(n1.pos, n1.next!.pos, p) <= 0)
        n1 = n1.next!;
      // If `n0` and `n1` diverged, i.e., any one left `first`, there were some
      // skipped edges, meaning the new point indeed is exterior to the current
      // hull. In that case, `n0p` and `n1p` form tangents and anything between
      // `n0` and `n1` must be removed from the hull.
      if (n0 != n1) {
        let n = n0.next;
        while (n != n1) {
          n.isValid = false;
          n = n.next;
          --this._size;
        }
        this._first = SimplePathHull.makeNode(p, n0, n1);
      }
    } else if (this._size == 0) {
      this._first = SimplePathHull.makeNode(p);
    } else if (this._size == 1) {
      this._first = SimplePathHull.makeNode(p, this.first, this.first);
    } else {
      const first = this.first!;
      // We have two points and are about to create a triangle. Make sure it
      // is counter clockwise. If the triangle would become degenerated, we stick
      // to a 2-gon and simply detach `first`.
      const s = Geometry.side(first.pos, first.next.pos, p);
      if (s < 0) {
        this._first = SimplePathHull.makeNode(p, first, first.next);
      } else if (s > 0) {
        this._first = SimplePathHull.makeNode(p, first.prev, first);
      } else {
        first.isValid = false;
        this._first = SimplePathHull.makeNode(p, first.prev, first.next);
        --this._size;
      }
    }

    if (this.first?.pos === p) {
      ++this._size;
      return this.first;
    } else {
      return undefined;
    }
  }
}