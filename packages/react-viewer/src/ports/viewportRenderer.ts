import type { ClinicalScan, ClinicalStudy, DicomSeriesRef, OverlayRef } from "@pycom-next/core";
import type { CtWindowLevel } from "../presentation/ctWindowLevel";
import type { FunctionalOverlayColormap } from "../presentation/overlayPresentation";

export interface ClinicalViewportRenderContext {
  element: HTMLElement;
  onStatus?: ((message: string) => void) | undefined;
  onOverlayRenderStatus?: ((status: ClinicalViewportOverlayRenderStatus) => void) | undefined;
  onViewportState?: ((state: ClinicalViewportState) => void) | undefined;
  study: ClinicalStudy;
  scan?: ClinicalScan | undefined;
  activeSeries?: DicomSeriesRef | undefined;
  baseSeries?: DicomSeriesRef | undefined;
  functionalSeries?: DicomSeriesRef | undefined;
  ctWindowLevel?: CtWindowLevel | undefined;
  functionalOverlayOpacity?: number | undefined;
  functionalOverlayColormap?: FunctionalOverlayColormap | undefined;
  overlays: readonly OverlayRef[];
  assets: ClinicalViewportResolvedAssets;
}

export interface ClinicalViewportOverlayRenderStatus {
  overlayUid: string;
  state: "loading" | "visible" | "empty" | "failed";
  contourCount?: number | undefined;
  pointCount?: number | undefined;
  loadMs?: number | undefined;
  matchMode?: "sop" | "geometry" | undefined;
  message?: string;
}

export interface ClinicalViewportState {
  sliceCount: number;
  sliceIndex: number;
}

export interface ClinicalViewportRenderer {
  readonly id: string;
  render(context: ClinicalViewportRenderContext): void | (() => void) | ClinicalViewportRendererHandle;
}

export interface ClinicalViewportRendererHandle {
  destroy(): void;
  getCurrentImageData?(): Promise<ClinicalViewportImageData | undefined>;
  jumpToRtstructRoi?(overlayUid: string, roiNumber: number): boolean | Promise<boolean>;
  resetView?(): boolean | Promise<boolean>;
  setSliceIndex?(sliceIndex: number): boolean | Promise<boolean>;
  setTemporaryOverlay?(overlay: ClinicalViewportTemporaryOverlay | undefined): boolean | Promise<boolean>;
  update?(context: ClinicalViewportRenderContext): void | Promise<void>;
}

export interface ClinicalViewportImageData {
  width: number;
  height: number;
  sliceIndex: number;
  values: Float32Array;
  imageId?: string | undefined;
  seriesUid?: string | undefined;
}

export interface ClinicalViewportTemporaryOverlay {
  id: string;
  label: string;
  width: number;
  height: number;
  sliceIndex: number;
  values: Float32Array;
  color?: string | undefined;
  opacity?: number | undefined;
}

export interface ClinicalViewportAsset {
  path: string;
  data: ArrayBuffer | Blob;
  dicom?: ClinicalViewportDicomMetadata | undefined;
}

export interface ClinicalViewportDicomMetadata {
  sopInstanceUid?: string;
  seriesInstanceUid?: string;
  studyInstanceUid?: string;
  modality?: string;
  frameOfReferenceUid?: string;
  instanceNumber?: number;
  imagePositionPatient?: readonly number[];
  imageOrientationPatient?: readonly number[];
  pixelSpacing?: readonly number[];
  transferSyntaxUid?: string;
}

export interface ClinicalViewportOverlayAssets {
  overlay: OverlayRef;
  assets: readonly ClinicalViewportAsset[];
}

export interface ClinicalViewportResolvedAssets {
  activeSeries: readonly ClinicalViewportAsset[];
  baseSeries: readonly ClinicalViewportAsset[];
  functionalSeries: readonly ClinicalViewportAsset[];
  overlays: readonly ClinicalViewportOverlayAssets[];
}

export interface ClinicalViewportAssetResolver {
  resolveSeriesAssets(
    series: DicomSeriesRef,
  ): Promise<readonly ClinicalViewportAsset[]> | readonly ClinicalViewportAsset[];
  resolveOverlayAssets?(
    overlay: OverlayRef,
  ): Promise<readonly ClinicalViewportAsset[]> | readonly ClinicalViewportAsset[];
}
