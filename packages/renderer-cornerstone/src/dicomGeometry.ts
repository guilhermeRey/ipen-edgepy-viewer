import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";

export type Point3 = [number, number, number];

export interface DicomImagePlane {
  origin: Point3;
  rowCosines: Point3;
  columnCosines: Point3;
  normal: Point3;
  rowSpacing: number;
  columnSpacing: number;
}

export interface DicomImageCorners {
  origin: Point3;
  columnEnd: Point3;
  rowEnd: Point3;
}

export type GeometryCompatibilityStatus = "compatible" | "different-frame" | "missing-geometry" | "orientation-mismatch";

const ORIENTATION_TOLERANCE = 1e-3;

type DicomMetadata = ClinicalViewportAsset["dicom"];

export function imagePlaneFromDicom(metadata: DicomMetadata | undefined): DicomImagePlane | undefined {
  const input = imagePlaneInput(metadata);
  if (!input) {
    return undefined;
  }

  const rowCosines = vector3(input.orientation.slice(0, 3));
  const columnCosines = vector3(input.orientation.slice(3, 6));
  const rowSpacing = input.spacing[0];
  const columnSpacing = input.spacing[1];
  if (!rowCosines || !columnCosines || !isPositiveFinite(rowSpacing) || !isPositiveFinite(columnSpacing)) {
    return undefined;
  }

  return { origin: input.origin, rowCosines, columnCosines, normal: cross(rowCosines, columnCosines), rowSpacing, columnSpacing };
}

function imagePlaneInput(metadata: DicomMetadata | undefined): { origin: Point3; orientation: readonly number[]; spacing: readonly number[] } | undefined {
  const origin = vector3(metadata?.imagePositionPatient);
  const orientation = metadata?.imageOrientationPatient;
  const spacing = metadata?.pixelSpacing;
  return origin && orientation && orientation.length >= 6 && spacing && spacing.length >= 2 ? { origin, orientation, spacing } : undefined;
}

export function nearestSliceIndexForBaseSlice(
  baseMetadata: DicomMetadata | undefined,
  overlayMetadata: Array<DicomMetadata | undefined>,
  fallbackSliceIndex: number,
): number {
  const basePlane = imagePlaneFromDicom(baseMetadata);
  const basePosition = basePlane ? slicePositionOnNormal(baseMetadata, basePlane) : undefined;
  if (!basePlane || basePosition === undefined || overlayMetadata.length === 0) {
    return clamp(fallbackSliceIndex, 0, Math.max(0, overlayMetadata.length - 1));
  }

  let bestIndex: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < overlayMetadata.length; index += 1) {
    const position = slicePositionOnNormal(overlayMetadata[index], basePlane);
    if (position !== undefined && Math.abs(position - basePosition) < bestDistance) {
      bestDistance = Math.abs(position - basePosition);
      bestIndex = index;
    }
  }
  return bestIndex ?? clamp(fallbackSliceIndex, 0, overlayMetadata.length - 1);
}

export function imagePlaneCorners(plane: DicomImagePlane, width: number, height: number): DicomImageCorners | undefined {
  if (!isPositiveFinite(width) || !isPositiveFinite(height)) {
    return undefined;
  }
  return {
    origin: plane.origin,
    columnEnd: add(plane.origin, scaleVector(plane.rowCosines, plane.columnSpacing * width)),
    rowEnd: add(plane.origin, scaleVector(plane.columnCosines, plane.rowSpacing * height)),
  };
}

export function geometryCompatibility(
  baseMetadata: DicomMetadata | undefined,
  overlayMetadata: DicomMetadata | undefined,
): GeometryCompatibilityStatus {
  const basePlane = imagePlaneFromDicom(baseMetadata);
  const overlayPlane = imagePlaneFromDicom(overlayMetadata);
  if (!basePlane || !overlayPlane) {
    return "missing-geometry";
  }

  const sameFrameOfReference = Boolean(
    baseMetadata?.frameOfReferenceUid &&
      overlayMetadata?.frameOfReferenceUid &&
      baseMetadata.frameOfReferenceUid === overlayMetadata.frameOfReferenceUid,
  );
  if (!sameFrameOfReference) {
    return "different-frame";
  }
  if (!vectorsClose(basePlane.rowCosines, overlayPlane.rowCosines) || !vectorsClose(basePlane.columnCosines, overlayPlane.columnCosines)) {
    return "orientation-mismatch";
  }
  return "compatible";
}

function slicePositionOnNormal(metadata: DicomMetadata | undefined, referencePlane: DicomImagePlane): number | undefined {
  const origin = vector3(metadata?.imagePositionPatient);
  return origin ? dot(origin, referencePlane.normal) : undefined;
}

function vector3(values: readonly number[] | undefined): Point3 | undefined {
  if (!values || values.length < 3) {
    return undefined;
  }
  const vector: Point3 = [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
  return vector.every(Number.isFinite) ? vector : undefined;
}

function add(left: Point3, right: Point3): Point3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scaleVector(vector: Point3, scale: number): Point3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function cross(left: Point3, right: Point3): Point3 {
  return [left[1] * right[2] - left[2] * right[1], left[2] * right[0] - left[0] * right[2], left[0] * right[1] - left[1] * right[0]];
}

function dot(left: Point3, right: Point3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function vectorsClose(left: Point3, right: Point3): boolean {
  return left.every((value, index) => Math.abs(value - (right[index] ?? 0)) <= ORIENTATION_TOLERANCE);
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
