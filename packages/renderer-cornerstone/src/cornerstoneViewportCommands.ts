import type { ClinicalViewportAsset, ClinicalViewportOverlayAssets, ClinicalViewportState } from "@pycom-next/react-viewer";
import type { CornerstoneOverlayState } from "./cornerstoneOverlayState";
import { firstRtstructRoiSliceIndex } from "./rtstructSliceNavigation";
import type { RtstructMetadataCache } from "./rtstructContourCache";
import type { StackViewportLike } from "./cornerstoneViewportLifecycle";

export interface ViewportSliceCommandOptions {
  viewport: StackViewportLike;
  overlayState: CornerstoneOverlayState | undefined;
  imageCount: number;
  onViewportState: ((state: ClinicalViewportState) => void) | undefined;
  sliceIndex: number;
}

export async function setViewportSliceIndex({ viewport, overlayState, imageCount, onViewportState, sliceIndex }: ViewportSliceCommandOptions): Promise<boolean> {
  if (imageCount <= 0) {
    return false;
  }
  const nextIndex = clamp(sliceIndex, 0, imageCount - 1);
  await viewport.setImageIdIndex(nextIndex);
  viewport.render();
  await overlayState?.draw(nextIndex);
  publishViewportState(onViewportState, viewport, imageCount);
  return true;
}

export function publishViewportState(
  onViewportState: ((state: ClinicalViewportState) => void) | undefined,
  viewport: StackViewportLike,
  imageCount: number,
): void {
  onViewportState?.({ sliceCount: imageCount, sliceIndex: clamp(viewport.getCurrentImageIdIndex(), 0, Math.max(0, imageCount - 1)) });
}

export interface RtstructRoiJumpCommandOptions {
  overlayGroups: readonly ClinicalViewportOverlayAssets[];
  assets: readonly ClinicalViewportAsset[];
  imageCount: number;
  overlayState: CornerstoneOverlayState | undefined;
  viewport: StackViewportLike;
  rtstructCache: RtstructMetadataCache;
  signal: AbortSignal;
  onStatus(message: string): void;
  onViewportState: ((state: ClinicalViewportState) => void) | undefined;
  overlayUid: string;
  roiNumber: number;
}

export async function jumpToRtstructRoiSlice(options: RtstructRoiJumpCommandOptions): Promise<boolean> {
  const { overlayGroups, assets, imageCount, overlayState, viewport, rtstructCache, signal, onStatus, onViewportState, overlayUid, roiNumber } = options;
  const overlayGroup = overlayGroups.find((group) => group.overlay.uid === overlayUid && group.overlay.kind === "rtstruct");
  if (!overlayGroup) {
    return false;
  }
  onStatus(`Locating ROI ${roiNumber} in ${overlayGroup.overlay.label}...`);
  try {
    const sliceIndex = await firstRtstructRoiSliceIndex({ baseAssets: assets, rtstructAssets: overlayGroup.assets, roiNumber, cache: rtstructCache });
    if (signal.aborted) {
      return false;
    }
    if (sliceIndex === undefined) {
      onStatus(`No contours found for ROI ${roiNumber} in ${overlayGroup.overlay.label}.`);
      return false;
    }
    await setViewportSliceIndex({ viewport, overlayState, imageCount, onViewportState, sliceIndex });
    onStatus(`ROI ${roiNumber}: slice ${sliceIndex + 1}/${imageCount}.`);
    return true;
  } catch (error) {
    if (!signal.aborted) {
      onStatus(error instanceof Error ? error.message : `Failed to locate ROI ${roiNumber}.`);
    }
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
