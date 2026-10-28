import type {
  ClinicalViewportAsset,
  ClinicalViewportOverlayAssets,
  ClinicalViewportRenderer,
  ClinicalViewportRendererHandle,
  ClinicalViewportState,
} from "@pycom-next/react-viewer";
import type { CtWindowLevel } from "@pycom-next/react-viewer/ctWindowLevel";
import type { FunctionalOverlayColormap } from "@pycom-next/react-viewer/overlayPresentation";
import type { StackViewportLike } from "./cornerstoneViewportLifecycle";

export interface CornerstoneStackHandle {
  destroy(): void;
  beginRectangularRoi: NonNullable<ClinicalViewportRendererHandle["beginRectangularRoi"]>;
  getCurrentImageData(): ReturnType<NonNullable<ClinicalViewportRendererHandle["getCurrentImageData"]>>;
  jumpToRtstructRoi(overlayUid: string, roiNumber: number): Promise<boolean>;
  resetView(): boolean;
  setSliceIndex(sliceIndex: number): Promise<boolean>;
  setTemporaryOverlay(overlay: Parameters<NonNullable<ClinicalViewportRendererHandle["setTemporaryOverlay"]>>[0]): boolean;
  updateViewport(options: ViewportUpdateOptions): Promise<void>;
}

export interface MountCornerstoneStackOptions {
  element: HTMLElement;
  assets: readonly ClinicalViewportAsset[];
  functionalAssets: readonly ClinicalViewportAsset[];
  overlayGroups: readonly ClinicalViewportOverlayAssets[];
  ctWindowLevel: CtWindowLevel | undefined;
  functionalOpacity: number | undefined;
  functionalColormap: FunctionalOverlayColormap | undefined;
  onStatus(message: string): void;
  onOverlayRenderStatus: Parameters<NonNullable<ClinicalViewportRenderer["render"]>>[0]["onOverlayRenderStatus"];
  onViewportState: ((state: ClinicalViewportState) => void) | undefined;
}

export interface ViewportUpdateOptions {
  functionalAssets: readonly ClinicalViewportAsset[];
  overlayGroups: readonly ClinicalViewportOverlayAssets[];
  ctWindowLevel: CtWindowLevel | undefined;
  functionalOpacity: number | undefined;
  functionalColormap: FunctionalOverlayColormap | undefined;
}

export interface RenderingEngineLike {
  enableElement(options: { element: HTMLElement; viewportId: string; type: unknown }): void;
  getStackViewport(viewportId: string): StackViewportLike;
  resize(immediate?: boolean, keepCamera?: boolean): void;
  destroy(): void;
}
