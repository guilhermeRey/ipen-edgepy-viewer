import type { ClinicalViewportRenderer, ClinicalViewportRendererHandle } from "@pycom-next/react-viewer";
import { createDicomFileImageIds, removeDicomFileImageIds, type DicomFileManager } from "./dicomFileImageIds";
import { registerDecodeWorker } from "./decodeWorkerRegistration";
import { selectLoadableInitialImageIndex } from "./initialImageLoad";
import { createCornerstoneOverlayState, type CornerstoneOverlayState } from "./cornerstoneOverlayState";
import { applyCtWindowLevel } from "./cornerstoneWindowLevel";
import { createRtstructMetadataCache, disposeRtstructMetadataCache } from "./rtstructContourCache";
import { jumpToRtstructRoiSlice, publishViewportState, setViewportSliceIndex } from "./cornerstoneViewportCommands";
import {
  bindViewportResize,
  bindWheelStackNavigation,
  waitForElementSize,
  type StackViewportLike,
} from "./cornerstoneViewportLifecycle";
import { cornerstoneCurrentImageData, sameImageShape } from "./cornerstoneCurrentImage";
import { prepareStackViewport } from "./cornerstoneStackSetup";
import { beginCornerstoneRoi } from "./cornerstoneRoi";
import type { RectangularRoiBinding } from "@pycom-next/react-viewer";
import { createTemporaryOverlayRenderer, type TemporaryOverlayRenderer } from "./temporaryOverlayRenderer";
import type { CornerstoneStackHandle, MountCornerstoneStackOptions, RenderingEngineLike, ViewportUpdateOptions } from "./cornerstoneStackTypes";

export const cornerstoneRendererId = "cornerstone";

let cornerstoneInitialized = false;
let nextRenderingEngineId = 1;

export function createCornerstoneStackRenderer(): ClinicalViewportRenderer {
  return {
    id: cornerstoneRendererId,
    render(context) {
      const { element, scan, activeSeries, baseSeries, assets } = context;
      const renderSeries = baseSeries ?? activeSeries;
      const renderAssets = assets.baseSeries.length > 0 ? assets.baseSeries : assets.activeSeries;
      const onStatus = context.onStatus ?? (() => undefined);
      onStatus(renderSeries
        ? `Loading ${renderSeries.label} (${renderAssets.length} instances)...`
        : "No series selected.");

      if (!renderSeries || renderAssets.length === 0) {
        onStatus(renderSeries ? `No local DICOM assets found for ${renderSeries.label}.` : "No series selected.");
        return { destroy() {} };
      }

      let disposed = false;
      let handle: CornerstoneStackHandle | undefined;
      let latestContext = context;

      void mountCornerstoneStack({
        element,
        assets: renderAssets,
        functionalAssets: assets.functionalSeries,
        overlayGroups: assets.overlays,
        ctWindowLevel: context.ctWindowLevel,
        functionalOpacity: context.functionalOverlayOpacity,
        functionalColormap: context.functionalOverlayColormap,
        onStatus,
        onOverlayRenderStatus: context.onOverlayRenderStatus,
        onViewportState: context.onViewportState,
      }).then(
        (nextHandle) => {
          if (disposed) {
            nextHandle.destroy();
            return;
          }
          handle = nextHandle;
          onStatus(`${scan?.label ?? "Selected scan"}: ${renderSeries.label}`);
          if (latestContext !== context) {
            void nextHandle.updateViewport(viewportUpdateFromContext(latestContext));
          }
        },
        (error: unknown) => {
          if (!disposed) {
            onStatus(error instanceof Error ? error.message : "Cornerstone render failed.");
          }
        },
      );

      const controller: ClinicalViewportRendererHandle = {
        destroy() {
          disposed = true;
          handle?.destroy();
        },
        async getCurrentImageData() {
          return disposed ? undefined : handle?.getCurrentImageData();
        },
        beginRectangularRoi(options) {
          return disposed ? undefined : handle?.beginRectangularRoi(options);
        },
        jumpToRtstructRoi(overlayUid, roiNumber) {
          return handle?.jumpToRtstructRoi(overlayUid, roiNumber) ?? false;
        },
        resetView() {
          return handle?.resetView() ?? false;
        },
        setSliceIndex(sliceIndex) {
          return handle?.setSliceIndex(sliceIndex) ?? false;
        },
        async setTemporaryOverlay(overlay) {
          if (disposed || !handle) {
            return false;
          }
          if (!overlay) {
            return handle.setTemporaryOverlay(undefined);
          }
          const image = await handle.getCurrentImageData();
          if (disposed || !sameImageShape(overlay, image)) {
            return false;
          }
          return handle.setTemporaryOverlay(overlay);
        },
        update(nextContext) {
          latestContext = nextContext;
          if (!disposed) {
            void handle?.updateViewport(viewportUpdateFromContext(nextContext));
          }
        },
      };

      return controller;
    },
  };
}

async function mountCornerstoneStack(options: MountCornerstoneStackOptions): Promise<CornerstoneStackHandle> {
  const { element, assets, functionalAssets, overlayGroups, ctWindowLevel, functionalOpacity, functionalColormap, onStatus, onOverlayRenderStatus, onViewportState } = options;
  const [{ RenderingEngine, Enums, getWebWorkerManager, imageLoader, init, isCornerstoneInitialized, setUseCPURendering }, dicomImageLoader] =
    await Promise.all([import("@cornerstonejs/core"), import("@cornerstonejs/dicom-image-loader")]);

  if (!cornerstoneInitialized) {
    if (!isCornerstoneInitialized()) {
      await init();
    }
    setUseCPURendering(true);
    dicomImageLoader.init({ maxWebWorkers: 1 });
    registerDecodeWorker(getWebWorkerManager());
    cornerstoneInitialized = true;
  }

  const renderingEngineId = `pycom-next-cornerstone-${nextRenderingEngineId}`;
  nextRenderingEngineId += 1;
  const viewportId = `${renderingEngineId}-stack`;
  const renderingEngine = new RenderingEngine(renderingEngineId) as RenderingEngineLike;
  const fileManager = dicomImageLoader.wadouri.fileManager as DicomFileManager;
  onStatus(`Preparing ${assets.length} DICOM files...`);
  const imageIds = createDicomFileImageIds(fileManager, assets);
  const lifecycleAbort = new AbortController();
  const rtstructCache = createRtstructMetadataCache();
  let overlayState: CornerstoneOverlayState | undefined;
  let temporaryOverlayRenderer: TemporaryOverlayRenderer | undefined;
  let roiSelection: RectangularRoiBinding | undefined;
  let currentOverlayGroups = overlayGroups;

  const disposeResources = () => {
    lifecycleAbort.abort();
    roiSelection?.invalidate();
    overlayState?.dispose();
    temporaryOverlayRenderer?.dispose();
    disposeRtstructMetadataCache(rtstructCache);
    renderingEngine.destroy();
    removeDicomFileImageIds(fileManager, imageIds);
  };

  const replaceOverlayState = async (nextOptions: ViewportUpdateOptions & { viewport: StackViewportLike }) => {
    const { functionalAssets: nextFunctionalAssets, overlayGroups: nextOverlayGroups, functionalOpacity: nextFunctionalOpacity, functionalColormap: nextFunctionalColormap, viewport } = nextOptions;
    currentOverlayGroups = nextOverlayGroups;
    overlayState?.dispose();
    overlayState = createCornerstoneOverlayState({
      fileManager,
      element,
      viewport,
      baseAssets: assets,
      functionalAssets: nextFunctionalAssets,
      functionalOpacity: nextFunctionalOpacity,
      functionalColormap: nextFunctionalColormap,
      overlayGroups: nextOverlayGroups,
      loadImage: imageLoader.loadAndCacheImage,
      onStatus,
      onOverlayRenderStatus,
      rtstructCache,
    });
    await overlayState.draw(viewport.getCurrentImageIdIndex());
  };

  try {
    await waitForElementSize(element);
    renderingEngine.enableElement({ element, viewportId, type: Enums.ViewportType.STACK });
    const viewport = renderingEngine.getStackViewport(viewportId);
    const initialImageIndex = await selectLoadableInitialImageIndex({
      imageLoader,
      imageIds,
      assets,
      preferredIndex: Math.floor(imageIds.length / 2),
      onStatus,
    });
    onStatus(`Setting DICOM stack ${initialImageIndex + 1}/${imageIds.length}...`);
    await prepareStackViewport({ viewport, renderingEngine, imageIds, initialImageIndex, ctWindowLevel });
    await replaceOverlayState({ functionalAssets, overlayGroups, ctWindowLevel, functionalOpacity, functionalColormap, viewport });
    temporaryOverlayRenderer = createTemporaryOverlayRenderer({ element, viewport, baseAssets: assets, onStatus });
    publishViewportState(onViewportState, viewport, imageIds.length);
    const redrawOverlays = (sliceIndex: number) => {
      void overlayState?.draw(sliceIndex);
      temporaryOverlayRenderer?.draw(sliceIndex);
      publishViewportState(onViewportState, viewport, imageIds.length);
    };
    bindWheelStackNavigation({ element, viewport, imageCount: imageIds.length, signal: lifecycleAbort.signal, onSliceChange: redrawOverlays });
    bindViewportResize({ element, renderingEngine, viewport, signal: lifecycleAbort.signal, onSliceChange: redrawOverlays });

    return {
      destroy: disposeResources,
      async updateViewport(nextOptions) {
        applyCtWindowLevel(viewport, nextOptions.ctWindowLevel);
        await replaceOverlayState({ ...nextOptions, viewport });
        temporaryOverlayRenderer?.draw(viewport.getCurrentImageIdIndex());
        publishViewportState(onViewportState, viewport, imageIds.length);
      },
      resetView() {
        viewport.resetCamera({ resetPan: true, resetZoom: true, resetToCenter: true });
        viewport.render();
        void overlayState?.draw(viewport.getCurrentImageIdIndex());
        temporaryOverlayRenderer?.draw(viewport.getCurrentImageIdIndex());
        publishViewportState(onViewportState, viewport, imageIds.length);
        return true;
      },
      async setSliceIndex(sliceIndex) {
        const changed = await setViewportSliceIndex({ viewport, overlayState, imageCount: imageIds.length, onViewportState, sliceIndex });
        temporaryOverlayRenderer?.draw(viewport.getCurrentImageIdIndex());
        return changed;
      },
      getCurrentImageData() { return cornerstoneCurrentImageData({ assets, imageIds, viewport, loadImage: imageLoader.loadAndCacheImage }); },
      beginRectangularRoi(options) {
        roiSelection?.invalidate();
        roiSelection = beginCornerstoneRoi(element, viewport, options);
        return roiSelection;
      },
      setTemporaryOverlay(overlay) { return temporaryOverlayRenderer?.set(overlay) ?? false; },
      async jumpToRtstructRoi(overlayUid, roiNumber) {
        return jumpToRtstructRoiSlice({
          overlayGroups: currentOverlayGroups,
          assets,
          imageCount: imageIds.length,
          overlayState,
          viewport,
          rtstructCache,
          signal: lifecycleAbort.signal,
          onStatus,
          onViewportState,
          overlayUid,
          roiNumber,
        });
      },
    };
  } catch (error) {
    disposeResources();
    throw error;
  }
}

function viewportUpdateFromContext(context: Parameters<ClinicalViewportRenderer["render"]>[0]): ViewportUpdateOptions {
  return {
    functionalAssets: context.assets.functionalSeries,
    overlayGroups: context.assets.overlays,
    ctWindowLevel: context.ctWindowLevel,
    functionalOpacity: context.functionalOverlayOpacity,
    functionalColormap: context.functionalOverlayColormap,
  };
}
