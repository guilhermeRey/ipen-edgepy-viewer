import type { OverlayRef } from "@pycom-next/core";
import { rtstructRoiColor } from "./overlayPresentation";
import { rtstructStructures } from "./rtstructStructures";

export function toggleRtstructRoiState(current: ReadonlyMap<string, ReadonlySet<number>>, overlay: OverlayRef, roiNumber: number): ReadonlyMap<string, ReadonlySet<number>> {
  const visibleRoiNumbers = new Set(current.get(overlay.uid) ?? rtstructRoiNumbers(overlay));
  if (visibleRoiNumbers.has(roiNumber)) {
    visibleRoiNumbers.delete(roiNumber);
  } else {
    visibleRoiNumbers.add(roiNumber);
  }
  return new Map(current).set(overlay.uid, visibleRoiNumbers);
}

export function setAllRtstructRoisState(current: ReadonlyMap<string, ReadonlySet<number>>, overlay: OverlayRef, visible: boolean): ReadonlyMap<string, ReadonlySet<number>> {
  return new Map(current).set(overlay.uid, new Set(visible ? rtstructRoiNumbers(overlay) : []));
}

export function focusRtstructRoiState(current: ReadonlyMap<string, ReadonlySet<number>>, overlay: OverlayRef, roiNumber: number): ReadonlyMap<string, ReadonlySet<number>> {
  return new Map(current).set(overlay.uid, new Set([roiNumber]));
}

export function rtstructRoiColors(overlay: OverlayRef): Record<number, string> {
  return Object.fromEntries(
    rtstructStructures(overlay).map((structure, index) => [
      structure.roiNumber,
      rtstructRoiColor({ overlay, roiNumber: structure.roiNumber, name: structure.name, index }),
    ]),
  );
}

function rtstructRoiNumbers(overlay: OverlayRef): number[] {
  return rtstructStructures(overlay).map((structure) => structure.roiNumber);
}
