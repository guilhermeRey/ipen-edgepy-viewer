import { describe, expect, it } from "vitest";
import type { OverlayRef } from "@pycom-next/core";
import { focusRtstructRoiState, setAllRtstructRoisState, toggleRtstructRoiState } from "./rtstructRoiState";

describe("RTSTRUCT ROI state", () => {
  it("isolates one ROI without changing other overlays", () => {
    const current = new Map<string, ReadonlySet<number>>([["other", new Set([9])]]);

    const next = focusRtstructRoiState(current, rtstructOverlay(), 2);

    expect([...(next.get("rt") ?? [])]).toEqual([2]);
    expect([...(next.get("other") ?? [])]).toEqual([9]);
  });

  it("can restore all ROIs after focusing one", () => {
    const focused = focusRtstructRoiState(new Map(), rtstructOverlay(), 2);

    const restored = setAllRtstructRoisState(focused, rtstructOverlay(), true);

    expect([...(restored.get("rt") ?? [])]).toEqual([1, 2, 3]);
  });

  it("toggles from the default all-visible state", () => {
    const next = toggleRtstructRoiState(new Map(), rtstructOverlay(), 2);

    expect([...(next.get("rt") ?? [])]).toEqual([1, 3]);
  });
});

function rtstructOverlay(): OverlayRef {
  return {
    uid: "rt",
    label: "RTSTRUCT",
    kind: "rtstruct",
    metadata: {
      dicom: {
        rtstruct: {
          structures: [
            { roiNumber: 1, name: "Liver", contourCount: 2 },
            { roiNumber: 2, name: "Tumor", contourCount: 3 },
            { roiNumber: 3, name: "Kidney", contourCount: 4 },
          ],
        },
      },
    },
  };
}
