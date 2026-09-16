import type { ClinicalViewportAsset, ClinicalViewportOverlayAssets, ClinicalViewportOverlayRenderStatus } from "@pycom-next/react-viewer";
import type { FunctionalOverlayColormap } from "@pycom-next/react-viewer/overlayPresentation";
import { createDicomFileImageIds, removeDicomFileImageIds, type DicomFileManager } from "./dicomFileImageIds";
import {
  createFusionOverlayRenderer,
  functionalOverlayLayer,
  maskOverlayLayers,
  type FusionOverlayRenderer,
} from "./fusionOverlayRenderer";
import type { RuntimeImageLike, WorldMappableViewportLike } from "./fusionOverlayTypes";
import { isMhdDoseAssetGroup, mhdDoseOverlayLayers } from "./mhdDoseVolume";
import type { RtstructMetadataCache } from "./rtstructContourCache";
import { rtstructOverlayLayers } from "./rtstructContourRenderer";

export interface CornerstoneOverlayState {
  draw(sliceIndex: number): Promise<void>;
  dispose(): void;
}

export interface CornerstoneOverlayStateOptions {
  fileManager: DicomFileManager;
  element: HTMLElement;
  viewport: WorldMappableViewportLike;
  baseAssets: readonly ClinicalViewportAsset[];
  functionalAssets: readonly ClinicalViewportAsset[];
  functionalOpacity?: number | undefined;
  functionalColormap?: FunctionalOverlayColormap | undefined;
  overlayGroups: readonly ClinicalViewportOverlayAssets[];
  loadImage(imageId: string): Promise<RuntimeImageLike>;
  onStatus(message: string): void;
  onOverlayRenderStatus?: ((status: ClinicalViewportOverlayRenderStatus) => void) | undefined;
  rtstructCache?: RtstructMetadataCache | undefined;
}

export function createCornerstoneOverlayState(options: CornerstoneOverlayStateOptions): CornerstoneOverlayState {
  const functionalImageIds = createDicomFileImageIds(options.fileManager, options.functionalAssets);
  const overlayImageIds = options.overlayGroups.map((overlay) => isMhdDoseAssetGroup(overlay.assets) ? [] : createDicomFileImageIds(options.fileManager, overlay.assets));
  const renderer = createFusionRenderer(options, functionalImageIds, overlayImageIds);

  return {
    async draw(sliceIndex: number): Promise<void> {
      await renderer?.draw(sliceIndex);
    },
    dispose(): void {
      renderer?.dispose();
      removeDicomFileImageIds(options.fileManager, functionalImageIds);
      overlayImageIds.forEach((ids) => removeDicomFileImageIds(options.fileManager, ids));
    },
  };
}

function createFusionRenderer(
  options: CornerstoneOverlayStateOptions,
  functionalImageIds: readonly string[],
  overlayImageIds: readonly string[][],
): FusionOverlayRenderer | undefined {
  const layers = [
    functionalOverlayLayer({ assets: options.functionalAssets, imageIds: functionalImageIds, opacity: options.functionalOpacity, colormap: options.functionalColormap }),
    ...mhdDoseOverlayLayers(options.overlayGroups),
    ...maskOverlayLayers(options.overlayGroups, overlayImageIds),
    ...rtstructOverlayLayers(options.overlayGroups),
  ].filter((layer): layer is NonNullable<typeof layer> => Boolean(layer));

  return createFusionOverlayRenderer({
    element: options.element,
    viewport: options.viewport,
    baseAssets: options.baseAssets,
    layers,
    loadImage: options.loadImage,
    onStatus: options.onStatus,
    onOverlayRenderStatus: options.onOverlayRenderStatus,
    rtstructCache: options.rtstructCache,
  });
}
