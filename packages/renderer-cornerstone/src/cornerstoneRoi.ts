import { bindRectangularRoi, type ClinicalViewportRoiOptions, type RectangularRoiBinding } from "@pycom-next/react-viewer";
import type { StackViewportLike } from "./cornerstoneViewportLifecycle";

export function beginCornerstoneRoi(element: HTMLElement, viewport: StackViewportLike, options: ClinicalViewportRoiOptions): RectangularRoiBinding | undefined {
  const { image } = options;
  const isCurrent = () => {
    const data = viewport.getImageData?.();
    return !!image.imageId && viewport.getCurrentImageId?.() === image.imageId &&
      viewport.getCurrentImageIdIndex() === image.sliceIndex &&
      data?.dimensions[0] === image.width && data.dimensions[1] === image.height;
  };
  if (!isCurrent() || !viewport.canvasToWorld || !viewport.worldToCanvas) return undefined;
  const events = new AbortController();
  const binding = bindRectangularRoi({
    ...options, element, isCurrent,
    onChange(selection) {
      if (!selection) events.abort();
      options.onChange(selection);
    },
    canvasToImage(point) {
      const index = viewport.getImageData!()!.imageData.worldToIndex(viewport.canvasToWorld!([...point]));
      return [index[0]!, index[1]!];
    },
    imageToCanvas(point) {
      const world = viewport.getImageData!()!.imageData.indexToWorld([point[0], point[1], 0]);
      return viewport.worldToCanvas!(world);
    },
  });
  const dispose = () => { events.abort(); binding.dispose(); };
  const invalidate = () => { events.abort(); binding.invalidate(); };
  for (const name of ["CORNERSTONE_CAMERA_MODIFIED", "CORNERSTONE_IMAGE_RENDERED", "CORNERSTONE_STACK_NEW_IMAGE"]) {
    element.addEventListener(name, () => { if (isCurrent()) binding.redraw(); else invalidate(); }, { signal: events.signal });
  }
  element.addEventListener("CORNERSTONE_PRE_STACK_NEW_IMAGE", invalidate, { signal: events.signal });
  return { ...binding, dispose, invalidate };
}
