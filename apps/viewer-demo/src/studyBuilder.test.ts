import { describe, expect, it } from "vitest";
import type { DicomInventoryEntry, DicomInventoryResult } from "@pycom-next/dicom";
import { buildDicomInventory } from "@pycom-next/dicom";
import { addAcquisitionToBuilder, addMapToBuilder, buildDemoClinicalStudy, createDemoStudyBuilderFromStudy, createEmptyDemoStudyBuilder } from "./studyBuilder";

describe("demo study builder", () => {
  it("adds acquisitions as separate scans", () => {
    const builder = addAcquisitionToBuilder(
      addAcquisitionToBuilder(createEmptyDemoStudyBuilder(), inventory([
        imageEntry("ct/1.dcm", "CT", "ct-1"),
        imageEntry("spect/1.dcm", "NM", "spect-1"),
      ])),
      inventory([imageEntry("ct2/1.dcm", "CT", "ct-2")]),
    );

    const study = buildDemoClinicalStudy(builder);

    expect(study.scans).toMatchObject([
      { id: "Scan1", baseSeriesUid: expect.any(String), functionalSeriesUid: expect.any(String) },
      { id: "Scan2", baseSeriesUid: expect.any(String) },
    ]);
  });

  it("applies one imported map to selected scans", () => {
    const builder = addMapToBuilder(
      addAcquisitionToBuilder(addAcquisitionToBuilder(createEmptyDemoStudyBuilder(), inventory([imageEntry("ct1/1.dcm", "CT", "ct-1")])), inventory([imageEntry("ct2/1.dcm", "CT", "ct-2")])) ,
      inventory([{ path: "Maps/Lesions/tumor/1.dcm", kind: "mask" }]),
      ["Scan2"],
    );

    const study = buildDemoClinicalStudy(builder);

    expect(study.overlays).toHaveLength(1);
    expect(study.scans[0]?.overlayUids).toEqual([]);
    expect(study.scans[1]?.overlayUids).toEqual([study.overlays[0]?.uid]);
  });

  it("applies maps to all scans when no target is selected", () => {
    const builder = addMapToBuilder(
      addAcquisitionToBuilder(createEmptyDemoStudyBuilder(), inventory([imageEntry("ct1/1.dcm", "CT", "ct-1")])),
      inventory([{ path: "RT/Organs/rt.dcm", kind: "rtstruct" }]),
      [],
    );

    const study = buildDemoClinicalStudy(builder);

    expect(study.scans[0]?.overlayUids).toEqual([study.overlays[0]?.uid]);
  });

  it("keeps imported scans available for later overlays", () => {
    const imported = buildDemoClinicalStudy(addAcquisitionToBuilder(createEmptyDemoStudyBuilder(), inventory([imageEntry("ct1/1.dcm", "CT", "ct-1")])));
    const builder = addMapToBuilder(
      createDemoStudyBuilderFromStudy(imported),
      inventory([{ path: "dose/result/patient_beta--Dose.mhd", kind: "dose" }, { path: "dose/result/patient_beta--Dose.raw", kind: "dose" }]),
      ["Scan1"],
    );

    const study = buildDemoClinicalStudy(builder);

    expect(study.scans[0]?.baseSeriesUid).toBe(imported.scans[0]?.baseSeriesUid);
    expect(study.overlays).toMatchObject([{ kind: "dose", label: "Beta- dose" }]);
    expect(study.scans[0]?.overlayUids).toEqual([study.overlays[0]?.uid]);
  });
});

function inventory(entries: DicomInventoryEntry[]): DicomInventoryResult {
  return { entries, series: buildDicomInventory(entries) };
}

function imageEntry(path: string, modality: string, seriesInstanceUid: string): DicomInventoryEntry {
  return { path, kind: "image", metadata: { modality, seriesInstanceUid } };
}
