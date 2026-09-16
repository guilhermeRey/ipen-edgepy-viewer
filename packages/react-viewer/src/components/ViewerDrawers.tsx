import type { ReactNode } from "react";
import type { ClinicalScan, ClinicalStudy, DicomSeriesRef, OverlayRef } from "@pycom-next/core";
import { InspectorPanel } from "./InspectorPanel";
import { StudyPanel } from "./ViewerPanels";
import type { ViewerActivityRailPanel, ViewerPanelKey } from "./ViewerActivityRail";
import type { CtWindowLevel } from "../presentation/ctWindowLevel";
import type { FunctionalOverlayColormap } from "../presentation/overlayPresentation";
import type { ClinicalViewportOverlayRenderStatus } from "../ports/viewportRenderer";

interface ViewerDrawersProps {
  activeScan?: ClinicalScan | undefined;
  activePanel?: ViewerPanelKey | undefined;
  ctWindowLevel: CtWindowLevel;
  customPanels?: readonly ViewerCustomPanel[] | undefined;
  inspectorPanelActions?: ReactNode;
  functionalSeries?: DicomSeriesRef | undefined;
  functionalOverlayColormap: FunctionalOverlayColormap;
  functionalOverlayOpacity: number;
  isFunctionalOverlayVisible: boolean;
  overlayOpacityByUid: ReadonlyMap<string, number>;
  overlayRenderStatusByUid: ReadonlyMap<string, ClinicalViewportOverlayRenderStatus>;
  scanOverlays: readonly OverlayRef[];
  scanSeries: readonly DicomSeriesRef[];
  study: ClinicalStudy;
  studyPanelActions?: ReactNode;
  visibleOverlayUids: ReadonlySet<string>;
  visibleRtstructRoiNumbersByOverlayUid: ReadonlyMap<string, ReadonlySet<number>>;
  onCtWindowLevelChange(value: CtWindowLevel): void;
  onPanelClose(): void;
  onFunctionalOverlayColormapChange(colormap: FunctionalOverlayColormap): void;
  onFunctionalOverlayOpacityChange(opacity: number): void;
  onFunctionalOverlayToggle(): void;
  onOverlayOpacityChange(overlayUid: string, opacity: number): void;
  onOverlayToggle(overlayUid: string): void;
  onRtstructRoiJump(overlay: OverlayRef, roiNumber: number): void;
  onRtstructRoiFocus(overlay: OverlayRef, roiNumber: number): void;
  onRtstructRoiSetAll(overlay: OverlayRef, visible: boolean): void;
  onRtstructRoiToggle(overlay: OverlayRef, roiNumber: number): void;
  onScanSelect(scan: ClinicalScan): void;
}

export interface ViewerCustomPanel extends ViewerActivityRailPanel {
  content: ReactNode;
  presentation?: ViewerCustomPanelPresentation | undefined;
  wide?: boolean | undefined;
}

export type ViewerCustomPanelPresentation = "side" | "bottom" | "fullscreen";

export function ViewerDrawers(props: Readonly<ViewerDrawersProps>) {
  if (!props.activePanel) {
    return null;
  }
  const customPanel = props.customPanels?.find((panel) => panel.key === props.activePanel);

  return (
    <aside className="pycom-next-side-panel" aria-label="Clinical side panel">
      <button type="button" className="pycom-next-side-panel-close" onClick={props.onPanelClose}>Close</button>
      {props.activePanel === "scans" ? (
        <div className="pycom-next-study-drawer">
          <StudyPanel study={props.study} activeScan={props.activeScan} actions={props.studyPanelActions} onScanSelect={props.onScanSelect} />
        </div>
      ) : null}
      {props.activePanel === "overlays" ? (
        <div className="pycom-next-inspector-drawer">
          <InspectorPanel
            actions={props.inspectorPanelActions}
            scanSeries={props.scanSeries}
            ctWindowLevel={props.ctWindowLevel}
            functionalSeries={props.functionalSeries}
            isFunctionalOverlayVisible={props.isFunctionalOverlayVisible}
            functionalOverlayOpacity={props.functionalOverlayOpacity}
            functionalOverlayColormap={props.functionalOverlayColormap}
            scanOverlays={props.scanOverlays}
            overlayOpacityByUid={props.overlayOpacityByUid}
            overlayRenderStatusByUid={props.overlayRenderStatusByUid}
            visibleRtstructRoiNumbersByOverlayUid={props.visibleRtstructRoiNumbersByOverlayUid}
            visibleOverlayUids={props.visibleOverlayUids}
            onCtWindowLevelChange={props.onCtWindowLevelChange}
            onFunctionalOverlayToggle={props.onFunctionalOverlayToggle}
            onFunctionalOverlayOpacityChange={props.onFunctionalOverlayOpacityChange}
            onFunctionalOverlayColormapChange={props.onFunctionalOverlayColormapChange}
            onOverlayToggle={props.onOverlayToggle}
            onOverlayOpacityChange={props.onOverlayOpacityChange}
            onRtstructRoiJump={props.onRtstructRoiJump}
            onRtstructRoiFocus={props.onRtstructRoiFocus}
            onRtstructRoiSetAll={props.onRtstructRoiSetAll}
            onRtstructRoiToggle={props.onRtstructRoiToggle}
          />
        </div>
      ) : null}
      {customPanel ? <div className="pycom-next-custom-drawer">{customPanel.content}</div> : null}
    </aside>
  );
}
