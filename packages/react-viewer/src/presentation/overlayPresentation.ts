import type { OverlayRef } from "@pycom-next/core";

const FALLBACK_COLORS = ["#2BE3D2", "#FFD23F", "#4B8BBE", "#9DEDB8"];
const ORGAN_ROI_COLORS = ["#22c55e", "#84cc16", "#14b8a6", "#06b6d4", "#a3e635"];
const LESION_ROI_COLORS = ["#f97316", "#ef4444", "#f43f5e", "#fb7185", "#f59e0b"];
export const DEFAULT_FUNCTIONAL_OVERLAY_OPACITY = 0.55;
export const DEFAULT_MASK_OVERLAY_OPACITY = 0.65;
export const DEFAULT_DOSE_OVERLAY_OPACITY = 0.65;
export const FUNCTIONAL_OVERLAY_COLORMAPS = ["heat", "viridis", "grayscale"] as const;
export type FunctionalOverlayColormap = typeof FUNCTIONAL_OVERLAY_COLORMAPS[number];

export interface OverlayGroupPresentation {
  key: string;
  label: string;
  overlays: readonly OverlayPresentationItem[];
}

export interface OverlayPresentationItem {
  overlay: OverlayRef;
  index: number;
}

export interface RtstructRoiColorInput {
  overlay: OverlayRef;
  roiNumber: number;
  name: string | undefined;
  index: number;
}

export function overlayColor(overlay: OverlayRef, index: number): string {
  const configuredColor = metadataString(overlay.metadata?.color);
  if (configuredColor && /^#[0-9a-f]{6}$/i.test(configuredColor)) {
    return configuredColor;
  }

  const normalized = `${overlay.group ?? ""} ${overlay.kind}`.toLowerCase();
  if (normalized.includes("organ")) {
    return "#22c55e";
  }
  if (normalized.includes("lesion")) {
    return "#f97316";
  }
  if (normalized.includes("dose")) {
    return "#ef4444";
  }
  return FALLBACK_COLORS[stableColorIndex(overlay, index)] ?? "#2BE3D2";
}

export function rtstructRoiColor({ index, name, overlay, roiNumber }: RtstructRoiColorInput): string {
  const palette = rtstructRoiPalette(overlay);
  return palette[stableTextColorIndex(`${overlay.uid}|${roiNumber}|${name ?? ""}`, index, palette.length)] ?? palette[0] ?? "#2BE3D2";
}

export function overlayVisibilityLabel(visible: boolean): string {
  return visible ? "Visible" : "Hidden";
}

export function functionalOverlayOpacity(value: unknown): number {
  return opacityValue(value, DEFAULT_FUNCTIONAL_OVERLAY_OPACITY);
}

export function functionalOverlayColormap(value: unknown): FunctionalOverlayColormap {
  return typeof value === "string" && isFunctionalOverlayColormap(value) ? value : "heat";
}

export function functionalOverlayColormapLabel(value: FunctionalOverlayColormap): string {
  if (value === "viridis") {
    return "Viridis";
  }
  return value === "grayscale" ? "Grayscale" : "Heat";
}

export function overlayOpacity(overlay: OverlayRef): number {
  return opacityValue(overlay.metadata?.opacity, overlay.kind === "dose" ? DEFAULT_DOSE_OVERLAY_OPACITY : DEFAULT_MASK_OVERLAY_OPACITY);
}

export function clampOverlayOpacity(value: number): number {
  return clamp(value, 0, 1);
}

export function overlayToggleActionLabel(overlay: OverlayRef, visible: boolean): string {
  return `${visible ? "Hide" : "Show"} ${overlay.label}`;
}

export function overlayGroupLabel(overlay: OverlayRef): string {
  return [overlay.group, overlay.structure].filter(Boolean).join(" / ") || overlay.kind;
}

export function groupOverlaysByGroup(overlays: readonly OverlayRef[]): OverlayGroupPresentation[] {
  const groups = new Map<string, OverlayPresentationItem[]>();
  overlays.forEach((overlay, index) => {
    const key = overlay.group ?? overlay.kind;
    groups.set(key, [...(groups.get(key) ?? []), { overlay, index }]);
  });
  return Array.from(groups.entries()).map(([key, items]) => ({ key, label: key, overlays: items }));
}

export function renderableOverlays(overlays: readonly OverlayRef[]): OverlayRef[] {
  return overlays.filter((overlay) => overlay.kind !== "rtstruct");
}

export function rtstructReferenceOverlays(overlays: readonly OverlayRef[]): OverlayRef[] {
  return overlays.filter((overlay) => overlay.kind === "rtstruct");
}

function metadataString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function opacityValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clampOverlayOpacity(value) : fallback;
}

function isFunctionalOverlayColormap(value: string): value is FunctionalOverlayColormap {
  return (FUNCTIONAL_OVERLAY_COLORMAPS as readonly string[]).includes(value);
}

function stableColorIndex(overlay: OverlayRef, fallbackIndex: number): number {
  const key = [overlay.group, overlay.structure, overlay.uid, overlay.label].filter(Boolean).join("|");
  if (!key) {
    return fallbackIndex % FALLBACK_COLORS.length;
  }
  return stableTextColorIndex(key, fallbackIndex, FALLBACK_COLORS.length);
}

function rtstructRoiPalette(overlay: OverlayRef): readonly string[] {
  const normalized = `${overlay.group ?? ""} ${overlay.structure ?? ""} ${overlay.label}`.toLowerCase();
  if (normalized.includes("lesion")) {
    return LESION_ROI_COLORS;
  }
  if (normalized.includes("organ")) {
    return ORGAN_ROI_COLORS;
  }
  return FALLBACK_COLORS;
}

function stableTextColorIndex(key: string, fallbackIndex: number, paletteLength: number): number {
  if (!key || paletteLength <= 0) {
    return fallbackIndex;
  }
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash % paletteLength;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
