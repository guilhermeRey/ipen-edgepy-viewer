import type { ClinicalViewportRoi, ClinicalViewportRoiOptions, ClinicalViewportRoiSession } from "../ports/viewportRenderer";

type Point = readonly [number, number];
interface Binding extends ClinicalViewportRoiOptions {
  element: HTMLElement;
  isCurrent(): boolean;
  canvasToImage(point: Point): Point;
  imageToCanvas(point: Point): Point;
}
export interface RectangularRoiBinding extends ClinicalViewportRoiSession {
  redraw(): void;
  invalidate(): void;
}

export function roiFromPoints(start: Point, end: Point, { width, height }: { width: number; height: number }): ClinicalViewportRoi {
  const x = (value: number) => Math.max(0, Math.min(width, Math.round(value)));
  const y = (value: number) => Math.max(0, Math.min(height, Math.round(value)));
  return { x0: x(Math.min(start[0], end[0])), x1: x(Math.max(start[0], end[0])),
    y0: y(Math.min(start[1], end[1])), y1: y(Math.max(start[1], end[1])) };
}

/** DOM interaction shared by renderers. All geometry stays with the renderer. */
export function bindRectangularRoi(options: Binding): RectangularRoiBinding {
  const { element, image, onChange } = options;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const outline = document.createElementNS(svg.namespaceURI, "polygon");
  svg.classList.add("edgepy-viewport-roi");
  svg.setAttribute("aria-hidden", "true");
  Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "5" });
  outline.setAttribute("fill", "#2be3d21a");
  outline.setAttribute("stroke", "#2be3d2");
  outline.setAttribute("stroke-width", "2");
  svg.append(outline);
  element.append(svg);
  const previous = { cursor: element.style.cursor, touchAction: element.style.touchAction };
  element.style.cursor = "crosshair";
  element.style.touchAction = "none";
  const abort = new AbortController();
  let disposed = false;
  let roi: ClinicalViewportRoi = { x0: 0, x1: 0, y0: 0, y1: 0 };
  let drag: { pointerId: number; start: Point; previous: ClinicalViewportRoi } | undefined;

  function release() {
    const pointerId = drag?.pointerId;
    drag = undefined;
    if (pointerId !== undefined && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    release();
    observer.disconnect();
    svg.remove();
    Object.assign(element.style, previous);
  }
  function invalidate() {
    if (disposed) return;
    dispose();
    onChange(undefined);
  }
  function current() {
    if (disposed) return false;
    if (!options.isCurrent()) { invalidate(); return false; }
    return true;
  }
  function redraw() {
    if (!current()) return;
    const corners: Point[] = [[roi.x0, roi.y0], [roi.x1, roi.y0], [roi.x1, roi.y1], [roi.x0, roi.y1]];
    outline.setAttribute("points", corners.map((point) => options.imageToCanvas(point).join(",")).join(" "));
    outline.setAttribute("visibility", roi.x0 === roi.x1 || roi.y0 === roi.y1 ? "hidden" : "visible");
  }
  function setRoi(next: ClinicalViewportRoi) {
    if (!current() || !Object.values(next).every(Number.isInteger) || next.x0 < 0 || next.y0 < 0 ||
      next.x1 > image.width || next.y1 > image.height || next.x0 > next.x1 || next.y0 > next.y1) return false;
    roi = { ...next };
    redraw();
    onChange({ image, roi: { ...roi } });
    return true;
  }
  function point(event: PointerEvent): Point {
    const rect = element.getBoundingClientRect();
    return options.canvasToImage([event.clientX - rect.left, event.clientY - rect.top]);
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId || !current()) return;
    event.preventDefault();
    event.stopPropagation();
    setRoi(roiFromPoints(drag.start, point(event), image));
  }
  const listenerOptions = { capture: true, signal: abort.signal };
  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary || drag || !current()) return;
    const start = point(event);
    if (!start.every(Number.isFinite) || start[0] < 0 || start[1] < 0 || start[0] > image.width || start[1] > image.height) return;
    event.preventDefault();
    event.stopPropagation();
    drag = { pointerId: event.pointerId, start, previous: roi };
    element.setPointerCapture(event.pointerId);
    move(event);
  }, listenerOptions);
  element.addEventListener("pointermove", move, listenerOptions);
  element.addEventListener("pointerup", (event) => {
    if (drag?.pointerId !== event.pointerId) return;
    move(event);
    release();
  }, listenerOptions);
  const cancel = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    const last = drag.previous;
    release();
    setRoi(last);
  };
  element.addEventListener("pointercancel", cancel, listenerOptions);
  element.addEventListener("lostpointercapture", cancel, listenerOptions);
  const observer = new ResizeObserver(redraw);
  observer.observe(element);
  redraw();
  return { setRoi, dispose, redraw, invalidate };
}
