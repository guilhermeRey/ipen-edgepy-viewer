import type { ClinicalScan, ClinicalStudy, DicomSeriesRef, OverlayRef } from "@pycom-next/core";
import { createClinicalStudyInputFromDicomInventory, type DicomInventoryResult } from "@pycom-next/dicom";

export interface DemoStudyBuilderState {
  acquisitions: DemoAcquisitionPart[];
  maps: DemoMapPart[];
}

export interface DemoAcquisitionPart {
  id: string;
  scanId: string;
  label: string;
  series: DicomSeriesRef[];
}

export interface DemoMapPart {
  id: string;
  label: string;
  targetScanIds: string[];
  overlays: OverlayRef[];
}

export function createEmptyDemoStudyBuilder(): DemoStudyBuilderState {
  return { acquisitions: [], maps: [] };
}

export function createDemoStudyBuilderFromStudy(study: ClinicalStudy): DemoStudyBuilderState {
  return {
    acquisitions: study.scans.map((scan, index) => ({
      id: `import-acq-${index + 1}`,
      scanId: scan.id,
      label: scan.label,
      series: seriesForScan(study.series, scan),
    })),
    maps: study.overlays.map((overlay, index) => ({
      id: `import-map-${index + 1}`,
      label: overlay.label,
      targetScanIds: study.scans.filter((scan) => scan.overlayUids.includes(overlay.uid)).map((scan) => scan.id),
      overlays: [overlay],
    })),
  };
}

export function addAcquisitionToBuilder(state: DemoStudyBuilderState, inventory: DicomInventoryResult): DemoStudyBuilderState {
  const scanId = `Scan${state.acquisitions.length + 1}`;
  const partId = `acq-${state.acquisitions.length + 1}`;
  const input = createClinicalStudyInputFromDicomInventory(inventory, { uid: partId, label: scanId });
  const series = (input.series ?? []).map((item) => acquisitionSeries(item, partId, scanId));
  return {
    ...state,
    acquisitions: [...state.acquisitions, { id: partId, scanId, label: scanId, series }],
  };
}

export function addMapToBuilder(state: DemoStudyBuilderState, inventory: DicomInventoryResult, targetScanIds: readonly string[]): DemoStudyBuilderState {
  const partId = `map-${state.maps.length + 1}`;
  const input = createClinicalStudyInputFromDicomInventory(inventory, { uid: partId, label: partId });
  const overlays = (input.overlays ?? []).map((item) => mapOverlay(item, partId));
  const scanIds = targetScanIds.length > 0 ? [...targetScanIds] : scanIdsFromBuilder(state);
  return {
    ...state,
    maps: [...state.maps, { id: partId, label: mapLabel(overlays, partId), targetScanIds: scanIds, overlays }],
  };
}

export function buildDemoClinicalStudy(state: DemoStudyBuilderState): ClinicalStudy {
  const series = state.acquisitions.flatMap((item) => item.series);
  const overlays = state.maps.flatMap((item) => item.overlays);
  return {
    uid: "incremental-demo-study",
    label: "Incremental local study",
    series,
    overlays,
    scans: state.acquisitions.map((item) => scanFromAcquisition(item, state.maps)),
  };
}

export function scanIdsFromBuilder(state: DemoStudyBuilderState): string[] {
  return state.acquisitions.map((item) => item.scanId);
}

function acquisitionSeries(series: DicomSeriesRef, partId: string, scanId: string): DicomSeriesRef {
  return {
    ...series,
    uid: `${partId}:${series.uid}`,
    scanId,
    label: [scanId, series.modality ?? series.role].filter(Boolean).join(" "),
  };
}

function mapOverlay(overlay: OverlayRef, partId: string): OverlayRef {
  return {
    uid: `${partId}:${overlay.uid}`,
    label: overlay.kind === "dose" ? overlay.label : [overlay.group, overlay.structure, overlay.kind].filter(Boolean).join(" ") || overlay.label,
    kind: overlay.kind,
    ...(overlay.group ? { group: overlay.group } : {}),
    ...(overlay.structure ? { structure: overlay.structure } : {}),
    ...(overlay.metadata ? { metadata: overlay.metadata } : {}),
  };
}

function scanFromAcquisition(acquisition: DemoAcquisitionPart, maps: readonly DemoMapPart[]): ClinicalScan {
  const baseSeriesUid = firstSeriesByRole(acquisition.series, "base")?.uid;
  const functionalSeriesUid = firstSeriesByRole(acquisition.series, "functional")?.uid;
  return {
    id: acquisition.scanId,
    label: acquisition.label,
    ...(baseSeriesUid ? { baseSeriesUid } : {}),
    ...(functionalSeriesUid ? { functionalSeriesUid } : {}),
    overlayUids: maps
      .filter((item) => item.targetScanIds.includes(acquisition.scanId))
      .flatMap((item) => item.overlays.map((overlay) => overlay.uid)),
  };
}

function firstSeriesByRole(series: readonly DicomSeriesRef[], role: DicomSeriesRef["role"]): DicomSeriesRef | undefined {
  return series.find((item) => item.role === role);
}

function seriesForScan(series: readonly DicomSeriesRef[], scan: ClinicalScan): DicomSeriesRef[] {
  return series.filter((item) => item.scanId === scan.id || item.uid === scan.baseSeriesUid || item.uid === scan.functionalSeriesUid);
}

function mapLabel(overlays: readonly OverlayRef[], fallback: string): string {
  return overlays.map((overlay) => overlay.label).filter(Boolean).join(", ") || fallback;
}
