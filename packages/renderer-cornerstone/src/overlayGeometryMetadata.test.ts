import { describe, expect, it, vi } from "vitest";
import type { DicomMetadataReader } from "@pycom-next/dicom";
import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";
import { createOverlayGeometryMetadataCache } from "./overlayGeometryMetadata";

describe("overlay geometry metadata", () => {
  it("reuses existing asset metadata", async () => {
    const reader = metadataReader();
    const cache = createOverlayGeometryMetadataCache(reader);
    const asset: ClinicalViewportAsset = {
      path: "mask/001.dcm",
      data: new Blob(["mask"]),
      dicom: { modality: "SEG", seriesInstanceUid: "mask-series" },
    };

    await expect(cache.metadataForAsset(asset)).resolves.toEqual(asset.dicom);
    expect(reader.readMetadata).not.toHaveBeenCalled();
  });

  it("loads and caches metadata for path-only overlay assets", async () => {
    const reader = metadataReader({ modality: "SEG", seriesInstanceUid: "mask-series", imagePositionPatient: [0, 0, 5] });
    const cache = createOverlayGeometryMetadataCache(reader);
    const asset: ClinicalViewportAsset = { path: "mask/001.dcm", data: new Blob(["mask"]) };

    await expect(cache.metadataForAsset(asset)).resolves.toMatchObject({ imagePositionPatient: [0, 0, 5] });
    await expect(cache.metadataForAsset(asset)).resolves.toMatchObject({ imagePositionPatient: [0, 0, 5] });
    expect(reader.readMetadata).toHaveBeenCalledTimes(1);
  });
});

function metadataReader(metadata?: Awaited<ReturnType<DicomMetadataReader["readMetadata"]>>): DicomMetadataReader {
  return {
    id: "test-reader",
    readMetadata: vi.fn(async () => metadata),
  };
}
