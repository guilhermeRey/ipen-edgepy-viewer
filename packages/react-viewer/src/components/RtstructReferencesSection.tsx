import type { OverlayRef } from "@pycom-next/core";
import { overlayColor, overlayVisibilityLabel, rtstructRoiColor } from "../presentation/overlayPresentation";
import { rtstructStructures, type RtstructStructureOption } from "../presentation/rtstructStructures";
import type { ClinicalViewportOverlayRenderStatus } from "../ports/viewportRenderer";

interface RtstructReferencesSectionProps {
  rtstructOverlays: readonly OverlayRef[];
  overlayRenderStatusByUid: ReadonlyMap<string, ClinicalViewportOverlayRenderStatus>;
  visibleOverlayUids: ReadonlySet<string>;
  visibleRtstructRoiNumbersByOverlayUid: ReadonlyMap<string, ReadonlySet<number>>;
  onOverlayToggle(overlayUid: string): void;
  onRtstructRoiJump(overlay: OverlayRef, roiNumber: number): void;
  onRtstructRoiFocus(overlay: OverlayRef, roiNumber: number): void;
  onRtstructRoiSetAll(overlay: OverlayRef, visible: boolean): void;
  onRtstructRoiToggle(overlay: OverlayRef, roiNumber: number): void;
}

export function RtstructReferencesSection({
  rtstructOverlays,
  overlayRenderStatusByUid,
  visibleOverlayUids,
  visibleRtstructRoiNumbersByOverlayUid,
  onOverlayToggle,
  onRtstructRoiJump,
  onRtstructRoiFocus,
  onRtstructRoiSetAll,
  onRtstructRoiToggle,
}: Readonly<RtstructReferencesSectionProps>) {
  return (
    <section>
      <header className="pycom-next-section-heading">
        <h3>RTSTRUCT references</h3>
        <span>{rtstructOverlays.length} detected</span>
      </header>
      <ul className="pycom-next-list pycom-next-rtstruct-list" aria-label="RTSTRUCT references in selected scan">
        {rtstructOverlays.map((overlay, index) => (
          <RtstructReferenceItem
            key={overlay.uid}
            index={index}
            overlay={overlay}
            renderStatus={overlayRenderStatusByUid.get(overlay.uid)}
            visible={visibleOverlayUids.has(overlay.uid)}
            visibleRoiNumbers={visibleRtstructRoiNumbersByOverlayUid.get(overlay.uid)}
            onOverlayToggle={onOverlayToggle}
            onRtstructRoiJump={onRtstructRoiJump}
            onRtstructRoiFocus={onRtstructRoiFocus}
            onRtstructRoiSetAll={onRtstructRoiSetAll}
            onRtstructRoiToggle={onRtstructRoiToggle}
          />
        ))}
      </ul>
      {rtstructOverlays.length === 0 ? <p className="pycom-next-muted">No RTSTRUCT references detected for this scan.</p> : null}
    </section>
  );
}

function RtstructReferenceItem({
  index,
  overlay,
  renderStatus,
  visible,
  visibleRoiNumbers,
  onOverlayToggle,
  onRtstructRoiJump,
  onRtstructRoiFocus,
  onRtstructRoiSetAll,
  onRtstructRoiToggle,
}: Readonly<{
  index: number;
  overlay: OverlayRef;
  renderStatus: ClinicalViewportOverlayRenderStatus | undefined;
  visible: boolean;
  visibleRoiNumbers: ReadonlySet<number> | undefined;
  onOverlayToggle(overlayUid: string): void;
  onRtstructRoiJump(overlay: OverlayRef, roiNumber: number): void;
  onRtstructRoiFocus(overlay: OverlayRef, roiNumber: number): void;
  onRtstructRoiSetAll(overlay: OverlayRef, visible: boolean): void;
  onRtstructRoiToggle(overlay: OverlayRef, roiNumber: number): void;
}>) {
  const structures = rtstructStructures(overlay);
  return (
    <li data-visible={visible ? "true" : "false"}>
      <button
        type="button"
        className="pycom-next-overlay-button"
        aria-pressed={visible}
        aria-label={`${visible ? "Hide" : "Show"} ${overlay.label} RTSTRUCT`}
        onClick={() => onOverlayToggle(overlay.uid)}
      >
        <span className="pycom-next-overlay-swatch" style={{ backgroundColor: overlayColor(overlay, index) }} />
        <span className="pycom-next-overlay-text">
          <strong>{overlay.structure ?? overlay.label}</strong>
          <small>{rtstructDetail(overlay)}</small>
        </span>
        <span className="pycom-next-overlay-state">
          <strong>{visible ? "Hide" : "Show"}</strong>
          <small className="pycom-next-status-line">
            {rtstructLoadingIcon(visible, renderStatus)}
            <span title={rtstructStateTitle(visible, renderStatus)}>{rtstructStateLabel(visible, renderStatus)}</span>
          </small>
        </span>
      </button>
      {visible && structures.length > 0 ? (
        <div className="pycom-next-rtstruct-roi-panel">
          <div className="pycom-next-rtstruct-roi-actions" aria-label={`${overlay.label} ROI visibility actions`}>
            <button type="button" onClick={() => onRtstructRoiSetAll(overlay, true)}>All</button>
            <button type="button" onClick={() => onRtstructRoiSetAll(overlay, false)}>None</button>
          </div>
          <ul className="pycom-next-rtstruct-roi-list" aria-label={`${overlay.label} structures`}>
            {structures.map((structure, structureIndex) => (
              <li key={structure.roiNumber}>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleRoiNumbers?.has(structure.roiNumber) ?? true}
                    onChange={() => onRtstructRoiToggle(overlay, structure.roiNumber)}
                  />
                  <span className="pycom-next-rtstruct-roi-swatch" style={{ backgroundColor: rtstructRoiColor({ overlay, roiNumber: structure.roiNumber, name: structure.name, index: structureIndex }) }} />
                  <span>{structure.name ?? `ROI ${structure.roiNumber}`}</span>
                  <small>{structure.contourCount} contours</small>
                </label>
                <button type="button" aria-label={`Jump to ${rtstructRoiLabel(structure)}`} onClick={() => onRtstructRoiJump(overlay, structure.roiNumber)}>Jump</button>
                <button type="button" onClick={() => onRtstructRoiFocus(overlay, structure.roiNumber)}>Only</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function rtstructRoiLabel(structure: RtstructStructureOption): string {
  return structure.name ?? `ROI ${structure.roiNumber}`;
}

function rtstructLoadingIcon(isVisible: boolean, status: ClinicalViewportOverlayRenderStatus | undefined) {
  return isVisible && status?.state === "loading"
    ? <span className="pycom-next-loading-spinner" aria-hidden="true" />
    : null;
}

function rtstructStateLabel(isVisible: boolean, status: ClinicalViewportOverlayRenderStatus | undefined): string {
  if (!isVisible) {
    return overlayVisibilityLabel(false);
  }
  if (!status) {
    return "Queued";
  }
  if (status.state === "loading") {
    return status.message ? `Loading contours / ${status.message}` : "Loading contours";
  }
  if (status.state === "visible") {
    const mode = status.matchMode === "geometry" ? "geometry" : "SOP";
    return [`${status.contourCount ?? 0} contours`, mode, durationLabel(status.loadMs)].filter(Boolean).join(" / ");
  }
  if (status.state === "empty") {
    return "No contours on slice";
  }
  return status.message ?? "Failed";
}

function rtstructStateTitle(isVisible: boolean, status: ClinicalViewportOverlayRenderStatus | undefined): string | undefined {
  if (!isVisible || !status?.loadMs) {
    return undefined;
  }
  return [`RTSTRUCT load: ${durationLabel(status.loadMs)}`, status.pointCount ? `${status.pointCount.toLocaleString()} points` : undefined]
    .filter(Boolean)
    .join(" / ");
}

function durationLabel(value: number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

function rtstructDetail(overlay: OverlayRef): string {
  const metadata = rtstructMetadata(overlay);
  return [
    overlay.group,
    "RTSTRUCT",
    metadata ? `${metadata.structureCount} ROI` : undefined,
    metadata ? `${metadata.contourCount} contours` : undefined,
    "load on show",
  ].filter(Boolean).join(" / ");
}

function rtstructMetadata(overlay: OverlayRef): { structureCount: number; contourCount: number } | undefined {
  const rtstruct = rtstructMetadataRecord(overlay);
  if (!rtstruct) {
    return undefined;
  }
  const structureCount = rtstruct.structureCount;
  const contourCount = rtstruct.contourCount;
  return typeof structureCount === "number" && typeof contourCount === "number" ? { structureCount, contourCount } : undefined;
}

function rtstructMetadataRecord(overlay: OverlayRef): Record<string, unknown> | undefined {
  const dicom = overlay.metadata?.dicom;
  return isRecord(dicom) && isRecord(dicom.rtstruct) ? dicom.rtstruct : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
