import { hasSeriesIdentity, type DicomMetadata } from "./metadata";
import { splitPath, type DicomAssetKind } from "./pathClassification";

export interface DicomInventoryEntry {
  path: string;
  kind: DicomAssetKind;
  scanId?: string;
  metadata?: DicomMetadata;
}

export interface DicomSeriesInventory {
  uid: string;
  key: string;
  kind: DicomAssetKind;
  scanId?: string;
  modality?: string;
  instanceCount: number;
  paths: string[];
  instances: DicomSeriesInstance[];
  metadataReadyCount: number;
  metadataMissingCount: number;
}

export interface DicomSeriesInstance {
  path: string;
  metadata?: DicomMetadata;
}

export function buildDicomInventory(entries: readonly DicomInventoryEntry[]): DicomSeriesInventory[] {
  const groups = new Map<string, DicomInventoryEntry[]>();
  for (const entry of entries.filter((item) => item.kind !== "other" && item.kind !== "rtstruct")) {
    const key = inventoryGroupKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const first = group[0];
    const metadataReadyCount = group.filter((entry) => hasSeriesIdentity(entry.metadata)).length;
    const instances = group.map(seriesInstance).sort(compareSeriesInstance);
    return {
      uid: `dicom-series:${slug(key)}`,
      key,
      kind: first?.kind ?? "other",
      ...(first?.scanId ? { scanId: first.scanId } : {}),
      ...(first?.metadata?.modality ? { modality: first.metadata.modality } : {}),
      instanceCount: group.length,
      paths: instances.map((instance) => instance.path),
      instances,
      metadataReadyCount,
      metadataMissingCount: group.length - metadataReadyCount,
    };
  }).sort(compareInventory);
}

function seriesInstance(entry: DicomInventoryEntry): DicomSeriesInstance {
  return {
    path: entry.path,
    ...(entry.metadata ? { metadata: entry.metadata } : {}),
  };
}

function compareSeriesInstance(left: DicomSeriesInstance, right: DicomSeriesInstance): number {
  return compareOptionalNumber(slicePosition(left.metadata), slicePosition(right.metadata))
    || compareOptionalNumber(left.metadata?.instanceNumber, right.metadata?.instanceNumber)
    || left.path.localeCompare(right.path);
}

function slicePosition(metadata: DicomMetadata | undefined): number | undefined {
  const position = metadata?.imagePositionPatient;
  const orientation = metadata?.imageOrientationPatient;
  if (!position || position.length < 3 || !orientation || orientation.length < 6) {
    return undefined;
  }
  const normal = cross(
    [orientation[0], orientation[1], orientation[2]],
    [orientation[3], orientation[4], orientation[5]],
  );
  const value = dot([position[0], position[1], position[2]], normal);
  return Number.isFinite(value) ? value : undefined;
}

function compareOptionalNumber(left: number | undefined, right: number | undefined): number {
  if (left === undefined || right === undefined || left === right) {
    return 0;
  }
  return left - right;
}

function cross(left: readonly number[], right: readonly number[]): [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function inventoryGroupKey(entry: DicomInventoryEntry): string {
  if (entry.kind === "mask" || entry.kind === "dose") {
    return [entry.kind, entry.scanId ?? "unknown-scan", overlayGroupPath(entry)].join(":");
  }
  if (hasSeriesIdentity(entry.metadata)) {
    return ["image", entry.scanId ?? "unknown-scan", entry.metadata.seriesInstanceUid].join(":");
  }
  return ["image", entry.scanId ?? "unknown-scan", parentDirectory(entry.path)].join(":");
}

function overlayGroupPath(entry: DicomInventoryEntry): string {
  if (entry.kind === "dose" && isMhdRawPath(entry.path)) {
    return `${parentDirectory(entry.path)}/${fileStem(entry.path)}`;
  }
  return parentDirectory(entry.path);
}

function parentDirectory(path: string): string {
  const parts = splitPath(path);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : path;
}

function fileStem(path: string): string {
  const name = splitPath(path).at(-1) ?? path;
  return name.replace(/\.[^.]+$/, "");
}

function isMhdRawPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return normalized.endsWith(".mhd") || normalized.endsWith(".raw");
}

function compareInventory(left: DicomSeriesInventory, right: DicomSeriesInventory): number {
  return (
    scanSortValue(left.scanId) - scanSortValue(right.scanId) ||
    left.kind.localeCompare(right.kind) ||
    left.key.localeCompare(right.key)
  );
}

function scanSortValue(scanId: string | undefined): number {
  const match = scanId ? /\d+/.exec(scanId) : undefined;
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}
