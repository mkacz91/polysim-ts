// Polyline Simplification
// =======================
//
// This project demostrates an original algorithm for polygonal line
// simplification. Given a polygonal line, referred to as _path_, we produce
// a visually similar path, but with less vertices. The restruction criterion is
// _threshold_, which specifies the maximal distance between a point from
// original path to the simplified path.
//
// The algorithm is, implemented by
// [`PathSimplifier`](docs/PathSimplifier.html). It receives an instance of
// [`Path`](docs/Path.html) as input and provides a simplified path as result.
// The simplest use case may be as follows:
//
//     Path path = new Path();
//     float threshold = 0.3f;
//     PathSimplifier simplifier = new PathSimplifier(path, threshold);
//     path.addPoint(3, 0);
//     path.addPoint(1, 2);
//     . . .
//     path.addPoint(-4, 1);
//     Path simple = simplifier.getSimplified();
//
// The simplifier may be attached to the path at any moment and the simplified
// path may be retrievied at any time. For details, refer to the implementation.
//
// _This file contains the implementation of the demo app. No documentation
// provided, sorry._
//
// ![Demo app screenshot](screenshot.png)

import './index.css'
import { PVector, max } from "./math";
import { Path } from "./path";
import { ErrorBox, PathSimplifier } from "./path_simplifier";
import { SimplePathHull } from "./simple_path_hull";

const MAX_SPARSE_POINT_RATE = 13;
const PATH_WEIGHT = 2;
const SIMPLE_WEIGHT = 4;
const ERROR_BOX_WEIGHT = 2;
const CONVEX_HULL_WEIGHT = 2;
const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 20;
const INITIAL_THRESHOLD = 2;
const PATH_COLOR = "#998B6D";
const SIMPLE_COLOR = "#3B2969";
const ERROR_BOX_COLOR = "#36CF72";
const ERROR_BOX_BAD_COLOR = "#FF5D76";
const CONVEX_HULL_COLOR = "#FFF533";
const CONVEX_HULL_BAD_COLOR = "#FF5D76";
const DETAIL_FOCUS_AREA = 0.9;

let detailOffset = new PVector(0, 0);
const detailScale = 4.0;

let drawing = false;
let lastPointMillis = 0;
let millis = 0;

const path = new Path();
let simple: Path | null = null;
let simplifier: PathSimplifier | null = null;

const showOriginal = document.getElementById('show-original-checkbox') as HTMLInputElement;
const showSimple = document.getElementById('show-simple-checkbox') as HTMLInputElement;
const thresholdValueLabel = document.getElementById('threshold-range-value') as HTMLSpanElement;
const thresholdSlider = document.getElementById('threshold-range') as HTMLInputElement;

const showErrorBox = document.getElementById('show-error-box-checkbox') as HTMLInputElement;
const showConvexHull = document.getElementById('show-hull-checkbox') as HTMLInputElement;
const traceSlider = document.getElementById('trace-depth-range') as HTMLInputElement;

const inputMethodFreehand = "Freehand (F)";
const inputMethodSparse = "Sparse (S)";
const inputMethodPrecise = "Precise (P)";
const inputMethod = document.getElementById('input-method-button') as HTMLButtonElement;
const clear = document.getElementById('clear-button') as HTMLButtonElement;

const originalLengthLabel = document.getElementById('original-length-stat') as HTMLTableCellElement;
const simpleLengthLabel = document.getElementById('simple-length-stat') as HTMLTableCellElement;
const ratioLabel = document.getElementById('ratio-stat') as HTMLTableCellElement;

let threshold = NaN;

const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const mainView = document.getElementById('main-view') as HTMLDivElement;
const detailCanvas = document.getElementById('detail-canvas') as HTMLCanvasElement;
const detailView = document.getElementById('detail-view') as HTMLDivElement;
const onResize = () => {
  mainCanvas.width = mainView.offsetWidth;
  mainCanvas.height = mainView.offsetHeight;
  detailCanvas.width = detailView.offsetWidth;
  detailCanvas.height = detailView.offsetHeight;
}
onResize();
window.addEventListener('resize', onResize);

path.addListener({
  onClear: (_) => {
    simple = null;
  },
  onAddPoint: (sender, p) => {
    lastPointMillis = millis;
    simple = null;
    if (sender.length() < 2)
      return;
    const q = sender.point(sender.length() - 2);
    detailOffset.add(PVector.span(q, p).normalize().mult(0.05)).div(1.05);
  }
});

showOriginal.checked = true;
showSimple.checked = true;
thresholdSlider.min = MIN_THRESHOLD.toString();
thresholdSlider.max = MAX_THRESHOLD.toString();
thresholdSlider.value = INITIAL_THRESHOLD.toString();

showErrorBox.checked = true;
showConvexHull.checked = true;

inputMethod.innerText = inputMethodFreehand;
inputMethod.addEventListener('click', () => {
  if (inputMethod.innerText === inputMethodFreehand)
    inputMethod.innerText = inputMethodSparse;
  else if (inputMethod.innerText === inputMethodSparse)
    inputMethod.innerText = inputMethodPrecise;
  else
    inputMethod.innerText = inputMethodFreehand;
  path.clear();
});
clear.addEventListener('click', () => {
  path.clear();
});

function updateUIDataBindings(): void {
  const newThreshold = parseFloat(thresholdSlider.value);
  if (newThreshold != threshold) {
    threshold = newThreshold;
    thresholdValueLabel.innerHTML = threshold.toPrecision(3) + 'px';
    simplifier = new PathSimplifier(path, threshold);
    simple = null;
  }

  simple ??= simplifier!.getSimplified();

  const ratio = max(1, simple.length()) / max(1, path.length());
  originalLengthLabel.innerHTML = path.length().toString();
  simpleLengthLabel.innerHTML = simple.length().toString();
  ratioLabel.innerHTML = Math.round(ratio * 100) + '%';
}

const mainContext = mainCanvas.getContext('2d')!;
const detailContext = detailCanvas.getContext('2d')!;

function draw(time: DOMHighResTimeStamp): void {
  millis = time;
  updateUIDataBindings();
  drawDetail();
  drawNormal();
  window.requestAnimationFrame(draw);
}
window.requestAnimationFrame(draw);

function drawNormal(): void {
  if (path.isEmpty())
    return;
  const c = mainContext;
  c.lineJoin = 'round';
  c.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

  c.strokeStyle = PATH_COLOR;
  c.lineWidth = PATH_WEIGHT;
  if (showOriginal.checked)
    drawPath(c, path);

  c.strokeStyle = SIMPLE_COLOR;
  c.lineWidth = SIMPLE_WEIGHT;
  if (showSimple.checked)
    drawPath(c, simple!);
}

function drawDetail(): void {
  if (path.isEmpty())
    return;
  const c = detailContext;
  c.lineJoin = 'round';
  c.resetTransform();
  c.clearRect(0, 0, detailCanvas.width, detailCanvas.height);

  const size = detailCanvas.width;
  const offset = PVector.mult(detailOffset, DETAIL_FOCUS_AREA * size / 2);
  c.translate(offset.x + size / 2, offset.y + size / 2);
  c.scale(detailScale, detailScale);
  c.translate(-path.lastPoint().x, -path.lastPoint().y);

  c.strokeStyle = PATH_COLOR;
  c.lineWidth = PATH_WEIGHT / detailScale;
  if (showOriginal.checked)
    drawPath(c, path);

  c.strokeStyle = SIMPLE_COLOR;
  c.lineWidth = SIMPLE_WEIGHT / detailScale;
  if (showSimple.checked)
    drawPath(c, simple!);

  if (!showErrorBox.checked && !showConvexHull.checked) {
    return;
  }

  const trace = simplifier!.trace;
  const j = path.length() - 1;
  const pj = path.point(j);
  const errorBox = new ErrorBox(simplifier!.fitter.fitLine(j, j), pj);
  const hull = new SimplePathHull();
  hull.offer(pj);

  const k = Math.round(parseFloat(traceSlider.value) * (trace.length - 1));
  const e = trace[k];
  const iMin = e === 'cut' ? j - k + 1 : j - k;
  for (let i = j - 1; i >= iMin; --i) {
    const pi = path.point(i);
    if (showErrorBox.checked) {
      const line = simplifier!.fitter.fitLine(i, j);
      errorBox.extend(line, pi);
    }
    if (showConvexHull.checked)
      hull.offer(pi);
  }

  if (showErrorBox.checked) {
    const corners = errorBox.getCartesianCorners();
    c.strokeStyle = e != 'threshold' ? ERROR_BOX_COLOR : ERROR_BOX_BAD_COLOR;
    c.lineWidth = ERROR_BOX_WEIGHT / detailScale;
    c.beginPath();
    c.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; ++i) {
      c.lineTo(corners[i].x, corners[i].y);
    }
    c.closePath();
    c.stroke();
  }

  if (showConvexHull.checked) {
    c.strokeStyle = e !== 'pioneer_weak' && e != 'pioneer_strong'
      ? CONVEX_HULL_COLOR : CONVEX_HULL_BAD_COLOR;
    c.lineWidth = CONVEX_HULL_WEIGHT / detailScale;
    let n = hull.first!;
    c.beginPath();
    c.moveTo(n.pos.x, n.pos.y);
    while (n.next !== hull.first) {
      n = n.next;
      c.lineTo(n.pos.x, n.pos.y);
    }
    c.closePath();
    c.stroke();
  }
}

function drawPath(c: CanvasRenderingContext2D, path: Path /*, float scale*/) {
  const length = path.length();
  if (length < 2) {
    return;
  }
  c.beginPath();
  const p0 = path.point(0);
  c.moveTo(p0.x, p0.y);
  for (let i = 1; i < length; ++i) {
    const p = path.point(i);
    c.lineTo(p.x, p.y);
  }
  c.stroke();
}

mainView.addEventListener('mousedown', (e) => {
  if (inputMethod.innerText !== inputMethodPrecise)
    path.clear();
  path.addPointc(e.offsetX, e.offsetY);
  drawing = true;
});

mainView.addEventListener('mousemove', (e) => {
  if (!drawing)
    return;

  if (
    inputMethod.innerText === inputMethodPrecise ||
    inputMethod.innerText === inputMethodSparse &&
    MAX_SPARSE_POINT_RATE * (millis - lastPointMillis) < 1000
  ) {
    return;
  }

  const q = new PVector(Math.round(e.offsetX), Math.round(e.offsetY));
  if (!path.isEmpty()) {
    const p = path.lastPoint();
    if (p.x === q.x && p.y === q.y) {
      return;
    }
  }
  path.addPoint(q);
});

window.addEventListener('mouseup', () => {
  drawing = false;
});

window.addEventListener('keydown', e => {
  let newInputMethod: string | null = null;
  switch (e.key) {
    case 'c':
    case 'C':
      path.clear();
      break;

    case 'f':
    case 'F':
      newInputMethod = inputMethodFreehand;
      break;

    case 'p':
    case 'P':
      newInputMethod = inputMethodPrecise;
      break;

    case 's':
    case 'S':
      newInputMethod = inputMethodSparse;
      break;
  }

  if (!!newInputMethod && inputMethod.innerText !== newInputMethod) {
    inputMethod.innerText = newInputMethod;
    path.clear();
  }
});
