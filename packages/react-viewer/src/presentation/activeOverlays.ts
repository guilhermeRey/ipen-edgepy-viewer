import type { OverlayRef } from "@pycom-next/core";
import { clampOverlayOpacity, overlayOpacity } from "./overlayPresentation";
import { rtstructRoiColors } from "./rtstructRoiState";

export interface ActiveOverlayPresentationInput {
  overlays: readonly OverlayRef[];
  visibleOverlayUids: ReadonlySet<string>;
  overlayOpacityByUid: ReadonlyMap<string, number>;
  visibleRtstructRoiNumbersByOverlayUid: ReadonlyMap<string, ReadonlySet<number>>;
}

export function activeOverlaysWithPresentation(input: ActiveOverlayPresentationInput): OverlayRef[] {
  return input.overlays
    .filter((overlay) => input.visibleOverlayUids.has(overlay.uid))
    .map((overlay) => overlayWithPresentation(overlay, input.overlayOpacityByUid.get(overlay.uid) ?? overlayOpacity(overlay), input.visibleRtstructRoiNumbersByOverlayUid.get(overlay.uid)));
}

function overlayWithPresentation(overlay: OverlayRef, opacity: number, visibleRoiNumbers: ReadonlySet<number> | undefined): OverlayRef {
  return {
    ...overlay,
    metadata: {
      ...(overlay.metadata ?? {}),
      opacity: clampOverlayOpacity(opacity),
      ...(overlay.kind === "rtstruct" ? { rtstructRoiColors: rtstructRoiColors(overlay) } : {}),
      ...(overlay.kind === "rtstruct" && visibleRoiNumbers ? { rtstructVisibleRoiNumbers: Array.from(visibleRoiNumbers) } : {}),
    },
  };
}
