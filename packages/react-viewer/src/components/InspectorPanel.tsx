import type { ReactNode } from "react";
import type { DicomSeriesRef, OverlayRef } from "@pycom-next/core";
import { CtWindowLevelControl } from "./CtWindowLevelControl";
import type { CtWindowLevel } from "../presentation/ctWindowLevel";
import { FunctionalColormapControl } from "./FunctionalColormapControl";
import { LayerOpacityControl } from "./LayerOpacityControl";
import { OverlayTreeSection } from "./OverlayTreeSection";
import {
  functionalOverlayColormapLabel,
  overlayVisibilityLabel,
  renderableOverlays,
  rtstructReferenceOverlays,
  type FunctionalOverlayColormap,
} from "../presentation/overlayPresentation";
import type { ClinicalViewportOverlayRenderStatus } from "../ports/viewportRenderer";
import { RtstructReferencesSection } from "./RtstructReferencesSection";

interface InspectorPanelProps {
  actions?: ReactNode;
  scanSeries: readonly DicomSeriesRef[];
  ctWindowLevel: CtWindowLevel;
  functionalSeries?: DicomSeriesRef | undefined;
  isFunctionalOverlayVisible: boolean;
  functionalOverlayOpacity: number;
  functionalOverlayColormap: FunctionalOverlayColormap;
  scanOverlays: readonly OverlayRef[];
  overlayOpacityByUid: ReadonlyMap<string, number>;
  overlayRenderStatusByUid: ReadonlyMap<string, ClinicalViewportOverlayRenderStatus>;
  visibleRtstructRoiNumbersByOverlayUid: ReadonlyMap<string, ReadonlySet<number>>;
  visibleOverlayUids: ReadonlySet<string>;
  onCtWindowLevelChange(value: CtWindowLevel): void;
  onFunctionalOverlayToggle(): void;
  onFunctionalOverlayOpacityChange(opacity: number): void;
  onFunctionalOverlayColormapChange(colormap: FunctionalOverlayColormap): void;
  onOverlayToggle(overlayUid: string): void;
  onOverlayOpacityChange(overlayUid: string, opacity: number): void;
  onRtstructRoiJump(overlay: OverlayRef, roiNumber: number): void;
  onRtstructRoiFocus(overlay: OverlayRef, roiNumber: number): void;
  onRtstructRoiSetAll(overlay: OverlayRef, visible: boolean): void;
  onRtstructRoiToggle(overlay: OverlayRef, roiNumber: number): void;
}

export function InspectorPanel(props: Readonly<InspectorPanelProps>) {
  const drawableOverlays = renderableOverlays(props.scanOverlays);
  const rtstructOverlays = rtstructReferenceOverlays(props.scanOverlays);

  return (
    <aside className="pycom-next-panel pycom-next-inspector-panel">
      <h2>Inspector</h2>
      {props.actions ? <div className="pycom-next-panel-actions">{props.actions}</div> : null}
      <SeriesSection scanSeries={props.scanSeries} />
      <CtWindowLevelControl value={props.ctWindowLevel} onChange={props.onCtWindowLevelChange} />
      <FunctionalFusionSection {...props} />
      <OverlayTreeSection
        drawableOverlays={drawableOverlays}
        overlayOpacityByUid={props.overlayOpacityByUid}
        visibleOverlayUids={props.visibleOverlayUids}
        onOverlayToggle={props.onOverlayToggle}
        onOverlayOpacityChange={props.onOverlayOpacityChange}
      />
      <RtstructReferencesSection
        rtstructOverlays={rtstructOverlays}
        overlayRenderStatusByUid={props.overlayRenderStatusByUid}
        visibleRtstructRoiNumbersByOverlayUid={props.visibleRtstructRoiNumbersByOverlayUid}
        visibleOverlayUids={props.visibleOverlayUids}
        onOverlayToggle={props.onOverlayToggle}
        onRtstructRoiJump={props.onRtstructRoiJump}
        onRtstructRoiFocus={props.onRtstructRoiFocus}
        onRtstructRoiSetAll={props.onRtstructRoiSetAll}
        onRtstructRoiToggle={props.onRtstructRoiToggle}
      />
    </aside>
  );
}

function SeriesSection({ scanSeries }: Readonly<Pick<InspectorPanelProps, "scanSeries">>) {
  return (
    <section className="pycom-next-panel-section">
      <div className="pycom-next-section-heading">
        <h3>Image inputs</h3>
        <span>{scanSeries.length} series</span>
      </div>
      <ul className="pycom-next-list pycom-next-series-summary-list" aria-label="DICOM image inputs in selected scan">
        {scanSeries.map((series) => (
          <li key={series.uid}>
            <article className="pycom-next-series-summary-card">
              <span>{seriesRoleLabel(series)}</span>
              <strong>{series.label}</strong>
              <small>{seriesDetail(series)}</small>
            </article>
          </li>
        ))}
      </ul>
      {scanSeries.length === 0 ? <p className="pycom-next-muted">No image series detected for this scan.</p> : null}
    </section>
  );
}

function seriesRoleLabel(series: DicomSeriesRef): string {
  if (series.role === "base") {
    return "Base image";
  }
  if (series.role === "functional") {
    return "Functional image";
  }
  if (series.role === "dose") {
    return "Dose image";
  }
  return "Image series";
}

function FunctionalFusionSection({
  functionalSeries,
  isFunctionalOverlayVisible,
  functionalOverlayOpacity,
  functionalOverlayColormap,
  onFunctionalOverlayToggle,
  onFunctionalOverlayOpacityChange,
  onFunctionalOverlayColormapChange,
}: Readonly<Pick<
  InspectorPanelProps,
  | "functionalSeries"
  | "isFunctionalOverlayVisible"
  | "functionalOverlayOpacity"
  | "functionalOverlayColormap"
  | "onFunctionalOverlayToggle"
  | "onFunctionalOverlayOpacityChange"
  | "onFunctionalOverlayColormapChange"
>>) {
  return (
    <section>
      <h3>Functional fusion</h3>
      {functionalSeries ? (
        <article className="pycom-next-fusion-layer" data-visible={isFunctionalOverlayVisible ? "true" : "false"}>
          <button
            type="button"
            className="pycom-next-overlay-button"
            aria-pressed={isFunctionalOverlayVisible}
            aria-label={`${isFunctionalOverlayVisible ? "Hide" : "Show"} ${functionalSeries.label} fusion`}
            onClick={onFunctionalOverlayToggle}
          >
            <span className="pycom-next-overlay-swatch pycom-next-functional-swatch" />
            <span className="pycom-next-overlay-text">
              <strong>{functionalSeries.label}</strong>
              <small>{functionalDetail(functionalSeries, functionalOverlayColormap)}</small>
            </span>
            <span className="pycom-next-overlay-state">
              <strong>{isFunctionalOverlayVisible ? "Hide" : "Show"}</strong>
              <small>{overlayVisibilityLabel(isFunctionalOverlayVisible)}</small>
            </span>
          </button>
          {isFunctionalOverlayVisible ? (
            <>
              <LayerOpacityControl label="Opacity" value={functionalOverlayOpacity} onChange={onFunctionalOverlayOpacityChange} />
              <FunctionalColormapControl value={functionalOverlayColormap} onChange={onFunctionalOverlayColormapChange} />
            </>
          ) : null}
        </article>
      ) : (
        <p className="pycom-next-muted">No functional series detected for this scan.</p>
      )}
    </section>
  );
}

function seriesDetail(series: DicomSeriesRef): string {
  return [series.role, series.modality, `${series.instanceCount} instances`].filter(Boolean).join(" / ");
}

function functionalDetail(series: DicomSeriesRef, colormap: FunctionalOverlayColormap): string {
  return [series.modality, `${series.instanceCount} instances`, `${functionalOverlayColormapLabel(colormap)} colormap`].filter(Boolean).join(" / ");
}
