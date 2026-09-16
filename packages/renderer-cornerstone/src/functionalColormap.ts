import { functionalOverlayColormap, type FunctionalOverlayColormap } from "@pycom-next/react-viewer/overlayPresentation";

export function functionalPixelColor(value: number, colormap: FunctionalOverlayColormap | undefined): [number, number, number] {
  const normalized = clamp(value, 0, 1);
  const preset = functionalOverlayColormap(colormap);
  if (preset === "grayscale") {
    const gray = Math.round(255 * normalized);
    return [gray, gray, gray];
  }
  if (preset === "viridis") {
    return viridisColor(normalized);
  }
  return heatColor(normalized);
}

function viridisColor(value: number): [number, number, number] {
  const stops: [number, number, number][] = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
  const scaled = value * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  return interpolate(stops[index] ?? stops[0], stops[index + 1] ?? stops.at(-1) ?? stops[0], scaled - index);
}

function heatColor(value: number): [number, number, number] {
  return [Math.round(255 * Math.min(1, value * 2)), Math.round(255 * Math.max(0, Math.min(1, value * 2 - 0.35))), Math.round(80 * Math.max(0, 1 - value))];
}

function interpolate(left: [number, number, number], right: [number, number, number], amount: number): [number, number, number] {
  return [0, 1, 2].map((index) => Math.round(left[index] + (right[index] - left[index]) * amount)) as [number, number, number];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
