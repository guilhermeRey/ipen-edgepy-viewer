import { describe, expect, it } from "vitest";
import { cornerstoneCurrentImageData } from "./cornerstoneCurrentImage";

describe("cornerstoneCurrentImageData", () => {
  it("copies decoded pixels from the active slice", async () => {
    const source = new Int16Array([-10, 20]);
    const result = await cornerstoneCurrentImageData({
      assets: [{ path: "slice.dcm", data: new ArrayBuffer(0), dicom: { seriesInstanceUid: "series-1" } }],
      imageIds: ["wadouri:slice"],
      viewport: { getCurrentImageIdIndex: () => 0 },
      loadImage: async () => ({ width: 2, height: 1, minPixelValue: -10, maxPixelValue: 20, getPixelData: () => source }),
    });

    expect(result).toMatchObject({ width: 2, height: 1, sliceIndex: 0, imageId: "wadouri:slice", seriesUid: "series-1" });
    expect(result?.values).toEqual(new Float32Array([-10, 20]));
    expect(result?.values.buffer).not.toBe(source.buffer);
  });
});
