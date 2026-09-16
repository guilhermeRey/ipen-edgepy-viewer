import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overlayImageData } from "./fusionOverlayImageData";
import type { FusionOverlayLayer, RuntimeImageLike } from "./fusionOverlayTypes";

describe("overlayImageData", () => {
  beforeEach(() => {
    vi.stubGlobal("ImageData", TestImageData);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders mask pixels with the overlay color and constant opacity", () => {
    const data = overlayImageData(image([0, 1], 0, 2), layer("mask", "#112233", 0.5), { width: 2, height: 1 });

    expect(Array.from(data.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(data.data.slice(4, 8))).toEqual([17, 34, 51, 128]);
  });

  it("renders dose pixels with a heatmap color and readable opacity", () => {
    const data = overlayImageData(image([0.02, 0.5], 0, 1), layer("dose", "#000000", 0.5), { width: 2, height: 1 });

    expect(Array.from(data.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(data.data.slice(4, 8))).toEqual([43, 227, 210, 86]);
  });

  it("maps dose intensity through blue, cyan, gold, and red heatmap stops", () => {
    const data = overlayImageData(image([0.25, 0.5, 0.75, 1], 0, 1), layer("dose", "#000000", 1), { width: 4, height: 1 });

    expect(Array.from(data.data.slice(0, 4))).toEqual([37, 99, 235, 131]);
    expect(Array.from(data.data.slice(4, 8))).toEqual([43, 227, 210, 172]);
    expect(Array.from(data.data.slice(8, 12))).toEqual([255, 210, 63, 214]);
    expect(Array.from(data.data.slice(12, 16))).toEqual([239, 68, 68, 255]);
  });

  it("renders functional pixels with the selected colormap", () => {
    const data = overlayImageData(image([0.5], 0, 1), { ...layer("functional", "#000000", 1), colormap: "grayscale" }, { width: 1, height: 1 });

    expect(Array.from(data.data.slice(0, 4))).toEqual([128, 128, 128, 128]);
  });
});

function image(pixelData: readonly number[], minPixelValue: number, maxPixelValue: number): RuntimeImageLike {
  return {
    minPixelValue,
    maxPixelValue,
    width: pixelData.length,
    height: 1,
    getPixelData: () => pixelData,
  };
}

function layer(purpose: FusionOverlayLayer["purpose"], color: string, opacity: number): FusionOverlayLayer {
  return { label: purpose, purpose, assets: [], imageIds: [], color, opacity };
}

class TestImageData {
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}
