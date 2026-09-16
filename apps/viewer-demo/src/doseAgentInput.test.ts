import { describe, expect, it } from "vitest";
import type { ClinicalStudy } from "@pycom-next/core";
import type { ClinicalViewportAssetResolver } from "@pycom-next/react-viewer";
import { doseAgentInputForStudy } from "./doseAgentInput";

describe("doseAgentInputForStudy", () => {
  it("loads the first MHD/RAW dose overlay as Float32Array input", async () => {
    const study: ClinicalStudy = {
      uid: "study-1",
      label: "Study 1",
      series: [],
      scans: [],
      overlays: [{
        uid: "dose-1",
        label: "Gamma dose",
        kind: "dose",
        metadata: { paths: ["dose/patient_gamma-Dose.mhd", "dose/patient_gamma-Dose.raw"] },
      }],
    };
    const values = new Float32Array([0, 1.5, 2.5, 4]);

    const input = await doseAgentInputForStudy(study, resolverForAssets([
      { path: "dose/patient_gamma-Dose.mhd", data: new Blob([mhdHeader()]) },
      { path: "dose/patient_gamma-Dose.raw", data: new Blob([values.buffer]) },
    ]));

    expect(input.doseVolume).toMatchObject({
      uid: "dose-1",
      label: "Gamma dose",
      dimensions: [2, 2, 1],
      spacing: [1, 2, 3],
      offset: [4, 5, 6],
      elementType: "MET_FLOAT",
      valueCount: 4,
    });
    expect(Array.from(input.doseVolume?.values ?? [])).toEqual([0, 1.5, 2.5, 4]);
  });

  it("uses the preferred visible dose overlay", async () => {
    const study: ClinicalStudy = {
      uid: "study-1",
      label: "Study 1",
      series: [],
      scans: [],
      overlays: [
        { uid: "dose-beta", label: "Beta", kind: "dose" },
        { uid: "dose-gamma", label: "Gamma", kind: "dose" },
      ],
    };
    const resolver: ClinicalViewportAssetResolver = {
      resolveSeriesAssets: () => [],
      resolveOverlayAssets: (overlay) => [
        { path: `${overlay.uid}.mhd`, data: new Blob([mhdHeader({ dataFile: `${overlay.uid}.raw` })]) },
        { path: `${overlay.uid}.raw`, data: new Blob([new Float32Array(overlay.uid === "dose-gamma" ? [9, 8, 7, 6] : [1, 2, 3, 4]).buffer]) },
      ],
    };

    const input = await doseAgentInputForStudy(study, resolver, ["dose-gamma"]);

    expect(input.doseVolume?.uid).toBe("dose-gamma");
    expect(Array.from(input.doseVolume?.values ?? [])).toEqual([9, 8, 7, 6]);
  });
});

function resolverForAssets(assets: Array<{ path: string; data: Blob }>): ClinicalViewportAssetResolver {
  return { resolveSeriesAssets: () => [], resolveOverlayAssets: () => assets };
}

function mhdHeader(options: { dataFile?: string } = {}): string {
  return [
    "ObjectType = Image",
    "NDims = 3",
    "DimSize = 2 2 1",
    "ElementSpacing = 1 2 3",
    "Offset = 4 5 6",
    "ElementType = MET_FLOAT",
    `ElementDataFile = ${options.dataFile ?? "patient_gamma-Dose.raw"}`,
  ].join("\n");
}
