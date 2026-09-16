import type { RtstructMetadata } from "@pycom-next/dicom";
import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";
import { imagePlaneFromDicom, type DicomImagePlane } from "./dicomGeometry";
import { cachedRtstructMetadata, type RtstructMetadataCache } from "./rtstructContourCache";
import { rtstructContourMatchMode } from "./rtstructSliceMatch";

export interface RtstructRoiSliceRequest {
  baseAssets: readonly ClinicalViewportAsset[];
  rtstructAssets: readonly ClinicalViewportAsset[];
  roiNumber: number;
  cache: RtstructMetadataCache;
}

export async function firstRtstructRoiSliceIndex(request: RtstructRoiSliceRequest): Promise<number | undefined> {
  const metadataItems = await Promise.all(request.rtstructAssets.map((asset) => cachedRtstructMetadata(asset, request.cache)));
  for (let sliceIndex = 0; sliceIndex < request.baseAssets.length; sliceIndex += 1) {
    if (metadataItems.some((metadata) => rtstructHasRoiOnSlice(metadata, request.roiNumber, request.baseAssets[sliceIndex]))) {
      return sliceIndex;
    }
  }
  return undefined;
}

function rtstructHasRoiOnSlice(
  metadata: RtstructMetadata | undefined,
  roiNumber: number,
  baseAsset: ClinicalViewportAsset | undefined,
): boolean {
  const sopInstanceUid = baseAsset?.dicom?.sopInstanceUid;
  if (!metadata || !sopInstanceUid) {
    return false;
  }
  const basePlane = imagePlaneFromDicom(baseAsset.dicom);
  return metadata.structures.some((structure) => (
    structure.roiNumber === roiNumber && hasMatchingContour(structure.contours, sopInstanceUid, basePlane)
  ));
}

function hasMatchingContour(
  contours: RtstructMetadata["structures"][number]["contours"],
  sopInstanceUid: string,
  basePlane: DicomImagePlane | undefined,
): boolean {
  return Boolean(contours?.some((contour) => rtstructContourMatchMode(contour, sopInstanceUid, basePlane)));
}
