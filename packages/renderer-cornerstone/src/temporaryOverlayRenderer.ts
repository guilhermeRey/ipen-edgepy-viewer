import type { ClinicalViewportAsset, ClinicalViewportTemporaryOverlay } from "@pycom-next/react-viewer";
import { drawOverlayImage, resizeCanvasToViewport } from "./fusionOverlayRenderer";
import type { WorldMappableViewportLike } from "./fusionOverlayTypes";

export interface TemporaryOverlayRenderer {
  draw(sliceIndex: number): void;
  set(overlay: ClinicalViewportTemporaryOverlay | undefined): boolean;
  dispose(): void;
}

export function createTemporaryOverlayRenderer(options: {
  element: HTMLElement;
  viewport: WorldMappableViewportLike;
  baseAssets: readonly ClinicalViewportAsset[];
  onStatus(message: string): void;
}): TemporaryOverlayRenderer {
  const canvas = document.createElement("canvas");
  canvas.className = "pycom-cornerstone-script-overlay-canvas";
  Object.assign(canvas.style, { position: "absolute", pointerEvents: "none", zIndex: "3" });
  options.element.append(canvas);
  let current: ClinicalViewportTemporaryOverlay | undefined;

  function draw(sliceIndex: number): void {
    resizeCanvasToViewport(canvas, options.element);
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    const baseAsset = options.baseAssets[sliceIndex];
    if (!context || !current || current.sliceIndex !== sliceIndex || !baseAsset) {
      return;
    }
    drawOverlayImage({
      context,
      targetCanvas: canvas,
      viewport: options.viewport,
      image: {
        width: current.width,
        height: current.height,
        minPixelValue: 0,
        maxPixelValue: 1,
        getPixelData: () => current?.values ?? [],
      },
      baseAsset,
      asset: baseAsset,
      layer: {
        label: current.label,
        purpose: "mask",
        assets: [baseAsset],
        imageIds: [],
        color: current.color ?? "#2be3d2",
        opacity: Math.max(0, Math.min(1, current.opacity ?? 0.55)),
      },
      onStatus: options.onStatus,
    });
  }

  return {
    draw,
    set(overlay) {
      if (overlay && (overlay.width <= 0 || overlay.height <= 0 || overlay.values.length !== overlay.width * overlay.height)) {
        return false;
      }
      current = overlay;
      draw(options.viewport.getCurrentImageIdIndex());
      return true;
    },
    dispose() {
      current = undefined;
      canvas.remove();
    },
  };
}
