import { describe, expect, it } from "vitest";
import type { ClinicalStudy } from "@pycom-next/core";
import type { DicomInventoryEntry, DicomInventoryResult, DicomInventoryWorkerClient } from "@pycom-next/dicom";
import { buildDicomInventory } from "@pycom-next/dicom";
import { createDemoImportActions } from "./demoImportActions";
import { addAcquisitionToBuilder, buildDemoClinicalStudy, createEmptyDemoStudyBuilder } from "./studyBuilder";

describe("demo import actions", () => {
  it("shows preparation status before importing MHD/RAW overlay into the target scan", async () => {
    let builder = addAcquisitionToBuilder(createEmptyDemoStudyBuilder(), inventory([imageEntry("ct/1.dcm", "CT", "ct-1")]));
    const statuses: string[] = [];
    const importing: boolean[] = [];
    let study: ClinicalStudy = buildDemoClinicalStudy(builder);

    const actions = createDemoImportActions({
      assetByPathRef: { current: new Map() },
      builder,
      importAbortRef: { current: null },
      mapTargetScanIds: new Set(),
      recordDebug: () => undefined,
      setAssetResolver: () => undefined,
      setBuilder: (value) => { builder = typeof value === "function" ? value(builder) : value; },
      setIsImporting: (value) => { importing.push(typeof value === "function" ? value(importing.at(-1) ?? false) : value); },
      setMapTargetScanIds: () => undefined,
      setStatus: (value) => { statuses.push(typeof value === "function" ? value(statuses.at(-1) ?? "") : value); },
      setStudy: (value) => { study = typeof value === "function" ? value(study) : value; },
      setViewportRenderer: () => undefined,
      status: "Ready.",
      workerClientRef: { current: null as DicomInventoryWorkerClient | null },
    });

    await actions.addMapFromFileList(doseFileList(), ["Scan1"]);

    expect(importing[0]).toBe(true);
    expect(statuses[0]).toBe("Preparing overlay import...");
    expect(study.overlays).toMatchObject([{ kind: "dose", label: "Beta- dose" }]);
    expect(study.scans[0]?.overlayUids).toEqual([study.overlays[0]?.uid]);
    expect(builder.maps[0]?.targetScanIds).toEqual(["Scan1"]);
  });
});

function doseFileList(): FileList {
  return [
    fileWithRelativePath(
      new File(["ObjectType = Image\nNDims = 3\nDimSize = 1 1 1\nElementType = MET_FLOAT\nElementDataFile = patient_beta--Dose.raw\n"], "patient_beta--Dose.mhd"),
      "dose/result/patient_beta--Dose.mhd",
    ),
    fileWithRelativePath(new File([new Uint8Array([0, 0, 0, 0])], "patient_beta--Dose.raw"), "dose/result/patient_beta--Dose.raw"),
  ] as unknown as FileList;
}

function fileWithRelativePath(file: File, webkitRelativePath: string): File {
  Object.defineProperty(file, "webkitRelativePath", { value: webkitRelativePath });
  return file;
}

function inventory(entries: DicomInventoryEntry[]): DicomInventoryResult {
  return { entries, series: buildDicomInventory(entries) };
}

function imageEntry(path: string, modality: string, seriesInstanceUid: string): DicomInventoryEntry {
  return { path, kind: "image", metadata: { modality, seriesInstanceUid } };
}
