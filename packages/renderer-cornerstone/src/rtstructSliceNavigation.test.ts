import { describe, expect, it } from "vitest";
import type { RtstructMetadata } from "@pycom-next/dicom";
import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";
import type { RtstructMetadataCache } from "./rtstructContourCache";
import { firstRtstructRoiSliceIndex } from "./rtstructSliceNavigation";

describe("RTSTRUCT slice navigation", () => {
  it("finds the first slice containing a ROI by referenced SOP", async () => {
    const cache = cacheWith(rtstructMetadata({ roiNumber: 2, referencedSopInstanceUids: ["sop-2"], points: contourPointsAtZ(20) }));

    await expect(firstRtstructRoiSliceIndex({ baseAssets: baseAssets(), rtstructAssets: [rtstructAsset()], roiNumber: 2, cache })).resolves.toBe(1);
  });

  it("falls back to patient-space geometry when referenced SOP targets another series", async () => {
    const cache = cacheWith(rtstructMetadata({ roiNumber: 3, referencedSopInstanceUids: ["spect-1"], points: contourPointsAtZ(10) }));

    await expect(firstRtstructRoiSliceIndex({ baseAssets: baseAssets(), rtstructAssets: [rtstructAsset()], roiNumber: 3, cache })).resolves.toBe(1);
  });

  it("returns undefined when the ROI has no matching contour", async () => {
    const cache = cacheWith(rtstructMetadata({ roiNumber: 4, referencedSopInstanceUids: ["outside"], points: contourPointsAtZ(100) }));

    await expect(firstRtstructRoiSliceIndex({ baseAssets: baseAssets(), rtstructAssets: [rtstructAsset()], roiNumber: 4, cache })).resolves.toBeUndefined();
  });
});

function cacheWith(metadata: RtstructMetadata): RtstructMetadataCache {
  return { metadataByPath: new Map([["rt.dcm", Promise.resolve(metadata)]]), metricsByPath: new Map() };
}

function rtstructMetadata(options: {
  roiNumber: number;
  referencedSopInstanceUids: readonly string[];
  points?: readonly number[];
}): RtstructMetadata {
  return {
    structureCount: 1,
    contourCount: 1,
    pointCount: 3,
    structures: [{
      roiNumber: options.roiNumber,
      contourCount: 1,
      pointCount: 3,
      contours: [{ pointCount: 3, points: options.points ?? contourPointsAtZ(0), referencedSopInstanceUids: options.referencedSopInstanceUids }],
    }],
  };
}

function baseAssets(): ClinicalViewportAsset[] {
  return [baseAsset("sop-1", 0), baseAsset("sop-2", 10), baseAsset("sop-3", 20)];
}

function baseAsset(sopInstanceUid: string, z: number): ClinicalViewportAsset {
  return {
    path: `${sopInstanceUid}.dcm`,
    data: new ArrayBuffer(0),
    dicom: {
      sopInstanceUid,
      imagePositionPatient: [0, 0, z],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      pixelSpacing: [1, 1],
    },
  };
}

function rtstructAsset(): ClinicalViewportAsset {
  return { path: "rt.dcm", data: new ArrayBuffer(0) };
}

function contourPointsAtZ(z: number): number[] {
  return [0, 0, z, 1, 0, z, 0, 1, z];
}
