import type { RtstructMetadata } from "@pycom-next/dicom";
import type { ClinicalViewportAsset, ClinicalViewportOverlayAssets, ClinicalViewportOverlayRenderStatus } from "@pycom-next/react-viewer";
import { overlayColor, overlayOpacity } from "@pycom-next/react-viewer/overlayPresentation";
import { cachedRtstructMetadata, rtstructLoadMs, rtstructPointCount, type RtstructMetadataCache } from "./rtstructContourCache";
import { imagePlaneFromDicom, type DicomImagePlane } from "./dicomGeometry";
import type { FusionOverlayLayer, WorldMappableViewportLike } from "./fusionOverlayTypes";
import type { Point3 } from "./dicomGeometry";
import { rtstructContourMatchMode } from "./rtstructSliceMatch";

export type CanvasPointMapper = (
  viewport: WorldMappableViewportLike,
  targetCanvas: HTMLCanvasElement,
  worldPoint: Point3,
) => [number, number] | undefined;

export function rtstructOverlayLayers(overlays: readonly ClinicalViewportOverlayAssets[]): FusionOverlayLayer[] {
  return overlays.flatMap((overlay, index) => {
    if (overlay.overlay.kind !== "rtstruct" || overlay.assets.length === 0) {
      return [];
    }
    return [{
      label: overlay.overlay.label,
      purpose: "rtstruct",
      assets: overlay.assets,
      imageIds: [],
      color: overlayColor(overlay.overlay, index),
      opacity: overlayOpacity(overlay.overlay),
      overlayUid: overlay.overlay.uid,
      visibleRtstructRoiNumbers: rtstructVisibleRoiNumbers(overlay.overlay.metadata?.rtstructVisibleRoiNumbers),
      rtstructRoiColors: rtstructRoiColors(overlay.overlay.metadata?.rtstructRoiColors),
    }];
  });
}

export interface RtstructLayerDrawOptions {
  context: CanvasRenderingContext2D;
  targetCanvas: HTMLCanvasElement;
  viewport: WorldMappableViewportLike;
  baseAsset: ClinicalViewportAsset | undefined;
  layer: FusionOverlayLayer;
  rtstructCache: RtstructMetadataCache;
  onStatus(message: string): void;
  canvasPoint: CanvasPointMapper;
  isCurrent?: (() => boolean) | undefined;
  onOverlayRenderStatus?: ((status: ClinicalViewportOverlayRenderStatus) => void) | undefined;
}

export async function drawRtstructLayer(options: RtstructLayerDrawOptions): Promise<void> {
  const { context, targetCanvas, viewport, baseAsset, layer, rtstructCache, onStatus, canvasPoint, onOverlayRenderStatus } = options;
  const isCurrent = options.isCurrent ?? (() => true);
  const sopInstanceUid = drawableBaseSopInstanceUid(baseAsset, viewport);
  if (!sopInstanceUid) {
    return;
  }
  const basePlane = imagePlaneFromDicom(baseAsset?.dicom);
  setRtstructLoadingStatus(layer, rtstructCache, onOverlayRenderStatus);
  const summary: RtstructDrawSummary = { contourCount: 0 };
  let didFail = false;
  for (const asset of layer.assets) {
    const result = await drawRtstructAsset({ asset, context, targetCanvas, viewport, sopInstanceUid, basePlane, layer, rtstructCache, canvasPoint, isCurrent });
    const applied = applyRtstructAssetDrawResult({ result, summary, layer, onOverlayRenderStatus, onStatus });
    if (applied.stale) {
      return;
    }
    didFail = didFail || applied.failed;
  }
  if (didFail && summary.contourCount === 0) {
    return;
  }
  setRtstructStatus(layer, onOverlayRenderStatus, rtstructFinalStatus(summary, rtstructCache, layer.assets));
}

function drawableBaseSopInstanceUid(baseAsset: ClinicalViewportAsset | undefined, viewport: WorldMappableViewportLike): string | undefined {
  return typeof viewport.worldToCanvas === "function" ? baseAsset?.dicom?.sopInstanceUid : undefined;
}

interface RtstructAssetResultApplyOptions {
  result: RtstructAssetDrawResult;
  summary: RtstructDrawSummary;
  layer: FusionOverlayLayer;
  onStatus(message: string): void;
  onOverlayRenderStatus: ((status: ClinicalViewportOverlayRenderStatus) => void) | undefined;
}

function applyRtstructAssetDrawResult({ result, summary, layer, onOverlayRenderStatus, onStatus }: RtstructAssetResultApplyOptions): { stale: boolean; failed: boolean } {
  if (result.state === "stale") {
    return { stale: true, failed: false };
  }
  if (result.state === "failed") {
    setRtstructStatus(layer, onOverlayRenderStatus, { state: "failed", message: result.message });
    onStatus(`Skipped ${layer.label}: ${result.message}`);
    return { stale: false, failed: true };
  }
  summary.contourCount += result.summary.contourCount;
  summary.matchMode = rtstructMatchMode(summary.matchMode, result.summary.matchMode);
  return { stale: false, failed: false };
}

interface RtstructAssetDrawOptions {
  asset: ClinicalViewportAsset;
  context: CanvasRenderingContext2D;
  targetCanvas: HTMLCanvasElement;
  viewport: WorldMappableViewportLike;
  sopInstanceUid: string;
  basePlane: DicomImagePlane | undefined;
  layer: FusionOverlayLayer;
  rtstructCache: RtstructMetadataCache;
  canvasPoint: CanvasPointMapper;
  isCurrent(): boolean;
}

type RtstructAssetDrawResult =
  | { state: "drawn"; summary: RtstructDrawSummary }
  | { state: "failed"; message: string }
  | { state: "stale" };

async function drawRtstructAsset(options: RtstructAssetDrawOptions): Promise<RtstructAssetDrawResult> {
  try {
    const metadata = await cachedRtstructMetadata(options.asset, options.rtstructCache);
    if (!options.isCurrent()) {
      return { state: "stale" };
    }
    return { state: "drawn", summary: drawRtstructContours({ ...options, metadata }) };
  } catch (error) {
    return !options.isCurrent() || isWorkerClientDisposedError(error)
      ? { state: "stale" }
      : { state: "failed", message: errorMessage(error) };
  }
}

function setRtstructLoadingStatus(
  layer: FusionOverlayLayer,
  cache: RtstructMetadataCache,
  onOverlayRenderStatus: ((status: ClinicalViewportOverlayRenderStatus) => void) | undefined,
): void {
  const pendingAssetCount = layer.assets.filter((asset) => !cache.metadataByPath.has(asset.path)).length;
  if (pendingAssetCount > 0) {
    setRtstructStatus(layer, onOverlayRenderStatus, { state: "loading", message: `${pendingAssetCount} RTSTRUCT file${pendingAssetCount === 1 ? "" : "s"}` });
  }
}

function rtstructFinalStatus(
  summary: RtstructDrawSummary,
  cache: RtstructMetadataCache,
  assets: readonly ClinicalViewportAsset[],
): Omit<ClinicalViewportOverlayRenderStatus, "overlayUid"> {
  const pointCount = rtstructPointCount(cache, assets);
  const loadMs = rtstructLoadMs(cache, assets);
  return summary.contourCount > 0
    ? { state: "visible", contourCount: summary.contourCount, pointCount, loadMs, matchMode: summary.matchMode }
    : { state: "empty", contourCount: 0, pointCount, loadMs };
}

interface RtstructContoursDrawOptions {
  context: CanvasRenderingContext2D;
  targetCanvas: HTMLCanvasElement;
  viewport: WorldMappableViewportLike;
  metadata: RtstructMetadata | undefined;
  sopInstanceUid: string;
  basePlane: DicomImagePlane | undefined;
  layer: FusionOverlayLayer;
  canvasPoint: CanvasPointMapper;
}

function drawRtstructContours({ context, targetCanvas, viewport, metadata, sopInstanceUid, basePlane, layer, canvasPoint }: RtstructContoursDrawOptions): RtstructDrawSummary {
  const summary: RtstructDrawSummary = { contourCount: 0 };
  if (!metadata) {
    return summary;
  }
  context.save();
  context.globalAlpha = layer.opacity;
  context.lineWidth = Math.max(1, window.devicePixelRatio || 1) * 2;
  for (const structure of metadata.structures) {
    if (!isRtstructStructureVisible(structure.roiNumber, layer.visibleRtstructRoiNumbers)) {
      continue;
    }
    for (const contour of structure.contours ?? []) {
      if (!contour.points) {
        continue;
      }
      const matchMode = rtstructContourMatchMode(contour, sopInstanceUid, basePlane);
      if (!matchMode) {
        continue;
      }
      context.strokeStyle = rtstructStructureColor(layer, structure.roiNumber);
      drawRtstructContour({ context, targetCanvas, viewport, points: contour.points, canvasPoint });
      summary.contourCount += 1;
      summary.matchMode = rtstructMatchMode(summary.matchMode, matchMode);
    }
  }
  context.restore();
  return summary;
}

type RtstructMatchMode = "sop" | "geometry";

interface RtstructDrawSummary {
  contourCount: number;
  matchMode?: RtstructMatchMode | undefined;
}

function rtstructVisibleRoiNumbers(value: unknown): readonly number[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : undefined;
}

function rtstructRoiColors(value: unknown): ReadonlyMap<number, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value)
    .map(([roiNumber, color]) => [Number(roiNumber), color] as const)
    .filter((entry): entry is readonly [number, string] => Number.isFinite(entry[0]) && typeof entry[1] === "string");
  return entries.length > 0 ? new Map(entries) : undefined;
}

function rtstructStructureColor(layer: FusionOverlayLayer, roiNumber: number | undefined): string {
  return roiNumber === undefined ? layer.color : layer.rtstructRoiColors?.get(roiNumber) ?? layer.color;
}

function isRtstructStructureVisible(roiNumber: number | undefined, visibleRoiNumbers: readonly number[] | undefined): boolean {
  return !visibleRoiNumbers || (roiNumber !== undefined && visibleRoiNumbers.includes(roiNumber));
}

function rtstructMatchMode(
  current: RtstructMatchMode | undefined,
  next: RtstructMatchMode | undefined,
): RtstructMatchMode | undefined {
  return current === "geometry" || next === "geometry" ? "geometry" : current ?? next;
}

function setRtstructStatus(
  layer: FusionOverlayLayer,
  onOverlayRenderStatus: ((status: ClinicalViewportOverlayRenderStatus) => void) | undefined,
  status: Omit<ClinicalViewportOverlayRenderStatus, "overlayUid">,
): void {
  if (layer.overlayUid) {
    onOverlayRenderStatus?.({ overlayUid: layer.overlayUid, ...status });
  }
}

interface RtstructContourDrawOptions {
  context: CanvasRenderingContext2D;
  targetCanvas: HTMLCanvasElement;
  viewport: WorldMappableViewportLike;
  points: readonly number[];
  canvasPoint: CanvasPointMapper;
}

function drawRtstructContour({ context, targetCanvas, viewport, points, canvasPoint }: RtstructContourDrawOptions): void {
  context.beginPath();
  let didMove = false;
  for (let index = 0; index + 2 < points.length; index += 3) {
    const point = canvasPoint(viewport, targetCanvas, [points[index], points[index + 1], points[index + 2]]);
    if (!point) {
      continue;
    }
    if (!didMove) {
      context.moveTo(point[0], point[1]);
      didMove = true;
    } else {
      context.lineTo(point[0], point[1]);
    }
  }
  if (didMove) {
    context.closePath();
    context.stroke();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "RTSTRUCT contour failed to load";
}

function isWorkerClientDisposedError(error: unknown): boolean {
  return error instanceof Error && error.message === "Worker client disposed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
