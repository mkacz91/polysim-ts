// Polygonal Line Path
// ===================

import { PVector } from "./math";

// Path Class
// ----------
//
// Represents a polygonal line path. Informs registered listeners about
// any changes.
export class Path implements Iterable<PVector>
{
  // List of path points
  private readonly points: PVector[] = [];

  // List of registered listeners
  private readonly listeners: IPathListener[] = [];

  // Gets the number of points in the path
  length(): number {
    return this.points.length;
  }

  // True if this path has no points
  isEmpty(): boolean {
    return this.points.length === 0;
  }

  // Gets the `i`th point
  point(i: number): PVector {
    return this.points[i];
  }

  // Gets the last point
  lastPoint(): PVector {
    return this.points[this.points.length - 1];
  }

  // Adds new point at the end of the path
  addPoint(p: PVector): void {
    this.points.push(p);
    this.listeners.forEach(listener => listener.onAddPoint(this, p));
  }

  // Adds new point at the end of the path
  addPointc(x: number, y: number): void {
    this.addPoint(new PVector(x, y));
  }

  // Removes all points from the path
  clear(): void {
    this.points.length = 0;
    this.listeners.forEach(listener => listener.onClear(this));
  }

  // Registers new listener. It will from now on be informed about any
  // modifications to this path. The listeners will be informed in the same
  // order they were registered.
  addListener(listener: IPathListener): void {
    this.listeners.push(listener);
  }

  // Gets the iterator over all points
  [Symbol.iterator](): Iterator<PVector> {
    return this.points[Symbol.iterator]();
  }
}

// IPathListener Interface
// -----------------------
//
// Path modification callbacks. Client must implement this interface to be
// able to be informed about modifications of a `Path`
interface IPathListener {
  // Invoked when point `p` is added to the end of path `sender`
  onAddPoint(sender: Path, p: PVector): void;

  // Invoked when `sender` is cleared
  onClear(sender: Path): void;
}
