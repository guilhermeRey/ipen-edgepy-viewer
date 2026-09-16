import type { OverlayRef } from "@pycom-next/core";

export interface RtstructStructureOption {
  roiNumber: number;
  name?: string;
  contourCount: number;
}

export function rtstructStructures(overlay: OverlayRef): RtstructStructureOption[] {
  const structures = rtstructMetadataRecord(overlay)?.structures;
  return Array.isArray(structures)
    ? structures.map(rtstructStructureOption).filter((item): item is RtstructStructureOption => Boolean(item))
    : [];
}

function rtstructStructureOption(value: unknown): RtstructStructureOption | undefined {
  if (!isRecord(value) || typeof value.roiNumber !== "number") {
    return undefined;
  }
  return {
    roiNumber: value.roiNumber,
    ...(typeof value.name === "string" ? { name: value.name } : {}),
    contourCount: typeof value.contourCount === "number" ? value.contourCount : 0,
  };
}

function rtstructMetadataRecord(overlay: OverlayRef): Record<string, unknown> | undefined {
  const dicom = overlay.metadata?.dicom;
  return isRecord(dicom) && isRecord(dicom.rtstruct) ? dicom.rtstruct : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
