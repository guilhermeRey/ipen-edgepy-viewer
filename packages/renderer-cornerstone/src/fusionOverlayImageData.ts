import { functionalPixelColor } from "./functionalColormap";
import type { FusionOverlayLayer, RuntimeImageLike } from "./fusionOverlayTypes";

interface OverlayImageDataSize {
  width: number;
  height: number;
}

const DOSE_HEATMAP_STOPS: Array<[number, [number, number, number]]> = [
  [0, [5, 12, 28]],
  [0.25, [37, 99, 235]],
  [0.5, [43, 227, 210]],
  [0.75, [255, 210, 63]],
  [1, [239, 68, 68]],
];

export function overlayImageData(image: RuntimeImageLike, layer: FusionOverlayLayer, size: OverlayImageDataSize): ImageData {
  const pixelData = image.getPixelData();
  const output = new ImageData(size.width, size.height);
  const color = rgbFromHex(layer.color);
  const min = finiteNumber(image.minPixelValue) ?? minPixelValue(pixelData);
  const max = finiteNumber(image.maxPixelValue) ?? maxPixelValue(pixelData);
  const range = max > min ? max - min : 1;
  const threshold = layer.purpose === "mask" ? 0 : 0.04;

  for (let index = 0; index < size.width * size.height; index += 1) {
    const normalized = clamp((Number(pixelData[index] ?? 0) - min) / range, 0, 1);
    if (normalized <= threshold) {
      continue;
    }
    const pixelColor = pixelColorForLayer(layer, color, normalized);
    const offset = index * 4;
    output.data[offset] = pixelColor[0];
    output.data[offset + 1] = pixelColor[1];
    output.data[offset + 2] = pixelColor[2];
    output.data[offset + 3] = Math.round(255 * layer.opacity * opacityScale(layer, normalized));
  }
  return output;
}

function opacityScale(layer: FusionOverlayLayer, normalized: number): number {
  if (layer.purpose === "mask") {
    return 1;
  }
  return layer.purpose === "dose" ? 0.35 + normalized * 0.65 : normalized;
}

function pixelColorForLayer(layer: FusionOverlayLayer, maskColor: [number, number, number], normalized: number): [number, number, number] {
  if (layer.purpose === "mask") {
    return maskColor;
  }
  return layer.purpose === "functional" ? functionalPixelColor(normalized, layer.colormap) : doseHeatmapColor(normalized);
}

function rgbFromHex(value: string): [number, number, number] {
  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized)
    ? [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16)]
    : [34, 197, 94];
}

function doseHeatmapColor(value: number): [number, number, number] {
  const normalized = clamp(value, 0, 1);
  const upperIndex = DOSE_HEATMAP_STOPS.findIndex(([stop]) => normalized <= stop);
  const index = upperIndex === -1 ? DOSE_HEATMAP_STOPS.length - 1 : upperIndex;
  const right = DOSE_HEATMAP_STOPS[index] ?? DOSE_HEATMAP_STOPS[DOSE_HEATMAP_STOPS.length - 1];
  const left = DOSE_HEATMAP_STOPS[Math.max(0, index - 1)] ?? DOSE_HEATMAP_STOPS[0];
  const span = right[0] - left[0];
  return interpolateColor(left[1], right[1], span > 0 ? (normalized - left[0]) / span : 0);
}

function interpolateColor(left: [number, number, number], right: [number, number, number], amount: number): [number, number, number] {
  return [0, 1, 2].map((index) => Math.round(left[index] + (right[index] - left[index]) * amount)) as [number, number, number];
}

function minPixelValue(values: ArrayLike<number>): number {
  let min = Number.POSITIVE_INFINITY;
  for (let index = 0; index < values.length; index += 1) {
    min = Math.min(min, Number(values[index]));
  }
  return Number.isFinite(min) ? min : 0;
}

function maxPixelValue(values: ArrayLike<number>): number {
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < values.length; index += 1) {
    max = Math.max(max, Number(values[index]));
  }
  return Number.isFinite(max) ? max : 1;
}

function finiteNumber(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
