import type { ClinicalStudy, OverlayRef } from "@pycom-next/core";
import { loadMhdDoseVolumeData } from "@pycom-next/renderer-cornerstone";
import type { ClinicalViewportAssetResolver } from "@pycom-next/react-viewer";

export interface DoseAgentInput {
  doseVolume?: DoseVolumeAgentInput | undefined;
}

export interface DoseVolumeAgentInput {
  uid: string;
  label: string;
  paths: string[];
  dimensions: [number, number, number];
  spacing: [number, number, number];
  offset: [number, number, number];
  elementType: string;
  valueCount: number;
  values: Float32Array;
}

export async function doseAgentInputForStudy(
  study: ClinicalStudy,
  assetResolver: ClinicalViewportAssetResolver,
  preferredOverlayUids: readonly string[] = [],
): Promise<DoseAgentInput> {
  for (const overlay of orderedDoseOverlays(study.overlays, preferredOverlayUids)) {
    const assets = await assetResolver.resolveOverlayAssets?.(overlay) ?? [];
    const data = await loadMhdDoseVolumeData(assets);
    if (data) {
      return { doseVolume: {
        uid: overlay.uid,
        label: overlay.label,
        paths: assets.map((asset) => asset.path),
        dimensions: data.dimensions,
        spacing: data.spacing,
        offset: data.offset,
        elementType: data.elementType,
        valueCount: data.values.length,
        values: data.values,
      } };
    }
  }
  return {};
}

function orderedDoseOverlays(overlays: readonly OverlayRef[], preferredOverlayUids: readonly string[]): OverlayRef[] {
  const priority = new Map(preferredOverlayUids.map((uid, index) => [uid, index]));
  return overlays
    .filter((overlay) => overlay.kind === "dose")
    .sort((left, right) => (priority.get(left.uid) ?? Number.MAX_SAFE_INTEGER) - (priority.get(right.uid) ?? Number.MAX_SAFE_INTEGER));
}
