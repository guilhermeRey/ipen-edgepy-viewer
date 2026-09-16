import { describe, expect, it } from "vitest";
import type { ClinicalStudy, ViewerControlPlaneSnapshot } from "@pycom-next/core";
import { pyScriptEditorInput } from "./pyscriptEditorInput";

describe("pyScriptEditorInput", () => {
  it("uses a copied decoded slice from the active renderer", async () => {
    const image = { width: 2, height: 1, sliceIndex: 0, values: new Float32Array([1, 2]) };
    const input = await pyScriptEditorInput({
      assetResolver: { resolveSeriesAssets: () => [] },
      includeDose: false,
      snapshot: snapshot(),
      study: study(),
      viewportHandle: { destroy() {}, getCurrentImageData: async () => image },
    });

    expect(input).toEqual({ source: "edgepy-viewer", image });
  });
});

function study(): ClinicalStudy {
  return { uid: "study", label: "Study", scans: [], series: [], overlays: [] };
}

function snapshot(): ViewerControlPlaneSnapshot {
  return { controlPlaneVersion: 1, study: study(), visibleLayers: [], fusionContext: { status: "empty", overlayUids: [] } };
}
