import type {
  ClinicalSeriesRole,
  ClinicalStudyInput,
  DicomSeriesRef,
  OverlayKind,
  OverlayRef,
} from "@pycom-next/core";
import type { DicomInventoryEntry, DicomSeriesInventory } from "./inventory";
import { splitPath } from "./pathClassification";

export interface DicomClinicalStudyInputOptions {
  uid: string;
  label: string;
}

export interface DicomClinicalInventoryInput {
  entries: readonly DicomInventoryEntry[];
  series: readonly DicomSeriesInventory[];
}

export function createClinicalStudyInputFromDicomInventory(
  inventory: DicomClinicalInventoryInput,
  options: DicomClinicalStudyInputOptions,
): ClinicalStudyInput {
  const series = inventory.series.filter((item) => item.kind === "image").map(dicomSeriesToCoreSeries);
  const overlays = [
    ...inventory.series
      .filter((item) => item.kind === "mask" || item.kind === "dose")
      .map((item) => dicomSeriesToOverlay(item, series)),
    ...inventory.entries
      .filter((entry) => entry.kind === "rtstruct")
      .map((entry) => rtstructEntryToOverlay(entry, series)),
  ];

  return {
    uid: options.uid,
    label: options.label,
    series,
    overlays,
  };
}

function dicomSeriesToCoreSeries(series: DicomSeriesInventory): DicomSeriesRef {
  return {
    uid: series.uid,
    label: seriesLabel(series),
    role: roleForModality(series.modality),
    ...(series.modality ? { modality: series.modality } : {}),
    ...(series.scanId ? { scanId: series.scanId } : {}),
    instanceCount: series.instanceCount,
    metadata: inventoryMetadata(series),
  };
}

function dicomSeriesToOverlay(series: DicomSeriesInventory, targetSeries: readonly DicomSeriesRef[]): OverlayRef {
  const pathInfo = series.kind === "dose" ? dosePathInfo(series.paths[0]) : overlayPathInfo(series.paths[0]);
  const targetSeriesUid = targetSeriesUidForScan(targetSeries, series.scanId);
  return {
    uid: series.uid.replace(/^dicom-series:/, "dicom-overlay:"),
    label: overlayLabel(series, pathInfo),
    ...(series.scanId ? { scanId: series.scanId } : {}),
    ...(targetSeriesUid ? { targetSeriesUid } : {}),
    kind: overlayKind(series.kind),
    ...(pathInfo.group ? { group: pathInfo.group } : {}),
    ...(pathInfo.structure ? { structure: pathInfo.structure } : {}),
    metadata: inventoryMetadata(series),
  };
}

function rtstructEntryToOverlay(entry: DicomInventoryEntry, targetSeries: readonly DicomSeriesRef[]): OverlayRef {
  const pathInfo = overlayPathInfo(entry.path);
  const rtstructStructure = rtstructStructureLabel(entry.metadata) ?? nonUidLabel(pathInfo.structure);
  const targetSeriesUid = targetSeriesUidForScan(targetSeries, entry.scanId);
  return {
    uid: `dicom-rtstruct:${slug(entry.path)}`,
    label: rtstructStructure
      ? `${entry.scanId ?? "Study"} RTSTRUCT ${rtstructStructure}`
      : `${entry.scanId ?? "Study"} RTSTRUCT`,
    ...(entry.scanId ? { scanId: entry.scanId } : {}),
    ...(targetSeriesUid ? { targetSeriesUid } : {}),
    kind: "rtstruct",
    ...(pathInfo.group ? { group: pathInfo.group } : {}),
    ...(rtstructStructure ? { structure: rtstructStructure } : {}),
    metadata: {
      path: entry.path,
      ...(entry.metadata ? { dicom: entry.metadata } : {}),
    },
  };
}

function roleForModality(modality: string | undefined): ClinicalSeriesRole {
  const normalized = modality?.toUpperCase();
  if (normalized && BASE_IMAGE_MODALITIES.has(normalized)) {
    return "base";
  }
  if (normalized === "PT" || normalized === "NM") {
    return "functional";
  }
  if (normalized === "RTDOSE") {
    return "dose";
  }
  return "unknown";
}

const BASE_IMAGE_MODALITIES = new Set(["CR", "CT", "DX", "MG", "MR", "OT", "SC", "US", "XA"]);

function overlayKind(kind: DicomSeriesInventory["kind"]): OverlayKind {
  return kind === "dose" ? "dose" : "mask";
}

function targetSeriesUidForScan(series: readonly DicomSeriesRef[], scanId: string | undefined): string | undefined {
  return series.find((item) => item.scanId === scanId && item.role === "base")?.uid;
}

function seriesLabel(series: DicomSeriesInventory): string {
  const description = nonUidLabel(series.instances.find((instance) => instance.metadata?.seriesDescription)?.metadata?.seriesDescription);
  return [series.scanId, description ?? series.modality ?? series.kind].filter(Boolean).join(" ") || series.key;
}

function overlayLabel(series: DicomSeriesInventory, pathInfo: OverlayPathInfo): string {
  if (series.kind === "dose") {
    return pathInfo.structure ?? "Dose";
  }
  return [series.scanId, pathInfo.group, pathInfo.structure].filter(Boolean).join(" ") || series.key;
}

interface OverlayPathInfo {
  group?: string | undefined;
  structure?: string | undefined;
}

function overlayPathInfo(path: string | undefined): OverlayPathInfo {
  if (!path) {
    return {};
  }
  const parts = splitPath(path);
  const markerIndex = parts.findIndex((part) =>
    ["masks", "mask", "rtstructs", "rtstruct", "rtdose", "dose"].includes(part.toLowerCase()),
  );
  if (markerIndex === -1) {
    const structure = fileStem(parts.at(-1));
    return structure ? { structure } : {};
  }
  return {
    ...(parts[markerIndex + 1] ? { group: parts[markerIndex + 1] } : {}),
    ...(parts[markerIndex + 2] ? { structure: fileStem(parts[markerIndex + 2]) } : {}),
  };
}

function dosePathInfo(path: string | undefined): OverlayPathInfo {
  const structure = doseLabel(fileStem(splitPath(path ?? "").at(-1)));
  return { group: "Dose", ...(structure ? { structure } : {}) };
}

function inventoryMetadata(series: DicomSeriesInventory): Record<string, unknown> {
  return {
    key: series.key,
    paths: series.paths,
    instances: series.instances.map((instance) => ({
      path: instance.path,
      ...(instance.metadata ? { dicom: instance.metadata } : {}),
    })),
    metadataReadyCount: series.metadataReadyCount,
    metadataMissingCount: series.metadataMissingCount,
  };
}

function fileStem(value: string | undefined): string | undefined {
  return value?.replace(/\.[^.]+$/, "") || undefined;
}

function doseLabel(value: string | undefined): string | undefined {
  const normalized = trimDoseSeparators(stripDoseSuffix(stripPatientPrefix(value ?? ""))).replace(/_/g, " ").trim();
  if (!normalized) {
    return undefined;
  }
  if (/^beta-?$/i.test(normalized)) {
    return "Beta- dose";
  }
  if (/^gamma$/i.test(normalized)) {
    return "Gamma dose";
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} dose`;
}

function rtstructStructureLabel(metadata: DicomInventoryEntry["metadata"]): string | undefined {
  const rtstruct = metadata?.rtstruct;
  const setLabel = nonUidLabel(rtstruct?.structureSetLabel) ?? nonUidLabel(rtstruct?.structureSetName);
  if (setLabel) {
    return setLabel;
  }
  const roiNames = rtstruct?.structures.map((structure) => nonUidLabel(structure.name)).filter((name): name is string => Boolean(name)) ?? [];
  if (roiNames.length === 0) {
    return undefined;
  }
  return roiNames.length === 1 ? roiNames[0] : `${roiNames[0]} + ${roiNames.length - 1} ROI`;
}

function nonUidLabel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && !isDicomUid(trimmed) ? trimmed : undefined;
}

function isDicomUid(value: string): boolean {
  return /^\d+(?:\.\d+){2,}$/.test(value);
}

function stripPatientPrefix(value: string): string {
  const lower = value.toLowerCase();
  if (!lower.startsWith("patient")) {
    return value;
  }
  return trimDoseSeparators(value.slice("patient".length));
}

function stripDoseSuffix(value: string): string {
  return value.toLowerCase().endsWith("dose") ? value.slice(0, -"dose".length) : value;
}

function trimDoseSeparators(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isDoseSeparator(value[start])) {
    start += 1;
  }
  while (end > start && isDoseSeparator(value[end - 1])) {
    end -= 1;
  }
  return value.slice(start, end);
}

function isDoseSeparator(value: string | undefined): boolean {
  return value === "-" || value === "_" || value === " " || value === "\t" || value === "\n" || value === "\r";
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}
