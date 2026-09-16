import type { DataSet } from "dicom-parser";
import type { DicomMetadata, RtstructContourMetadata, RtstructStructureMetadata } from "../metadata";

const RTSTRUCT_TAG = {
  MODALITY: "x00080060",
  STRUCTURE_SET_LABEL: "x30060002",
  STRUCTURE_SET_NAME: "x30060004",
  STRUCTURE_SET_ROI_SEQUENCE: "x30060020",
  ROI_NUMBER: "x30060022",
  ROI_NAME: "x30060026",
  CONTOUR_IMAGE_SEQUENCE: "x30060016",
  REFERENCED_SOP_INSTANCE_UID: "x00081155",
  ROI_CONTOUR_SEQUENCE: "x30060039",
  CONTOUR_SEQUENCE: "x30060040",
  CONTOUR_GEOMETRIC_TYPE: "x30060042",
  NUMBER_OF_CONTOUR_POINTS: "x30060046",
  CONTOUR_DATA: "x30060050",
  REFERENCED_ROI_NUMBER: "x30060084",
} as const;

type RtstructTag = (typeof RTSTRUCT_TAG)[keyof typeof RTSTRUCT_TAG];

export function rtstructMetadataFromDataSet(dataSet: DataSet): DicomMetadata["rtstruct"] {
  return rtstructMetadataFromDataSetWithOptions(dataSet, { includePoints: false });
}

export function rtstructContourMetadataFromDataSet(dataSet: DataSet): DicomMetadata["rtstruct"] {
  return rtstructMetadataFromDataSetWithOptions(dataSet, { includePoints: true });
}

function rtstructMetadataFromDataSetWithOptions(dataSet: DataSet, options: { includePoints: boolean }): DicomMetadata["rtstruct"] {
  if (stringTag(dataSet, RTSTRUCT_TAG.MODALITY)?.toUpperCase() !== "RTSTRUCT") {
    return undefined;
  }
  const roiNames = structureSetRoiNames(dataSet);
  const contourStructures = sequenceItems(dataSet, RTSTRUCT_TAG.ROI_CONTOUR_SEQUENCE).map((item) => roiContourMetadata(item, roiNames, options));
  const structures = contourStructures.length > 0
    ? contourStructures
    : Array.from(roiNames.entries()).map(([roiNumber, name]) => ({ roiNumber, name, contourCount: 0, pointCount: 0 }));
  const contourCount = structures.reduce((sum, item) => sum + item.contourCount, 0);
  const pointCount = structures.reduce((sum, item) => sum + item.pointCount, 0);
  return cleanUndefined({
    structureCount: structures.length,
    contourCount,
    pointCount,
    structureSetLabel: stringTag(dataSet, RTSTRUCT_TAG.STRUCTURE_SET_LABEL),
    structureSetName: stringTag(dataSet, RTSTRUCT_TAG.STRUCTURE_SET_NAME),
    structures,
  }) as DicomMetadata["rtstruct"];
}

function structureSetRoiNames(dataSet: DataSet): Map<number, string> {
  const names = new Map<number, string>();
  for (const item of sequenceItems(dataSet, RTSTRUCT_TAG.STRUCTURE_SET_ROI_SEQUENCE)) {
    const roiNumber = item.intString(RTSTRUCT_TAG.ROI_NUMBER);
    const name = stringTag(item, RTSTRUCT_TAG.ROI_NAME);
    if (roiNumber !== undefined && name) {
      names.set(roiNumber, name);
    }
  }
  return names;
}

function roiContourMetadata(item: DataSet, roiNames: ReadonlyMap<number, string>, options: { includePoints: boolean }): RtstructStructureMetadata {
  const roiNumber = item.intString(RTSTRUCT_TAG.REFERENCED_ROI_NUMBER);
  const contours = sequenceItems(item, RTSTRUCT_TAG.CONTOUR_SEQUENCE).map((contour) => contourMetadata(contour, options));
  const referencedSopInstanceUids = uniqueStrings(contours.flatMap((contour) => contour.referencedSopInstanceUids ?? []));
  return cleanUndefined({
    ...(roiNumber !== undefined ? { roiNumber } : {}),
    ...(roiNumber !== undefined && roiNames.get(roiNumber) ? { name: roiNames.get(roiNumber) } : {}),
    contourCount: contours.length,
    pointCount: contours.reduce((sum, contour) => sum + contour.pointCount, 0),
    ...(referencedSopInstanceUids.length > 0 ? { referencedSopInstanceUids } : {}),
    ...(contours.length > 0 ? { contours } : {}),
  }) as RtstructStructureMetadata;
}

function contourMetadata(dataSet: DataSet, options: { includePoints: boolean }): RtstructContourMetadata {
  const points = options.includePoints ? numberListTag(dataSet, RTSTRUCT_TAG.CONTOUR_DATA) : undefined;
  const pointCount = dataSet.intString(RTSTRUCT_TAG.NUMBER_OF_CONTOUR_POINTS) ?? Math.floor((points?.length ?? dataSet.numStringValues(RTSTRUCT_TAG.CONTOUR_DATA) ?? 0) / 3);
  const referencedSopInstanceUids = sequenceItems(dataSet, RTSTRUCT_TAG.CONTOUR_IMAGE_SEQUENCE).flatMap((item) => stringTag(item, RTSTRUCT_TAG.REFERENCED_SOP_INSTANCE_UID) ?? []);
  return cleanUndefined({
    geometricType: stringTag(dataSet, RTSTRUCT_TAG.CONTOUR_GEOMETRIC_TYPE),
    pointCount,
    ...(points ? { points } : {}),
    ...(referencedSopInstanceUids.length > 0 ? { referencedSopInstanceUids } : {}),
  }) as RtstructContourMetadata;
}

function sequenceItems(dataSet: DataSet, tag: RtstructTag): DataSet[] {
  const items = (dataSet.elements[tag] as { items?: { dataSet?: DataSet }[] } | undefined)?.items ?? [];
  return items.map((item) => item.dataSet).filter((item): item is DataSet => Boolean(item));
}

function stringTag(dataSet: DataSet, tag: RtstructTag): string | undefined {
  const value = dataSet.string(tag)?.trim();
  return value ? value : undefined;
}

function numberListTag(dataSet: DataSet, tag: RtstructTag): readonly number[] | undefined {
  const rawValue = dataSet.string(tag);
  if (rawValue) {
    const values = rawValue.split("\\").map((value) => Number(value.trim())).filter(Number.isFinite);
    return values.length > 0 ? values : undefined;
  }

  const count = dataSet.numStringValues(tag) ?? 0;
  const values = Array.from({ length: count }, (_unused, index) => dataSet.floatString(tag, index)).filter(
    (value): value is number => typeof value === "number",
  );
  return values.length > 0 ? values : undefined;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function cleanUndefined<T extends Record<string, unknown>>(metadata: T): T {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) as T;
}
