import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";
import type { FunctionalOverlayColormap } from "@pycom-next/react-viewer/overlayPresentation";

export interface FusionOverlayLayer {
  label: string;
  purpose: "functional" | "mask" | "dose" | "rtstruct";
  assets: readonly ClinicalViewportAsset[];
  imageIds: readonly string[];
  color: string;
  opacity: number;
  colormap?: FunctionalOverlayColormap | undefined;
  overlayUid?: string | undefined;
  visibleRtstructRoiNumbers?: readonly number[] | undefined;
  rtstructRoiColors?: ReadonlyMap<number, string> | undefined;
}

export interface RuntimeImageLike {
  minPixelValue: number;
  maxPixelValue: number;
  width: number;
  height: number;
  rows?: number;
  columns?: number;
  getPixelData(): ArrayLike<number>;
}

export interface WorldMappableViewportLike {
  getCurrentImageIdIndex(): number;
  worldToCanvas?(point: number[]): [number, number];
}
