import { useEffect, useRef, useState } from "react";
import type { ClinicalStudy, DicomSeriesRef, OverlayRef } from "@pycom-next/core";
import type { CtWindowLevel } from "../presentation/ctWindowLevel";
import type { FunctionalOverlayColormap } from "../presentation/overlayPresentation";
import type {
  ClinicalViewportAssetResolver,
  ClinicalViewportOverlayRenderStatus,
  ClinicalViewportRenderContext,
  ClinicalViewportRenderer,
  ClinicalViewportRendererHandle,
  ClinicalViewportResolvedAssets,
  ClinicalViewportState,
} from "../ports/viewportRenderer";

export interface UseViewportRendererOptions {
  assetResolver?: ClinicalViewportAssetResolver | undefined;
  viewportRenderer?: ClinicalViewportRenderer | undefined;
  study: ClinicalStudy;
  activeScan: ClinicalStudy["scans"][number] | undefined;
  activeSeries?: DicomSeriesRef | undefined;
  baseSeries?: DicomSeriesRef | undefined;
  functionalSeries?: DicomSeriesRef | undefined;
  ctWindowLevel?: CtWindowLevel | undefined;
  functionalOverlayOpacity?: number | undefined;
  functionalOverlayColormap?: FunctionalOverlayColormap | undefined;
  activeOverlays: readonly OverlayRef[];
  activeOverlayKey: string;
  onRendererHandleChange?: ((handle: ClinicalViewportRendererHandle | undefined) => void) | undefined;
}

interface ViewportAssetRequest {
  assetResolver: ClinicalViewportAssetResolver | undefined;
  activeSeries: DicomSeriesRef | undefined;
  baseSeries: DicomSeriesRef | undefined;
  functionalSeries: DicomSeriesRef | undefined;
  overlays: readonly OverlayRef[];
}

interface RenderContextInput {
  element: HTMLElement;
  onStatus(message: string): void;
  setViewportState(state: ClinicalViewportState): void;
  setOverlayRenderStatusByUid(update: (current: ReadonlyMap<string, ClinicalViewportOverlayRenderStatus>) => ReadonlyMap<string, ClinicalViewportOverlayRenderStatus>): void;
  study: ClinicalStudy;
  scan: ClinicalStudy["scans"][number] | undefined;
  activeSeries: DicomSeriesRef | undefined;
  baseSeries: DicomSeriesRef | undefined;
  functionalSeries: DicomSeriesRef | undefined;
  ctWindowLevel: CtWindowLevel | undefined;
  functionalOverlayOpacity: number | undefined;
  functionalOverlayColormap: FunctionalOverlayColormap | undefined;
  overlays: readonly OverlayRef[];
  assets: ClinicalViewportResolvedAssets;
}

export function useViewportRenderer(options: UseViewportRendererOptions) {
  const viewportElementRef = useRef<HTMLDivElement | null>(null);
  const rendererHandleRef = useRef<ClinicalViewportRendererHandle | undefined>(undefined);
  const [viewportStatus, setViewportStatus] = useState("Viewport ready.");
  const [viewportState, setViewportState] = useState<ClinicalViewportState | undefined>(undefined);
  const [overlayRenderStatusByUid, setOverlayRenderStatusByUid] = useState<ReadonlyMap<string, ClinicalViewportOverlayRenderStatus>>(() => new Map());
  const { assetResolver, viewportRenderer, study, activeScan, activeSeries, baseSeries, functionalSeries, ctWindowLevel, functionalOverlayOpacity, functionalOverlayColormap, activeOverlays, activeOverlayKey, onRendererHandleChange } = options;

  useEffect(() => {
    const element = viewportElementRef.current;
    if (!element || !viewportRenderer) {
      return undefined;
    }

    let disposed = false;
    const renderViewport = async () => {
      setViewportStatus("Preparing viewport...");
      setViewportState(undefined);
      setOverlayRenderStatusByUid(new Map());
      const assets = await resolveViewportAssets({ assetResolver, activeSeries, baseSeries, functionalSeries, overlays: activeOverlays });
      if (!disposed) {
        element.replaceChildren();
        rendererHandleRef.current = rendererHandleFromResult(
          viewportRenderer.render(renderContext({ element, onStatus: setViewportStatus, setViewportState, setOverlayRenderStatusByUid, study, scan: activeScan, activeSeries, baseSeries, functionalSeries, ctWindowLevel, functionalOverlayOpacity, functionalOverlayColormap, overlays: activeOverlays, assets })),
        );
        onRendererHandleChange?.(rendererHandleRef.current);
      }
    };

    void renderViewport();
    return () => {
      disposed = true;
      rendererHandleRef.current?.destroy();
      rendererHandleRef.current = undefined;
      onRendererHandleChange?.(undefined);
      element.replaceChildren();
    };
  }, [assetResolver, viewportRenderer, study, activeScan, activeSeries, baseSeries, onRendererHandleChange]);

  useEffect(() => {
    const handle = rendererHandleRef.current;
    if (!handle?.update) {
      return undefined;
    }

    let disposed = false;
    const updateViewport = async () => {
      const assets = await resolveViewportAssets({ assetResolver, activeSeries, baseSeries, functionalSeries, overlays: activeOverlays });
      if (!disposed && viewportElementRef.current) {
        await handle.update?.(
          renderContext({ element: viewportElementRef.current, onStatus: setViewportStatus, setViewportState, setOverlayRenderStatusByUid, study, scan: activeScan, activeSeries, baseSeries, functionalSeries, ctWindowLevel, functionalOverlayOpacity, functionalOverlayColormap, overlays: activeOverlays, assets }),
        );
      }
    };

    void updateViewport();
    return () => {
      disposed = true;
    };
  }, [assetResolver, study, activeScan, activeSeries, baseSeries, functionalSeries, ctWindowLevel, functionalOverlayOpacity, functionalOverlayColormap, activeOverlayKey]);

  async function jumpToRtstructRoi(overlayUid: string, roiNumber: number): Promise<boolean> {
    return Boolean(await rendererHandleRef.current?.jumpToRtstructRoi?.(overlayUid, roiNumber));
  }

  async function resetView(): Promise<boolean> {
    return Boolean(await rendererHandleRef.current?.resetView?.());
  }

  async function setSliceIndex(sliceIndex: number): Promise<boolean> {
    return Boolean(await rendererHandleRef.current?.setSliceIndex?.(sliceIndex));
  }

  return { viewportElementRef, viewportStatus, viewportState, overlayRenderStatusByUid, jumpToRtstructRoi, resetView, setSliceIndex };
}

function renderContext(input: RenderContextInput): ClinicalViewportRenderContext {
  return {
    element: input.element,
    onStatus: input.onStatus,
    onViewportState: input.setViewportState,
    onOverlayRenderStatus: (status) => {
      input.setOverlayRenderStatusByUid((current) => new Map(current).set(status.overlayUid, status));
    },
    study: input.study,
    scan: input.scan,
    activeSeries: input.activeSeries,
    baseSeries: input.baseSeries,
    functionalSeries: input.functionalSeries,
    ctWindowLevel: input.ctWindowLevel,
    functionalOverlayOpacity: input.functionalOverlayOpacity,
    functionalOverlayColormap: input.functionalOverlayColormap,
    overlays: input.overlays,
    assets: input.assets,
  };
}

function rendererHandleFromResult(result: void | (() => void) | ClinicalViewportRendererHandle): ClinicalViewportRendererHandle | undefined {
  if (!result) {
    return undefined;
  }
  if (typeof result === "function") {
    return { destroy: result };
  }
  return result;
}

async function resolveViewportAssets(request: ViewportAssetRequest): Promise<ClinicalViewportResolvedAssets> {
  if (!request.assetResolver) {
    return { activeSeries: [], baseSeries: [], functionalSeries: [], overlays: [] };
  }

  const [activeAssets, baseAssets, functionalAssets, overlayAssets] = await Promise.all([
    request.activeSeries ? request.assetResolver.resolveSeriesAssets(request.activeSeries) : [],
    request.baseSeries ? request.assetResolver.resolveSeriesAssets(request.baseSeries) : [],
    request.functionalSeries ? request.assetResolver.resolveSeriesAssets(request.functionalSeries) : [],
    Promise.all(
      request.overlays.map(async (overlay) => ({
        overlay,
        assets: request.assetResolver?.resolveOverlayAssets ? await request.assetResolver.resolveOverlayAssets(overlay) : [],
      })),
    ),
  ]);

  return { activeSeries: activeAssets, baseSeries: baseAssets, functionalSeries: functionalAssets, overlays: overlayAssets };
}
