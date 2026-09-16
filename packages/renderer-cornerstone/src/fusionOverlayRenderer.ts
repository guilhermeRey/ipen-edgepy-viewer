import type { ClinicalViewportAsset, ClinicalViewportOverlayAssets, ClinicalViewportOverlayRenderStatus } from "@pycom-next/react-viewer";
import { functionalOverlayOpacity, overlayColor, overlayOpacity, type FunctionalOverlayColormap } from "@pycom-next/react-viewer/overlayPresentation";
import { geometryCompatibility, imagePlaneCorners, imagePlaneFromDicom, nearestSliceIndexForBaseSlice, type Point3 } from "./dicomGeometry";
import { overlayImageData } from "./fusionOverlayImageData";
import type { FusionOverlayLayer, RuntimeImageLike, WorldMappableViewportLike } from "./fusionOverlayTypes";
import { createOverlayGeometryMetadataCache, type OverlayGeometryMetadataCache } from "./overlayGeometryMetadata";
import { createMhdDoseVolumeCache, isMhdDoseLayer, type MhdDoseVolumeCache } from "./mhdDoseVolume";
import { createRtstructMetadataCache, disposeRtstructMetadataCache, type RtstructMetadataCache } from "./rtstructContourCache";
import { drawRtstructLayer } from "./rtstructContourRenderer";

export interface FusionOverlayRenderer {
  draw(sliceIndex: number): Promise<void>;
  dispose(): void;
}

export interface FusionOverlayRendererOptions {
  element: HTMLElement;
  viewport: WorldMappableViewportLike;
  baseAssets: readonly ClinicalViewportAsset[];
  layers: readonly FusionOverlayLayer[];
  loadImage(imageId: string): Promise<RuntimeImageLike>;
  onStatus(message: string): void;
  onOverlayRenderStatus?: ((status: ClinicalViewportOverlayRenderStatus) => void) | undefined;
  rtstructCache?: RtstructMetadataCache | undefined;
}

interface FunctionalOverlayLayerOptions {
  assets: readonly ClinicalViewportAsset[];
  imageIds: readonly string[];
  opacity: number | undefined;
  colormap: FunctionalOverlayColormap | undefined;
}

export function functionalOverlayLayer({ assets, imageIds, opacity, colormap }: FunctionalOverlayLayerOptions): FusionOverlayLayer | undefined {
  return assets.length > 0 && imageIds.length > 0
    ? { label: "Functional", purpose: "functional", assets, imageIds, color: "#f97316", opacity: functionalOverlayOpacity(opacity), colormap }
    : undefined;
}

export function maskOverlayLayers(overlays: readonly ClinicalViewportOverlayAssets[], imageIds: readonly string[][]): FusionOverlayLayer[] {
  return overlays.flatMap((overlay, index) => {
    const ids = imageIds[index] ?? [];
    if (overlay.assets.length === 0 || ids.length === 0 || overlay.overlay.kind === "rtstruct") {
      return [];
    }
    return [{
      label: overlay.overlay.label,
      purpose: overlay.overlay.kind === "dose" ? "dose" : "mask",
      assets: overlay.assets,
      imageIds: ids,
      color: overlayColor(overlay.overlay, index),
      opacity: overlayOpacity(overlay.overlay),
    }];
  });
}

export function createFusionOverlayRenderer(options: FusionOverlayRendererOptions): FusionOverlayRenderer | undefined {
  if (options.layers.length === 0) {
    return undefined;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "pycom-cornerstone-overlay-canvas";
  Object.assign(canvas.style, { position: "absolute", pointerEvents: "none", zIndex: "2" });
  if (!options.element.style.position || options.element.style.position === "static") {
    options.element.style.position = "relative";
  }
  options.element.append(canvas);

  let drawGeneration = 0;
  const overlayGeometryCache = createOverlayGeometryMetadataCache();
  const mhdDoseCache = createMhdDoseVolumeCache();
  const rtstructCache = options.rtstructCache ?? createRtstructMetadataCache();
  const ownsRtstructCache = !options.rtstructCache;
  return {
    async draw(sliceIndex: number): Promise<void> {
      const generation = ++drawGeneration;
      resizeCanvasToViewport(canvas, options.element);
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      await drawLayers({ context, canvas, options, sliceIndex, generation, currentGeneration: () => drawGeneration, overlayGeometryCache, mhdDoseCache, rtstructCache });
    },
    dispose(): void {
      drawGeneration += 1;
      if (ownsRtstructCache) {
        disposeRtstructMetadataCache(rtstructCache);
      }
      canvas.remove();
    },
  };
}

interface LayerDrawOptions {
  context: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  options: FusionOverlayRendererOptions;
  sliceIndex: number;
  generation: number;
  currentGeneration(): number;
  mhdDoseCache: MhdDoseVolumeCache;
  overlayGeometryCache: OverlayGeometryMetadataCache;
  rtstructCache: RtstructMetadataCache;
}

async function drawLayers({ context, canvas, options, sliceIndex, generation, currentGeneration, mhdDoseCache, overlayGeometryCache, rtstructCache }: LayerDrawOptions): Promise<void> {
  const baseAsset = options.baseAssets[clamp(sliceIndex, 0, options.baseAssets.length - 1)];
  for (const layer of options.layers) {
    if (layer.purpose === "rtstruct") {
      await drawRtstructLayer({
        context,
        targetCanvas: canvas,
        viewport: options.viewport,
        baseAsset,
        layer,
        rtstructCache,
        onStatus: options.onStatus,
        canvasPoint,
        isCurrent: () => generation === currentGeneration(),
        onOverlayRenderStatus: options.onOverlayRenderStatus,
      });
      continue;
    }
    if (isMhdDoseLayer(layer)) {
      await drawMhdDoseLayer({ context, canvas, options, layer, baseAsset, sliceIndex, generation, currentGeneration, mhdDoseCache });
      continue;
    }
    const overlayMetadata = await overlayGeometryCache.metadataForAssets(layer.assets);
    if (generation !== currentGeneration()) {
      return;
    }
    const overlayIndex = nearestSliceIndexForBaseSlice(baseAsset?.dicom, overlayMetadata, sliceIndex);
    const imageId = layer.imageIds[overlayIndex];
    const overlayAsset = withDicomMetadata(layer.assets[overlayIndex], overlayMetadata[overlayIndex]);
    if (!imageId || !overlayAsset) {
      continue;
    }
    try {
      const image = await options.loadImage(imageId);
      if (generation !== currentGeneration()) {
        return;
      }
      drawOverlayImage({ context, targetCanvas: canvas, viewport: options.viewport, image, baseAsset, asset: overlayAsset, layer, onStatus: options.onStatus });
    } catch (error) {
      options.onStatus(`Skipped ${layer.label}: ${errorMessage(error)}`);
    }
  }
}

interface MhdDoseLayerDrawOptions {
  context: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  options: FusionOverlayRendererOptions;
  layer: FusionOverlayLayer;
  baseAsset: ClinicalViewportAsset | undefined;
  sliceIndex: number;
  generation: number;
  currentGeneration(): number;
  mhdDoseCache: MhdDoseVolumeCache;
}

async function drawMhdDoseLayer({ context, canvas, options, layer, baseAsset, sliceIndex, generation, currentGeneration, mhdDoseCache }: MhdDoseLayerDrawOptions): Promise<void> {
  try {
    const volume = await mhdDoseCache.volumeForAssets(layer.assets);
    if (!volume || generation !== currentGeneration()) {
      return;
    }
    const overlayIndex = nearestSliceIndexForBaseSlice(baseAsset?.dicom, volume.metadata, sliceIndex);
    const { asset, image } = volume.slice(overlayIndex, baseAsset?.dicom?.frameOfReferenceUid);
    drawOverlayImage({ context, targetCanvas: canvas, viewport: options.viewport, image, baseAsset, asset, layer, onStatus: options.onStatus });
  } catch (error) {
    options.onStatus(`Skipped ${layer.label}: ${errorMessage(error)}`);
  }
}

function withDicomMetadata(asset: ClinicalViewportAsset | undefined, dicom: ClinicalViewportAsset["dicom"] | undefined): ClinicalViewportAsset | undefined {
  if (!asset || asset.dicom || !dicom) {
    return asset;
  }
  return { ...asset, dicom };
}

interface OverlayImageDrawOptions {
  context: CanvasRenderingContext2D;
  targetCanvas: HTMLCanvasElement;
  viewport: WorldMappableViewportLike;
  image: RuntimeImageLike;
  baseAsset: ClinicalViewportAsset | undefined;
  asset: ClinicalViewportAsset;
  layer: FusionOverlayLayer;
  onStatus(message: string): void;
}

export function drawOverlayImage({ context, targetCanvas, viewport, image, baseAsset, asset, layer, onStatus }: OverlayImageDrawOptions): void {
  const width = image.columns ?? image.width;
  const height = image.rows ?? image.height;
  if (!width || !height) {
    return;
  }

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  overlayCanvas.getContext("2d")?.putImageData(overlayImageData(image, layer, { width, height }), 0, 0);
  const result = drawOverlayWithPatientGeometry({ context, targetCanvas, viewport, overlayCanvas, baseAsset, asset, width, height });
  if (result === "incompatible") {
    onStatus(`Skipped ${layer.label}: incompatible geometry.`);
  } else if (result === "fallback") {
    context.drawImage(overlayCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
  }
}

interface OverlayGeometryDrawOptions {
  context: CanvasRenderingContext2D;
  targetCanvas: HTMLCanvasElement;
  viewport: WorldMappableViewportLike;
  overlayCanvas: HTMLCanvasElement;
  baseAsset: ClinicalViewportAsset | undefined;
  asset: ClinicalViewportAsset;
  width: number;
  height: number;
}

function drawOverlayWithPatientGeometry({ context, targetCanvas, viewport, overlayCanvas, baseAsset, asset, width, height }: OverlayGeometryDrawOptions): "drawn" | "fallback" | "incompatible" {
  if (typeof viewport.worldToCanvas !== "function") {
    return "fallback";
  }
  const compatibility = geometryCompatibility(baseAsset?.dicom, asset.dicom);
  if (compatibility === "different-frame" || compatibility === "orientation-mismatch") {
    return "incompatible";
  }
  const plane = imagePlaneFromDicom(asset.dicom);
  const corners = plane ? imagePlaneCorners(plane, width, height) : undefined;
  if (!corners) {
    return "fallback";
  }
  const origin = canvasPoint(viewport, targetCanvas, corners.origin);
  const column = canvasPoint(viewport, targetCanvas, corners.columnEnd);
  const row = canvasPoint(viewport, targetCanvas, corners.rowEnd);
  if (!origin || !column || !row) {
    return "fallback";
  }

  context.save();
  context.setTransform((column[0] - origin[0]) / width, (column[1] - origin[1]) / width, (row[0] - origin[0]) / height, (row[1] - origin[1]) / height, origin[0], origin[1]);
  context.drawImage(overlayCanvas, 0, 0);
  context.restore();
  return "drawn";
}

export function resizeCanvasToViewport(canvas: HTMLCanvasElement, element: HTMLElement): void {
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(1, element.clientWidth);
  const height = Math.max(1, element.clientHeight);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.style.left = "0px";
  canvas.style.top = "0px";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function canvasPoint(viewport: WorldMappableViewportLike, targetCanvas: HTMLCanvasElement, worldPoint: Point3): [number, number] | undefined {
  const point = viewport.worldToCanvas?.(worldPoint);
  if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    return undefined;
  }
  const scaleX = targetCanvas.clientWidth > 0 ? targetCanvas.width / targetCanvas.clientWidth : 1;
  const scaleY = targetCanvas.clientHeight > 0 ? targetCanvas.height / targetCanvas.clientHeight : 1;
  return [point[0] * scaleX, point[1] * scaleY];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "overlay image failed to load";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
