import type { ClinicalScan, ClinicalStudy, DicomSeriesRef, OverlayRef } from "@pycom-next/core";
export { overlayGroupLabel } from "./overlayPresentation";

const ROLE_ORDER: Record<DicomSeriesRef["role"], number> = {
  base: 0,
  functional: 1,
  dose: 2,
  unknown: 3,
};

export function scanById(study: ClinicalStudy, scanId: string | undefined): ClinicalScan | undefined {
  return study.scans.find((scan) => scan.id === scanId) ?? study.scans[0];
}

export function seriesForScan(study: ClinicalStudy, scan: ClinicalScan | undefined): DicomSeriesRef[] {
  if (!scan) {
    return [];
  }
  return uniqueSeries([
    ...study.series.filter((series) => normalize(series.scanId) === normalize(scan.id)),
    ...study.series.filter((series) => series.uid === scan.baseSeriesUid || series.uid === scan.functionalSeriesUid),
  ]).sort(compareSeries);
}

export function selectedSeriesForScan(
  study: ClinicalStudy,
  scan: ClinicalScan | undefined,
  selectedSeriesUid: string | undefined,
): DicomSeriesRef | undefined {
  const series = seriesForScan(study, scan);
  return series.find((item) => item.uid === selectedSeriesUid) ?? defaultSeriesForScan(study, scan);
}

export function defaultSeriesForScan(study: ClinicalStudy, scan: ClinicalScan | undefined): DicomSeriesRef | undefined {
  if (!scan) {
    return undefined;
  }
  return seriesByUid(study.series, scan.baseSeriesUid) ?? seriesByUid(study.series, scan.functionalSeriesUid) ?? seriesForScan(study, scan)[0];
}

export function overlaysForScan(overlays: readonly OverlayRef[], scan: ClinicalScan | undefined): OverlayRef[] {
  if (!scan) {
    return [];
  }
  return overlays.filter((overlay) => scan.overlayUids.includes(overlay.uid));
}

function seriesByUid(series: readonly DicomSeriesRef[], uid: string | undefined): DicomSeriesRef | undefined {
  return series.find((item) => item.uid === uid);
}

function uniqueSeries(series: readonly DicomSeriesRef[]): DicomSeriesRef[] {
  const seen = new Set<string>();
  return series.filter((item) => {
    if (seen.has(item.uid)) {
      return false;
    }
    seen.add(item.uid);
    return true;
  });
}

function compareSeries(left: DicomSeriesRef, right: DicomSeriesRef): number {
  return ROLE_ORDER[left.role] - ROLE_ORDER[right.role] || left.label.localeCompare(right.label);
}

function normalize(value: string | undefined): string {
  return value?.toLowerCase() ?? "";
}
