export type ClinicalSeriesRole = "base" | "functional" | "dose" | "unknown";

export type OverlayKind = "mask" | "rtstruct" | "dose" | "derived";

export interface DicomSeriesRef {
  uid: string;
  label: string;
  role: ClinicalSeriesRole;
  modality?: string | undefined;
  scanId?: string | undefined;
  instanceCount: number;
  metadata?: Record<string, unknown> | undefined;
}

export interface OverlayRef {
  uid: string;
  label: string;
  scanId?: string | undefined;
  targetSeriesUid?: string | undefined;
  kind: OverlayKind;
  group?: string | undefined;
  structure?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface ClinicalScan {
  id: string;
  label: string;
  baseSeriesUid?: string | undefined;
  functionalSeriesUid?: string | undefined;
  overlayUids: string[];
}

export interface ClinicalStudy {
  uid: string;
  label: string;
  series: DicomSeriesRef[];
  overlays: OverlayRef[];
  scans: ClinicalScan[];
}

export interface ClinicalStudyInput {
  uid: string;
  label: string;
  series?: readonly DicomSeriesRef[];
  overlays?: readonly OverlayRef[];
}

export interface ViewerControlPlaneSnapshotInput {
  study: ClinicalStudy;
  activeScan?: ClinicalScan | undefined;
  activeSeries?: DicomSeriesRef | undefined;
  baseSeries?: DicomSeriesRef | undefined;
  functionalSeries?: DicomSeriesRef | undefined;
  visibleOverlays?: readonly OverlayRef[] | undefined;
  activeSliceIndex?: number | undefined;
  sliceCount?: number | undefined;
}

export interface ViewerControlPlaneSnapshot {
  controlPlaneVersion: 1;
  study: ClinicalStudy;
  activeScanId?: string | undefined;
  activeSeriesUid?: string | undefined;
  baseSeriesUid?: string | undefined;
  functionalSeriesUid?: string | undefined;
  activeSliceIndex?: number | undefined;
  sliceCount?: number | undefined;
  visibleLayers: ViewerControlPlaneLayer[];
  fusionContext: ViewerFusionContext;
}

export interface ViewerControlPlaneLayer {
  uid: string;
  label: string;
  kind: "functional" | OverlayKind;
  role: "functional" | "overlay";
}

export interface ViewerFusionContext {
  status: "empty" | "base-only" | "planned-overlays";
  baseSeriesUid?: string | undefined;
  functionalSeriesUid?: string | undefined;
  overlayUids: string[];
}

export function createEmptyStudy(uid: string, label: string): ClinicalStudy {
  return { uid, label, series: [], overlays: [], scans: [] };
}

export function buildViewerControlPlaneSnapshot(input: ViewerControlPlaneSnapshotInput): ViewerControlPlaneSnapshot {
  const visibleOverlays = input.visibleOverlays ?? [];
  const visibleLayers = visibleControlPlaneLayers(input.functionalSeries, visibleOverlays);
  return {
    controlPlaneVersion: 1,
    study: input.study,
    activeScanId: input.activeScan?.id,
    activeSeriesUid: input.activeSeries?.uid,
    baseSeriesUid: input.baseSeries?.uid,
    functionalSeriesUid: input.functionalSeries?.uid,
    activeSliceIndex: integerOrUndefined(input.activeSliceIndex),
    sliceCount: integerOrUndefined(input.sliceCount),
    visibleLayers,
    fusionContext: {
      status: fusionStatus(input.baseSeries, visibleLayers),
      baseSeriesUid: input.baseSeries?.uid,
      functionalSeriesUid: input.functionalSeries?.uid,
      overlayUids: visibleOverlays.map((overlay) => overlay.uid),
    },
  };
}

export function addScan(study: ClinicalStudy, scan: ClinicalScan): ClinicalStudy {
  return {
    ...study,
    scans: [...study.scans.filter((item) => item.id !== scan.id), scan],
  };
}

export function addSeries(study: ClinicalStudy, series: DicomSeriesRef): ClinicalStudy {
  return assembleClinicalStudy({
    uid: study.uid,
    label: study.label,
    series: upsertByUid(study.series, series),
    overlays: study.overlays,
  });
}

export function addOverlay(study: ClinicalStudy, overlay: OverlayRef): ClinicalStudy {
  return assembleClinicalStudy({
    uid: study.uid,
    label: study.label,
    series: study.series,
    overlays: upsertByUid(study.overlays, overlay),
  });
}

export function assembleClinicalStudy(input: ClinicalStudyInput): ClinicalStudy {
  const series = [...(input.series ?? [])];
  const overlays = [...(input.overlays ?? [])];
  const scans = new Map<string, ClinicalScan>();

  for (const item of series) {
    addSeriesToScans(scans, item);
  }

  for (const overlay of overlays) {
    addOverlayToScans(scans, series, overlay);
  }

  return {
    uid: input.uid,
    label: input.label,
    series,
    overlays,
    scans: Array.from(scans.values()).sort(compareScans),
  };
}

function addSeriesToScans(scans: Map<string, ClinicalScan>, item: DicomSeriesRef): void {
  const scan = ensureScan(scans, item.scanId ?? scanIdFromText(item.label) ?? "Study");
  if (item.role === "base" && !scan.baseSeriesUid) {
    scan.baseSeriesUid = item.uid;
  }
  if (item.role === "functional" && !scan.functionalSeriesUid) {
    scan.functionalSeriesUid = item.uid;
  }
}

function addOverlayToScans(scans: Map<string, ClinicalScan>, series: readonly DicomSeriesRef[], overlay: OverlayRef): void {
  const scanId = overlay.scanId ?? scanIdForTargetSeries(series, overlay.targetSeriesUid) ?? scanIdFromText(overlay.label);
  if (!scanId) {
    addOverlayToExistingScans(scans, overlay.uid);
    return;
  }
  const scan = ensureScan(scans, scanId);
  scan.overlayUids = uniqueStrings([...scan.overlayUids, overlay.uid]);
}

function addOverlayToExistingScans(scans: Map<string, ClinicalScan>, overlayUid: string): void {
  for (const scan of scans.values()) {
    scan.overlayUids = uniqueStrings([...scan.overlayUids, overlayUid]);
  }
}

export function normalizeScanId(value: string): string {
  const match = /^scan\s*(\d+)$/i.exec(value.trim());
  return match ? `Scan${Number(match[1])}` : value.trim();
}

function ensureScan(scans: Map<string, ClinicalScan>, value: string): ClinicalScan {
  const id = normalizeScanId(value) || "Study";
  const key = id.toLowerCase();
  const existing = scans.get(key);
  if (existing) {
    return existing;
  }
  const scan: ClinicalScan = { id, label: id, overlayUids: [] };
  scans.set(key, scan);
  return scan;
}

function scanIdForTargetSeries(series: readonly DicomSeriesRef[], targetSeriesUid: string | undefined): string | undefined {
  if (!targetSeriesUid) {
    return undefined;
  }
  return series.find((item) => item.uid === targetSeriesUid)?.scanId;
}

function scanIdFromText(value: string): string | undefined {
  for (const segment of value.split(/[\\/:\s]+/).filter(Boolean)) {
    const scanId = normalizeScanId(segment);
    if (/^Scan\d+$/i.test(scanId)) {
      return scanId;
    }
  }
  return undefined;
}

function compareScans(left: ClinicalScan, right: ClinicalScan): number {
  return scanSortValue(left.id) - scanSortValue(right.id) || left.label.localeCompare(right.label);
}

function scanSortValue(value: string): number {
  const match = /\d+/.exec(value);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function upsertByUid<T extends { uid: string }>(items: readonly T[], item: T): T[] {
  return [...items.filter((existing) => existing.uid !== item.uid), item];
}

function visibleControlPlaneLayers(functionalSeries: DicomSeriesRef | undefined, visibleOverlays: readonly OverlayRef[]): ViewerControlPlaneLayer[] {
  return [
    ...(functionalSeries ? [{ uid: functionalSeries.uid, label: functionalSeries.label, kind: "functional" as const, role: "functional" as const }] : []),
    ...visibleOverlays.map((overlay) => ({ uid: overlay.uid, label: overlay.label, kind: overlay.kind, role: "overlay" as const })),
  ];
}

function fusionStatus(baseSeries: DicomSeriesRef | undefined, visibleLayers: readonly ViewerControlPlaneLayer[]): ViewerFusionContext["status"] {
  if (!baseSeries) {
    return "empty";
  }
  return visibleLayers.length > 0 ? "planned-overlays" : "base-only";
}

function integerOrUndefined(value: number | undefined): number | undefined {
  return Number.isInteger(value) ? value : undefined;
}
