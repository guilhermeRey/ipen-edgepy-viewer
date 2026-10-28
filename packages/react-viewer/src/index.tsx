import { useEffect, useState, type ReactNode } from "react";
import { buildViewerControlPlaneSnapshot, type ClinicalStudy, type DicomSeriesRef, type OverlayRef, type ViewerControlPlaneSnapshot } from "@pycom-next/core";
import { ClinicalToolbarControls } from "./components/ClinicalToolbarControls";
import { ViewerActivityRail, type ViewerPanelKey } from "./components/ViewerActivityRail";
import { ViewerChrome } from "./components/ViewerChrome";
import { ViewerDrawers, type ViewerCustomPanel } from "./components/ViewerDrawers";
import { useCinePlayback } from "./hooks/useCinePlayback";
import { useViewportRenderer } from "./hooks/useViewportRenderer";
import { activeOverlaysWithPresentation } from "./presentation/activeOverlays";
import { clampCtWindowLevel, viewerWindowLevel, type CtWindowLevel } from "./presentation/ctWindowLevel";
import {
  clampOverlayOpacity,
  functionalOverlayColormap,
  functionalOverlayOpacity,
  overlayOpacity,
  renderableOverlays,
  type FunctionalOverlayColormap,
} from "./presentation/overlayPresentation";
import { focusRtstructRoiState, setAllRtstructRoisState, toggleRtstructRoiState } from "./presentation/rtstructRoiState";
import {
  defaultSeriesForScan,
  overlaysForScan,
  scanById,
  selectedSeriesForScan,
  seriesForScan,
} from "./presentation/studyPresentation";
import type { ClinicalViewportAssetResolver, ClinicalViewportRenderer } from "./ports/viewportRenderer";

export type {
  ClinicalViewportAsset,
  ClinicalViewportAssetResolver,
  ClinicalViewportOverlayAssets,
  ClinicalViewportOverlayRenderStatus,
  ClinicalViewportImageData,
  ClinicalViewportImageIdentity,
  ClinicalViewportRoi,
  ClinicalViewportRoiOptions,
  ClinicalViewportRoiSession,
  ClinicalViewportRenderContext,
  ClinicalViewportRenderer,
  ClinicalViewportRendererHandle,
  ClinicalViewportResolvedAssets,
  ClinicalViewportState,
  ClinicalViewportTemporaryOverlay,
} from "./ports/viewportRenderer";
export type { ViewerCustomPanel, ViewerCustomPanelPresentation } from "./components/ViewerDrawers";
export { bindRectangularRoi, type RectangularRoiBinding } from "./presentation/rectangularRoi";

export interface PycomClinicalViewerNextProps {
  study: ClinicalStudy;
  title?: string;
  assetResolver?: ClinicalViewportAssetResolver | undefined;
  customPanels?: readonly ViewerCustomPanel[] | undefined;
  inspectorPanelActions?: ReactNode;
  railActions?: ReactNode;
  studyPanelActions?: ReactNode;
  toolbarActions?: ReactNode;
  viewportRenderer?: ClinicalViewportRenderer | undefined;
  onControlPlaneSnapshotChange?: ((snapshot: ViewerControlPlaneSnapshot) => void) | undefined;
  onViewportRendererHandleChange?: ((handle: import("./ports/viewportRenderer").ClinicalViewportRendererHandle | undefined) => void) | undefined;
}

export function PycomClinicalViewerNext({
  study,
  title = "EdgePy Viewer",
  assetResolver,
  customPanels,
  inspectorPanelActions,
  railActions,
  studyPanelActions,
  toolbarActions,
  viewportRenderer,
  onControlPlaneSnapshotChange,
  onViewportRendererHandleChange,
}: Readonly<PycomClinicalViewerNextProps>) {
  const [selectedScanId, setSelectedScanId] = useState<string | undefined>(study.scans[0]?.id);
  const [selectedSeriesUid, setSelectedSeriesUid] = useState<string | undefined>(() =>
    defaultSeriesForScan(study, study.scans[0])?.uid,
  );
  const [visibleOverlayUids, setVisibleOverlayUids] = useState<ReadonlySet<string>>(() => defaultVisibleOverlayUids(study.overlays));
  const [isFunctionalOverlayVisible, setFunctionalOverlayVisible] = useState(true);
  const [ctWindowLevelOverride, setCtWindowLevelOverride] = useState<CtWindowLevel | undefined>();
  const [functionalOpacity, setFunctionalOpacity] = useState(() => functionalOverlayOpacity(undefined));
  const [functionalColormap, setFunctionalColormap] = useState<FunctionalOverlayColormap>(() => functionalOverlayColormap(undefined));
  const [overlayOpacityByUid, setOverlayOpacityByUid] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [visibleRtstructRoiNumbersByOverlayUid, setVisibleRtstructRoiNumbersByOverlayUid] = useState<ReadonlyMap<string, ReadonlySet<number>>>(() => new Map());
  const [activePanel, setActivePanel] = useState<ViewerPanelKey | undefined>("overlays");
  const customPanelLayout = activeCustomPanelLayout(customPanels, activePanel);
  const activeScan = scanById(study, selectedScanId);
  const scanSeries = seriesForScan(study, activeScan);
  const activeSeries = selectedSeriesForScan(study, activeScan, selectedSeriesUid);
  const baseSeries = seriesByUid(study.series, activeScan?.baseSeriesUid);
  const windowLevel = viewerWindowLevel({ activeSeries, baseSeries, override: ctWindowLevelOverride });
  const functionalSeries = seriesByUid(study.series, activeScan?.functionalSeriesUid);
  const scanOverlays = overlaysForScan(study.overlays, activeScan);
  const activeOverlays = activeOverlaysWithPresentation({ overlays: scanOverlays, visibleOverlayUids, overlayOpacityByUid, visibleRtstructRoiNumbersByOverlayUid });
  const activeOverlayKey = viewportOverlayKey({ isFunctionalOverlayVisible, functionalSeries, functionalOpacity, functionalColormap, overlays: activeOverlays });
  const { viewportElementRef, viewportStatus, viewportState, overlayRenderStatusByUid, jumpToRtstructRoi, resetView, setSliceIndex } = useViewportRenderer({
    assetResolver, viewportRenderer, study, activeScan, activeSeries, baseSeries,
    ctWindowLevel: windowLevel.render,
    functionalSeries: isFunctionalOverlayVisible ? functionalSeries : undefined,
    functionalOverlayOpacity: functionalOpacity,
    functionalOverlayColormap: functionalColormap,
    activeOverlays, activeOverlayKey,
    onRendererHandleChange: onViewportRendererHandleChange,
  });
  const cine = useCinePlayback(viewportState, setSliceIndex);

  useEffect(() => {
    const nextScan = scanById(study, selectedScanId);
    setSelectedScanId(nextScan?.id);
    setSelectedSeriesUid(defaultSeriesForScan(study, nextScan)?.uid);
    setVisibleOverlayUids(defaultVisibleOverlayUids(study.overlays));
    setFunctionalOverlayVisible(true);
    setCtWindowLevelOverride(undefined);
    setFunctionalOpacity(functionalOverlayOpacity(undefined));
    setFunctionalColormap(functionalOverlayColormap(undefined));
    setOverlayOpacityByUid(new Map());
    setVisibleRtstructRoiNumbersByOverlayUid(new Map());
    cine.setPlaying(false);
  }, [study]);

  useEffect(() => {
    onControlPlaneSnapshotChange?.(buildViewerControlPlaneSnapshot({
      study,
      activeScan,
      activeSeries,
      baseSeries,
      functionalSeries: isFunctionalOverlayVisible ? functionalSeries : undefined,
      visibleOverlays: activeOverlays,
      activeSliceIndex: viewportState?.sliceIndex,
      sliceCount: viewportState?.sliceCount,
    }));
  }, [onControlPlaneSnapshotChange, study, activeScan, activeSeries, baseSeries, functionalSeries, isFunctionalOverlayVisible, activeOverlayKey, viewportState?.sliceIndex, viewportState?.sliceCount]);

  return (
    <main className="pycom-next-shell pycom-next-viewer">
      <section className="pycom-next-layout" data-panel-open={activePanel ? "true" : "false"} data-panel-presentation={customPanelLayout.presentation} data-panel-wide={customPanelLayout.wide} aria-label="Clinical image workstation">
        <ViewerActivityRail
          activePanel={activePanel}
          customPanels={customPanels}
          overlayCount={scanOverlays.length}
          railActions={railActions}
          scanCount={study.scans.length}
          onPanelToggle={(panel) => setActivePanel((current) => current === panel ? undefined : panel)}
        />
        <ViewerDrawers
          study={study}
          activePanel={activePanel}
          activeScan={activeScan}
          customPanels={customPanels}
          inspectorPanelActions={inspectorPanelActions}
          scanSeries={scanSeries}
          ctWindowLevel={windowLevel.control}
          functionalSeries={functionalSeries}
          isFunctionalOverlayVisible={isFunctionalOverlayVisible}
          functionalOverlayOpacity={functionalOpacity}
          functionalOverlayColormap={functionalColormap}
          scanOverlays={scanOverlays}
          overlayOpacityByUid={overlayOpacityByUid}
          overlayRenderStatusByUid={overlayRenderStatusByUid}
          visibleOverlayUids={visibleOverlayUids}
          visibleRtstructRoiNumbersByOverlayUid={visibleRtstructRoiNumbersByOverlayUid}
          studyPanelActions={studyPanelActions}
          onPanelClose={() => setActivePanel(undefined)}
          onScanSelect={(scan) => selectScan({ study, scanId: scan.id, setSelectedScanId, setSelectedSeriesUid, setFunctionalOverlayVisible })}
          onCtWindowLevelChange={(value) => setCtWindowLevelOverride(clampCtWindowLevel(value))}
          onFunctionalOverlayToggle={() => setFunctionalOverlayVisible((visible) => !visible)}
          onFunctionalOverlayOpacityChange={(opacity) => setFunctionalOpacity(clampOverlayOpacity(opacity))}
          onFunctionalOverlayColormapChange={(colormap) => setFunctionalColormap(functionalOverlayColormap(colormap))}
          onOverlayToggle={(overlayUid) => setVisibleOverlayUids((current) => toggleOverlayUidState(current, overlayUid))}
          onOverlayOpacityChange={(overlayUid, opacity) => setOverlayOpacityByUid((current) => setOverlayOpacityState(current, overlayUid, opacity))}
          onRtstructRoiJump={(overlay, roiNumber) => { void jumpToRtstructRoi(overlay.uid, roiNumber); }}
          onRtstructRoiFocus={(overlay, roiNumber) => setVisibleRtstructRoiNumbersByOverlayUid((current) => focusRtstructRoiState(current, overlay, roiNumber))}
          onRtstructRoiSetAll={(overlay, visible) => setVisibleRtstructRoiNumbersByOverlayUid((current) => setAllRtstructRoisState(current, overlay, visible))}
          onRtstructRoiToggle={(overlay, roiNumber) => setVisibleRtstructRoiNumbersByOverlayUid((current) => toggleRtstructRoiState(current, overlay, roiNumber))}
        />
        <section className="pycom-next-viewport" aria-label="Imaging viewport placeholder">
          <ViewerChrome
            title={title}
            studyLabel={study.label}
            activeScan={activeScan}
            activeSeries={activeSeries}
            baseSeries={baseSeries}
            functionalSeries={functionalSeries}
            toolbarActions={<><ClinicalToolbarControls ctWindowLevel={windowLevel.control} cineFps={cine.fps} isCinePlaying={cine.isPlaying} viewportState={viewportState} onCtWindowLevelChange={(value) => setCtWindowLevelOverride(clampCtWindowLevel(value))} onCineFpsChange={cine.setFps} onCineToggle={cine.toggle} onResetView={() => { void resetView(); }} onSliceSelect={(sliceIndex) => { void setSliceIndex(sliceIndex); }} onSliceStep={(delta) => { void setSliceIndex((viewportState?.sliceIndex ?? 0) + delta); }} />{toolbarActions}</>}
          />
          {viewportRenderer ? (
            <article className="pycom-next-renderer-mount pycom-cornerstone-stack">
              <div ref={viewportElementRef} className="pycom-cornerstone-stack-viewport" />
              <p className="pycom-cornerstone-stack-status">{viewportStatus}</p>
            </article>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function activeCustomPanelLayout(customPanels: readonly ViewerCustomPanel[] | undefined, activePanel: ViewerPanelKey | undefined): { presentation: "side" | "bottom" | "fullscreen"; wide: "true" | "false" } {
  const panel = customPanels?.find((candidate) => candidate.key === activePanel);
  return { presentation: panel?.presentation ?? "side", wide: panel?.wide === true ? "true" : "false" };
}

function seriesByUid(series: readonly DicomSeriesRef[], uid: string | undefined): DicomSeriesRef | undefined {
  return series.find((item) => item.uid === uid);
}

interface SelectScanOptions {
  study: ClinicalStudy;
  scanId: string;
  setSelectedScanId(scanId: string | undefined): void;
  setSelectedSeriesUid(seriesUid: string | undefined): void;
  setFunctionalOverlayVisible(visible: boolean): void;
}

interface ViewportOverlayKeyInput {
  isFunctionalOverlayVisible: boolean;
  functionalSeries: DicomSeriesRef | undefined;
  functionalOpacity: number;
  functionalColormap: FunctionalOverlayColormap;
  overlays: readonly OverlayRef[];
}

function selectScan(options: SelectScanOptions): void {
  const nextScan = scanById(options.study, options.scanId);
  options.setSelectedScanId(nextScan?.id);
  options.setSelectedSeriesUid(defaultSeriesForScan(options.study, nextScan)?.uid);
  options.setFunctionalOverlayVisible(true);
}

function defaultVisibleOverlayUids(overlays: readonly OverlayRef[]): ReadonlySet<string> {
  return new Set(renderableOverlays(overlays).map((overlay) => overlay.uid));
}

function setOverlayOpacityState(current: ReadonlyMap<string, number>, overlayUid: string, opacity: number): ReadonlyMap<string, number> {
  const next = new Map(current);
  next.set(overlayUid, clampOverlayOpacity(opacity));
  return next;
}

function toggleOverlayUidState(current: ReadonlySet<string>, overlayUid: string): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(overlayUid)) {
    next.delete(overlayUid);
  } else {
    next.add(overlayUid);
  }
  return next;
}

function viewportOverlayKey({ functionalColormap, functionalOpacity, functionalSeries, isFunctionalOverlayVisible, overlays }: ViewportOverlayKeyInput): string {
  return [
    isFunctionalOverlayVisible && functionalSeries ? `functional:${functionalSeries.uid}:${functionalOpacity}:${functionalColormap}` : "functional:none",
    ...overlays.map((overlay) => `${overlay.uid}:${overlayOpacity(overlay)}:${rtstructRoiSelectionKey(overlay)}`),
  ].join("|");
}

function rtstructRoiSelectionKey(overlay: OverlayRef): string {
  const visibleRoiNumbers = overlay.metadata?.rtstructVisibleRoiNumbers;
  return Array.isArray(visibleRoiNumbers) ? visibleRoiNumbers.join(",") : "all";
}
