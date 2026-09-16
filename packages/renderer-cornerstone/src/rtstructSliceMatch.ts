import type { RtstructContourMetadata } from "@pycom-next/dicom";
import type { DicomImagePlane, Point3 } from "./dicomGeometry";

const RTSTRUCT_PLANE_TOLERANCE_MM = 1.5;

export function rtstructContourMatchMode(
  contour: RtstructContourMetadata,
  sopInstanceUid: string,
  basePlane: DicomImagePlane | undefined,
): "sop" | "geometry" | undefined {
  if (contour.referencedSopInstanceUids?.includes(sopInstanceUid)) {
    return "sop";
  }
  return contour.points && basePlane && contourDistanceToPlane(contour.points, basePlane) <= RTSTRUCT_PLANE_TOLERANCE_MM
    ? "geometry"
    : undefined;
}

function contourDistanceToPlane(points: readonly number[], plane: DicomImagePlane): number {
  if (points.length < 3) {
    return Number.POSITIVE_INFINITY;
  }
  const point: Point3 = [points[0] ?? 0, points[1] ?? 0, points[2] ?? 0];
  return Math.abs(
    (point[0] - plane.origin[0]) * plane.normal[0] +
    (point[1] - plane.origin[1]) * plane.normal[1] +
    (point[2] - plane.origin[2]) * plane.normal[2],
  );
}
