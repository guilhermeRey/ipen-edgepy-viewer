import { describe, expect, it } from "vitest";
import { createMhdDoseVolumeCache, isMhdDoseAssetGroup } from "./mhdDoseVolume";

describe("MHD dose volume", () => {
  it("loads MET_FLOAT MHD and RAW assets as dose slices", async () => {
    const cache = createMhdDoseVolumeCache();
    const assets = [
      { path: "dose/result/patient_beta--Dose.mhd", data: new Blob([mhdHeader()]) },
      { path: "dose/result/patient_beta--Dose.raw", data: new Blob([floatBuffer([0, 1, 2, 3, 4, 5, 6, 7])]) },
    ];

    const volume = await cache.volumeForAssets(assets);
    const firstSlice = volume?.slice(0, "frame-1");
    const secondSlice = volume?.slice(1, "frame-1");

    expect(isMhdDoseAssetGroup(assets)).toBe(true);
    expect(volume?.metadata).toHaveLength(2);
    expect(firstSlice?.asset.dicom).toMatchObject({
      frameOfReferenceUid: "frame-1",
      imagePositionPatient: [10, 20, 30],
      pixelSpacing: [2, 1],
    });
    expect(Array.from(firstSlice?.image.getPixelData() ?? [])).toEqual([0, 1, 2, 3]);
    expect(Array.from(secondSlice?.image.getPixelData() ?? [])).toEqual([4, 5, 6, 7]);
  });

  it("uses a robust display maximum so dose outliers do not flatten the heatmap", async () => {
    const cache = createMhdDoseVolumeCache();
    const values = Array.from({ length: 200 }, (_, index) => index + 1);
    values.push(10_000);
    const assets = [
      { path: "dose/result/patient_beta--Dose.mhd", data: new Blob([mhdHeader({ dimSize: "201 1 1" })]) },
      { path: "dose/result/patient_beta--Dose.raw", data: new Blob([floatBuffer(values)]) },
    ];

    const volume = await cache.volumeForAssets(assets);
    const slice = volume?.slice(0, "frame-1");

    expect(slice?.image.minPixelValue).toBeGreaterThan(140);
    expect(slice?.image.minPixelValue).toBeLessThan(170);
    expect(slice?.image.maxPixelValue).toBeLessThan(10_000);
    expect(slice?.image.maxPixelValue).toBeGreaterThan(190);
  });
});

function mhdHeader(options: { dimSize?: string } = {}): string {
  return [
    "ObjectType = Image",
    "NDims = 3",
    "BinaryData = True",
    "BinaryDataByteOrderMSB = False",
    "CompressedData = False",
    "TransformMatrix = 1 0 0 0 1 0 0 0 1",
    "Offset = 10 20 30",
    "ElementSpacing = 1 2 3",
    `DimSize = ${options.dimSize ?? "2 2 2"}`,
    "ElementType = MET_FLOAT",
    "ElementDataFile = patient_beta--Dose.raw",
  ].join("\n");
}

function floatBuffer(values: readonly number[]): ArrayBuffer {
  const data = new Float32Array(values);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}
